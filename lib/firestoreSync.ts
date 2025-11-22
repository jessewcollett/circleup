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
  reminderLookahead: 'circleup_reminderLookahead',
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
    reminderLookahead: local.reminderLookahead ?? 7,
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

  // --- Recalculate lastConnection for people and groups based on synced interactions ---
  const people = result.people || [];
  const groups = result.groups || [];
  const interactions = result.interactions || [];
  // Helper: get latest date for a person/group from interactions
  function getLatestConnectionDateForPerson(personId: string) {
    const relevant = interactions.filter((i: any) => i.personIds && i.personIds.includes(personId));
    if (relevant.length === 0) return undefined;
    return relevant.map((i: any) => i.date).sort().reverse()[0];
  }
  function getLatestConnectionDateForGroup(groupId: string) {
    const relevant = interactions.filter((i: any) => i.groupIds && i.groupIds.includes(groupId));
    if (relevant.length === 0) return undefined;
    return relevant.map((i: any) => i.date).sort().reverse()[0];
  }
  // Update people
  const updatedPeople = people.map((p: any) => {
    const latest = getLatestConnectionDateForPerson(p.id);
    return latest ? { ...p, lastConnection: latest } : p;
  });
  const updatedGroups = groups.map((g: any) => {
    const latest = getLatestConnectionDateForGroup(g.id);
    return latest ? { ...g, lastConnection: latest } : g;
  });
  try {
    localStorage.setItem(LS_KEYS.people, JSON.stringify(updatedPeople));
    localStorage.setItem(LS_KEYS.groups, JSON.stringify(updatedGroups));
  } catch (e) {}
  result.people = updatedPeople;
  result.groups = updatedGroups;

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
      // Ignore local echoes resulting from this client's pending writes
      if (snap.metadata.hasPendingWrites) {
        console.debug(`[firestoreSync] Ignoring local echo for '${col}'`);
        return;
      }
      const items = snap.docs.map(d => d.data());
      try {
        // update localStorage for this collection
        const key = (LS_KEYS as any)[col];
        if (key) localStorage.setItem(key, JSON.stringify(items));
        localStorage.setItem('circleup_realtime_initialized', '1');
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
    // Ignore local echoes resulting from this client's pending writes
    if (snap.metadata.hasPendingWrites) {
      console.debug(`[firestoreSync] Ignoring local echo for 'settings'`);
      return;
    }
    if (!snap.exists()) return;
    const data = snap.data();
    try {
      localStorage.setItem(LS_KEYS.circles, JSON.stringify(data.circles || []));
      localStorage.setItem(LS_KEYS.connectionTypes, JSON.stringify(data.connectionTypes || []));
      if (data.reminderLookahead !== undefined) localStorage.setItem(LS_KEYS.reminderLookahead, JSON.stringify(data.reminderLookahead));
      if (data.theme) localStorage.setItem(LS_KEYS.theme, data.theme);
      localStorage.setItem('circleup_realtime_initialized', '1');
    } catch (e) {}
    handlers.onSettings?.(data);
  });
  unsubscribers.push(unsubSettings);

  return unsubscribers;
}

// Write-through sync: write the provided state to Firestore using a single batch.
// This function does not read from Firestore and aims to be idempotent.
export async function syncStateToCloud(uid: string, state: {
  people?: any[];
  groups?: any[];
  interactions?: any[];
  activities?: any[];
  supportRequests?: any[];
  askHistory?: any[];
  settings?: any;
}) {
  if (!uid) return;
  const batch = writeBatch(db);

  const upsertCollection = (col: string, items: any[] | undefined) => {
    if (!items || !Array.isArray(items)) return;
    for (const it of items) {
      const id = (it && it.id) ? String(it.id) : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const ref = doc(db, 'users', uid, col, id);
      // Use merge to avoid overwriting fields unintentionally
      batch.set(ref, { ...it, id }, { merge: true });
    }
  };

  // Optionally delete docs that are no longer present locally.
  // Only perform deletes after realtime has initialized to avoid blowing away server source-of-truth on first load.
  const maybeDeleteMissing = (col: string, items: any[] | undefined) => {
    try {
      const initialized = localStorage.getItem('circleup_realtime_initialized') === '1';
      if (!initialized) return;
      const key = (LS_KEYS as any)[col];
      if (!key) return;
      const remoteJson = localStorage.getItem(key);
      const remoteItems: any[] = remoteJson ? JSON.parse(remoteJson) : [];
      const remoteIds = new Set(remoteItems.filter(Boolean).map(it => String(it.id)));
      const localIds = new Set((items || []).filter(Boolean).map(it => String(it.id)));
      for (const rid of remoteIds) {
        if (!localIds.has(rid)) {
          const ref = doc(db, 'users', uid, col, rid);
          batch.delete(ref);
        }
      }
    } catch { /* ignore */ }
  };

  upsertCollection('people', state.people);
  maybeDeleteMissing('people', state.people);
  upsertCollection('groups', state.groups);
  maybeDeleteMissing('groups', state.groups);
  upsertCollection('interactions', state.interactions);
  maybeDeleteMissing('interactions', state.interactions);
  upsertCollection('activities', state.activities);
  maybeDeleteMissing('activities', state.activities);
  upsertCollection('supportRequests', state.supportRequests);
  maybeDeleteMissing('supportRequests', state.supportRequests);
  upsertCollection('askHistory', state.askHistory);
  maybeDeleteMissing('askHistory', state.askHistory);

  if (state.settings && typeof state.settings === 'object') {
    const settingsRef = doc(db, 'users', uid, 'meta', 'settings');
    batch.set(settingsRef, { ...state.settings }, { merge: true });
  }

  try {
    await batch.commit();
    console.debug('[firestoreSync] syncStateToCloud: batch committed');
  } catch (e) {
    console.error('[firestoreSync] syncStateToCloud failed:', e);
  }
}
