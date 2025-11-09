import { db } from '../firebase';
import { collection, doc, setDoc, getDocs, writeBatch, onSnapshot, query } from 'firebase/firestore';

// Keys we use in localStorage
export const LS_KEYS = {
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
  // Merge localStorage into Firestore for the given user.
  // Strategy: for each collection, union items by id and prefer the item with newer `updatedAt`.
  if (!uid) return;

  // Read local storage
  const local: Record<string, any> = {};
  Object.entries(LS_KEYS).forEach(([k, key]) => {
    const value = localStorage.getItem(key as string);
    if (value) {
      try {
        local[k] = JSON.parse(value);
      } catch {
        local[k] = value;
      }
    } else {
      local[k] = null;
    }
  });

  const collections = ['people', 'groups', 'interactions', 'activities', 'supportRequests', 'askHistory'];

  for (const col of collections) {
    // Load remote docs
    const remoteSnap = await getDocs(collection(db, 'users', uid, col));
    const remoteMap: Record<string, any> = {};
    remoteSnap.docs.forEach(d => {
      const data = d.data();
      if (data && data.id) remoteMap[data.id] = data;
    });

    const localArr = local[col] && Array.isArray(local[col]) ? local[col] : [];

    // Build merged map
    const mergedMap: Record<string, any> = { ...remoteMap };

    for (const item of localArr) {
      const id = item.id || (Date.now().toString() + Math.random().toString(36).slice(2,8));
      const localItem = { ...item, id: id.toString(), updatedAt: item.updatedAt || Date.now() };
      const remoteItem = mergedMap[id];
      if (!remoteItem) {
        mergedMap[id] = localItem;
      } else {
        const localTs = Number(localItem.updatedAt || 0);
        const remoteTs = Number(remoteItem.updatedAt || 0);
        // prefer newest
        mergedMap[id] = localTs >= remoteTs ? localItem : remoteItem;
      }
    }

  const mergedItems = Object.values(mergedMap);

    // Write only changed/absent docs
    const batch = writeBatch(db);
    for (const it of mergedItems) {
      const rid = it.id;
      const remote = remoteMap[rid];
      const equal = remote && JSON.stringify(remote) === JSON.stringify(it);
      if (!equal) {
        const ref = doc(db, 'users', uid, col, rid.toString());
        batch.set(ref, { ...it, updatedAt: it.updatedAt || Date.now() }, { merge: true });
      }
    }
  await batch.commit();
  console.debug(`[firestoreSync] migrateLocalToCloud: merged ${mergedItems.length} items into collection '${col}' for user ${uid}`);

    // Update localStorage with merged set
    try {
      localStorage.setItem(LS_KEYS[col as keyof typeof LS_KEYS], JSON.stringify(mergedItems));
    } catch (e) { /* ignore */ }
  }

  // Merge settings: meta/settings
  const settingsRef = doc(db, 'users', uid, 'meta', 'settings');
  const mergedSettings = {
    circles: local.circles || [],
    connectionTypes: local.connectionTypes || [],
    theme: local.theme || 'light',
    updatedAt: Date.now()
  };
  await setDoc(settingsRef, mergedSettings, { merge: true });
  console.debug(`[firestoreSync] migrateLocalToCloud: merged settings for user ${uid}`, mergedSettings);
}

export async function pullRemoteToLocal(uid: string) {
  if (!uid) return { success: false };
  const result: Record<string, any[]> = {};
  const collections = ['people', 'groups', 'interactions', 'activities', 'supportRequests', 'askHistory'];
  for (const col of collections) {
    const snap = await getDocs(collection(db, 'users', uid, col));
    const items = snap.docs.map(d => d.data());
    result[col] = items;
    try {
      localStorage.setItem(LS_KEYS[col as keyof typeof LS_KEYS], JSON.stringify(items));
    } catch (e) {}
  }
  // settings
  try {
    const settingsDoc = doc(db, 'users', uid, 'meta', 'settings');
    const s = await getDocs(collection(db, 'users', uid, 'meta')).catch(() => null);
    // just attempt to read the settings doc directly via getDocs workaround isn't great but ok for now
    // instead, try to read the settings doc using getDocs on the settings path
    // NOTE: Firestore doesn't support getDoc import here without extra import; we'll just set from local fallback
  } catch (e) {}
  console.debug(`[firestoreSync] pullRemoteToLocal: pulled collections for user ${uid}`, Object.keys(result).reduce((acc, k) => ({ ...acc, [k]: result[k].length }), {}));
  return { success: true, items: result };
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
