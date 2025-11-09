import { db } from '../firebase';
import { collection, doc, setDoc, getDocs, writeBatch, onSnapshot, query } from 'firebase/firestore';

// Keys we use in localStorage
const LS_KEYS = {
  people: 'circleup_people',
  groups: 'circleup_groups',
  interactions: 'circleup_interactions',
  activities: 'circleup_activities',
  circles: 'circleup_circles',
  connectionTypes: 'circleup_connectionTypes',
  supportRequests: 'circleup_supportRequests',
  askHistory: 'circleup_askHistory',
  theme: 'circleup_theme'
};

type Unsubscribe = () => void;

export async function migrateLocalToCloud(uid: string) {
  if (!uid) return;

  // Read local storage
  const local: Record<string, any> = {};
  Object.values(LS_KEYS).forEach(k => {
    const value = localStorage.getItem(k);
    if (value) {
      try {
        local[k] = JSON.parse(value);
      } catch {
        local[k] = value;
      }
    }
  });

  // For array-like collections, write per-document with id
  const collections = ['people', 'groups', 'interactions', 'activities', 'supportRequests', 'askHistory'];

  for (const col of collections) {
    const data = local[LS_KEYS[col as keyof typeof LS_KEYS]] || [];
    if (!Array.isArray(data)) continue;

    // Use batch writes for efficiency
    const batch = writeBatch(db);
    data.forEach((item: any) => {
      const id = item.id || (Date.now().toString() + Math.random().toString(36).slice(2,8));
      const ref = doc(db, 'users', uid, col, id.toString());
      batch.set(ref, { ...item, id: id.toString(), updatedAt: item.updatedAt || Date.now() });
    });
    await batch.commit();
  }

  // For simple arrays / settings, store in a doc
  const settingsRef = doc(db, 'users', uid, 'meta', 'settings');
  const settingsData: any = {
    circles: local[LS_KEYS.circles] || [],
    connectionTypes: local[LS_KEYS.connectionTypes] || [],
    theme: local[LS_KEYS.theme] || 'light'
  };
  await setDoc(settingsRef, { ...settingsData, updatedAt: Date.now() }, { merge: true });
}

export function startRealtimeSync(uid: string, handlers: {
  onPeople?: (items: any[]) => void,
  onGroups?: (items: any[]) => void,
  onInteractions?: (items: any[]) => void,
  onActivities?: (items: any[]) => void,
  onSupportRequests?: (items: any[]) => void,
  onAskHistory?: (items: any[]) => void,
  onSettings?: (settings: any) => void,
}): Unsubscribe[] {
  if (!uid) return [];

  const unsubscribers: Unsubscribe[] = [];

  const addCollectionListener = (col: string, cb?: (items: any[]) => void) => {
    if (!cb) return;
    const q = query(collection(db, 'users', uid, col));
    const unsub = onSnapshot(q, async (snap) => {
      const items = snap.docs.map(d => d.data());
      try {
        // update localStorage for this collection
        const key = (LS_KEYS as any)[col];
        if (key) localStorage.setItem(key, JSON.stringify(items));
      } catch (e) { /* ignore */ }
      cb(items);
    });
    unsubscribers.push(unsub);
  };

  addCollectionListener('people', handlers.onPeople);
  addCollectionListener('groups', handlers.onGroups);
  addCollectionListener('interactions', handlers.onInteractions);
  addCollectionListener('activities', handlers.onActivities);
  addCollectionListener('supportRequests', handlers.onSupportRequests);
  addCollectionListener('askHistory', handlers.onAskHistory);

  // settings (meta/settings) as a doc
  const settingsRef = doc(db, 'users', uid, 'meta', 'settings');
  const unsubSettings = onSnapshot(settingsRef, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    try {
      localStorage.setItem(LS_KEYS.circles, JSON.stringify(data.circles || []));
      localStorage.setItem(LS_KEYS.connectionTypes, JSON.stringify(data.connectionTypes || []));
      if (data.theme) localStorage.setItem(LS_KEYS.theme, data.theme);
    } catch (e) {}
    handlers.onSettings?.(data);
  });
  unsubscribers.push(unsubSettings);

  return unsubscribers;
}
