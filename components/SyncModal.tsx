import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { pullRemoteToLocal, migrateLocalToCloud, LS_KEYS } from '../lib/firestoreSync';
import Spinner from './Spinner';

interface ItemCounts {
  [key: string]: { local: number; remote: number };
}

export default function SyncModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [counts, setCounts] = useState<ItemCounts>({
    people: { local: 0, remote: 0 },
    groups: { local: 0, remote: 0 },
    interactions: { local: 0, remote: 0 },
    activities: { local: 0, remote: 0 },
    supportRequests: { local: 0, remote: 0 },
    askHistory: { local: 0, remote: 0 },
  });
  const [error, setError] = useState<string | null>(null);

  const countItems = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    setLoading(true);
    setError(null);
    const collections = ['people', 'groups', 'interactions', 'activities', 'supportRequests', 'askHistory'];
    const newCounts: ItemCounts = {};

    try {
      for (const col of collections) {
        // Count local
        const localJson = localStorage.getItem(LS_KEYS[col as keyof typeof LS_KEYS]);
        const localItems = localJson ? JSON.parse(localJson) : [];
        
        // Count remote
        const snap = await getDocs(collection(db, 'users', uid, col));
        const remoteItems = snap.docs.map(d => d.data());

        newCounts[col] = {
          local: Array.isArray(localItems) ? localItems.length : 0,
          remote: remoteItems.length,
        };
      }
      setCounts(newCounts);
    } catch (err) {
      console.error('Error counting items:', err);
      setError('Failed to count items. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    countItems();
  }, []);

  const handleUploadLocal = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    setSyncing(true);
    try {
      await migrateLocalToCloud(uid);
      await countItems(); // refresh counts
      alert('Local data uploaded successfully!');
    } catch (err) {
      console.error('Upload failed:', err);
      setError('Upload failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const handlePullRemote = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    setSyncing(true);
    try {
      const res = await pullRemoteToLocal(uid);
      if (res?.success) {
        alert('Remote data pulled successfully! The app will reload.');
        window.location.reload();
      } else {
        setError('Pull failed. Please try again.');
      }
    } catch (err) {
      console.error('Pull failed:', err);
      setError('Pull failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-lg w-full space-y-4">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sync Data</h2>
      
      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : error ? (
        <div className="text-red-600 dark:text-red-400">{error}</div>
      ) : (
        <>
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-300">
              Compare your local data (this browser) with cloud data:
            </p>
            
            <div className="border rounded-md divide-y dark:divide-gray-700">
              {(Object.entries(counts) as [string, { local: number, remote: number }][]).map(([col, countData]) => (
                <div key={col} className="flex justify-between items-center p-3">
                  <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">
                    {col.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="mr-4">Local: {countData.local}</span>
                    <span>Cloud: {countData.remote}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={handlePullRemote}
              disabled={syncing}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {syncing ? <Spinner size={20} /> : 'Pull from Cloud'}
            </button>
            <button
              onClick={handleUploadLocal}
              disabled={syncing}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {syncing ? <Spinner size={20} /> : 'Upload Local'}
            </button>
            <button
              onClick={onClose}
              disabled={syncing}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              Close
            </button>
          </div>
        </>
      )}
    </div>
  );
}