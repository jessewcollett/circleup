import React, { useState, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { migrateLocalToCloud, pullRemoteToLocal } from '../lib/firestoreSync';
import { testFirestore } from '../lib/firestoreTest';
import { collection, query, getDocs, writeBatch, deleteDoc, doc } from 'firebase/firestore';

interface SettingsModalProps {
  circles: string[];
  setCircles: React.Dispatch<React.SetStateAction<string[]>>;
  connectionTypes: string[];
  setConnectionTypes: React.Dispatch<React.SetStateAction<string[]>>;
  reminderLookahead: number;
  setReminderLookahead: React.Dispatch<React.SetStateAction<number>>;
  onClose: () => void;
  onManualSync?: () => void;
  lastSyncAt?: number | null;
  onReplayTour?: () => void;
}

const ReorderableList: React.FC<{
  items: string[];
  setItems: React.Dispatch<React.SetStateAction<string[]>>;
  onDelete: (item: string) => void;
  label: string;
  isReorderMode: boolean;
}> = ({ items, setItems, onDelete, label, isReorderMode }) => {

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === items.length - 1) return;

    const newItems = [...items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap items
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];

    setItems(newItems);
  };

  return (
    <ul className="space-y-2 mt-2">
      {items.map((item, index) => (
        <li 
          key={item} 
          className={`flex justify-between items-center bg-gray-100 dark:bg-gray-700 rounded-md ${isReorderMode ? 'p-2' : 'py-1 px-2'}`}
        >
          <div className="flex items-center gap-2">
             {isReorderMode && (
                <div className="flex flex-col">
                    <button onClick={() => handleMove(index, 'up')} disabled={index === 0} className="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button onClick={() => handleMove(index, 'down')} disabled={index === items.length - 1} className="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                </div>
             )}
             <span className="text-sm">{item}</span>
          </div>
          <button
            onClick={() => onDelete(item)}
            disabled={isReorderMode}
            className="text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={`Delete ${item} ${label}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </li>
      ))}
    </ul>
  );
}

const SettingsModal: React.FC<SettingsModalProps> = ({ circles, setCircles, connectionTypes, setConnectionTypes, reminderLookahead, setReminderLookahead, onClose, onManualSync, lastSyncAt, onReplayTour }) => {

  const [newCircle, setNewCircle] = useState('');
  const [newConnectionType, setNewConnectionType] = useState('');
  const [isCirclesReorderMode, setIsCirclesReorderMode] = useState(false);
  const [isConnectionTypesReorderMode, setIsConnectionTypesReorderMode] = useState(false);
  const [circlesExpanded, setCirclesExpanded] = useState(false);
  const [connectionTypesExpanded, setConnectionTypesExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleResetData = async () => {
    if (!window.confirm('⚠️ WARNING: This will permanently delete ALL your data from both cloud storage and this device. This action cannot be undone. Are you sure?')) {
      return;
    }
    
    if (!window.confirm('⚠️ DOUBLE CHECK: Are you absolutely sure? All your connections, groups, and history will be deleted.')) {
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) {
      setError('Please sign in to reset data');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Clear cloud data
      const collections = ['people', 'groups', 'interactions', 'activities', 'supportRequests', 'askHistory'];
      const batch = writeBatch(db);
      
      for (const col of collections) {
        const q = query(collection(db, 'users', uid, col));
        const snap = await getDocs(q);
        snap.docs.forEach(d => {
          batch.delete(doc(db, 'users', uid, col, d.id));
        });
      }
      
      // Also clear settings
      const settingsRef = doc(db, 'users', uid, 'meta', 'settings');
      batch.delete(settingsRef);
      
      await batch.commit();

      // Clear local storage except for theme
      const theme = localStorage.getItem('circleup_theme');
      localStorage.clear();
      if (theme) localStorage.setItem('circleup_theme', theme);

      alert('All data has been reset! The app will reload.');
      window.location.reload();
    } catch (err) {
      console.error('Error resetting data:', err);
      setError('Failed to reset data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCircle = () => {
    if (newCircle.trim() && !circles.find(c => c.toLowerCase() === newCircle.trim().toLowerCase())) {
      setCircles(prev => [...prev, newCircle.trim()]);
      setNewCircle('');
    }
  };

  const handleDeleteCircle = (circleToDelete: string) => {
    if (window.confirm(`Are you sure you want to delete the "${circleToDelete}" circle? This will not remove it from people who already have it, but it will no longer be an option.`)) {
        setCircles(prev => prev.filter(c => c !== circleToDelete));
    }
  };
  
  const handleAddConnectionType = () => {
    if (newConnectionType.trim() && !connectionTypes.find(c => c.toLowerCase() === newConnectionType.trim().toLowerCase())) {
      setConnectionTypes(prev => [...prev, newConnectionType.trim()]);
      setNewConnectionType('');
    }
  };

  const handleDeleteConnectionType = (typeToDelete: string) => {
    if (window.confirm(`Are you sure you want to delete the "${typeToDelete}" connection type?`)) {
        setConnectionTypes(prev => prev.filter(c => c !== typeToDelete));
    }
  };

  const handleExport = () => {
    const backupData: { [key: string]: any } = {};
    const keysToExport = [
      'circleup_people',
      'circleup_groups',
      'circleup_interactions',
      'circleup_activities',
      'circleup_circles',
      'circleup_connectionTypes',
      'circleup_supportRequests',
      'circleup_askHistory',
      'circleup_theme'
    ];
  
    keysToExport.forEach(key => {
      const data = localStorage.getItem(key);
      if (data) {
        const cleanKey = key.replace('circleup_', '');
        // The theme is not JSON, handle it separately
        if (key === 'circleup_theme') {
            backupData[cleanKey] = data;
        } else {
            backupData[cleanKey] = JSON.parse(data);
        }
      }
    });
  
    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `circleup-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    if (window.confirm("Are you sure? This will overwrite all current app data and cannot be undone.")) {
        fileInputRef.current?.click();
    }
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
  
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const text = e.target?.result;
              if (typeof text !== 'string') {
                  throw new Error("File could not be read.");
              }
              const importedData = JSON.parse(text);
  
              // Basic validation
              if (!importedData || typeof importedData !== 'object' || !importedData.people || !importedData.circles) {
                  throw new Error("Invalid or corrupted backup file.");
              }
  
              Object.keys(importedData).forEach(key => {
                  const localStorageKey = `circleup_${key}`;
                  const dataToStore = (key === 'theme') 
                      ? importedData[key]
                      : JSON.stringify(importedData[key]);
                  localStorage.setItem(localStorageKey, dataToStore);
              });
  
              alert("Data imported successfully! The app will now reload.");
              window.location.reload();
  
          } catch (error: any) {
              alert(`Error importing data: ${error.message}`);
          }
      };
      reader.onerror = () => {
          alert("Error reading file.");
      };
      reader.readAsText(file);
  
      if(event.target) {
          event.target.value = '';
      }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Reminder Settings</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Configure how far ahead you want to see upcoming reminders and events.
        </p>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Days ahead to show: {reminderLookahead}
          </label>
          <input
            type="range"
            min="1"
            max="30"
            value={reminderLookahead}
            onChange={(e) => setReminderLookahead(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>1 day</span>
            <span>30 days</span>
          </div>
        </div>


      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <button
          onClick={() => setCirclesExpanded(!circlesExpanded)}
          className="w-full flex justify-between items-center text-lg font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
        >
          <span>Manage Circles</span>
          <svg
            className={`w-5 h-5 transition-transform ${circlesExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {circlesExpanded && (
          <div className="mt-4">
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setIsCirclesReorderMode(!isCirclesReorderMode)}
                className="px-2 py-1 text-xs font-semibold text-white bg-blue-500 rounded-md hover:bg-blue-600"
              >
                {isCirclesReorderMode ? 'Done' : 'Reorder'}
              </button>
            </div>
            <ReorderableList items={circles} setItems={setCircles} onDelete={handleDeleteCircle} label="circle" isReorderMode={isCirclesReorderMode} />
            {circles.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No circles yet. Add one below!</p>}
            <div className="flex space-x-2 pt-2">
              <input
                type="text"
                value={newCircle}
                onChange={(e) => setNewCircle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCircle()}
                placeholder="New circle name"
                className="input-field flex-grow"
              />
              <button
                onClick={handleAddCircle}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>
      
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <button
          onClick={() => setConnectionTypesExpanded(!connectionTypesExpanded)}
          className="w-full flex justify-between items-center text-lg font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
        >
          <span>Manage Connection Types</span>
          <svg
            className={`w-5 h-5 transition-transform ${connectionTypesExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {connectionTypesExpanded && (
          <div className="mt-4">
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setIsConnectionTypesReorderMode(!isConnectionTypesReorderMode)}
                className="px-2 py-1 text-xs font-semibold text-white bg-blue-500 rounded-md hover:bg-blue-600"
              >
                {isConnectionTypesReorderMode ? 'Done' : 'Reorder'}
              </button>
            </div>
            <ReorderableList items={connectionTypes} setItems={setConnectionTypes} onDelete={handleDeleteConnectionType} label="connection type" isReorderMode={isConnectionTypesReorderMode}/>
            {connectionTypes.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No connection types yet. Add one below!</p>}
            <div className="flex space-x-2 pt-2">
              <input
                type="text"
                value={newConnectionType}
                onChange={(e) => setNewConnectionType(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddConnectionType()}
                placeholder="New connection type"
                className="input-field flex-grow"
              />
              <button
                onClick={handleAddConnectionType}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>


        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Data Management</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage your app data, including backup, restore, and reset options.
        </p>
        <div className="grid grid-cols-1 gap-4 pt-4">
          <button
            onClick={handleResetData}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium w-full"
          >
            Reset All Data
          </button>

          <div className="flex space-x-2">
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm flex-1"
            >
              Export All Data
            </button>
            <button
              onClick={handleImportClick}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex-1"
            >
              Import Data
            </button>
          </div>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json"
          className="hidden"
        />
        
        {/* Manual Sync hidden for now */}
        {/*
        {onManualSync && (
          <button onClick={onManualSync}>Manual Sync</button>
        )}
        */}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Onboarding</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Replay the quick tour any time.</p>
        <div className="pt-4">
          <button
            type="button"
            onClick={() => {
              if (onReplayTour) onReplayTour();
              else window.dispatchEvent(new Event('circleup:startOnboarding'));
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
          >
            Take a Tour
          </button>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Account</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Sign out of your account on this device.</p>
        <div className="flex space-x-2 pt-4">
          <button
            onClick={async () => {
              if (!window.confirm('Are you sure you want to sign out?')) return;
              try {
                await signOut(auth);
                onClose();
              } catch (err) {
                console.error('Sign out failed', err);
                alert('Sign out failed. Please try again.');
              }
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
// Global .input-field styles now centralized in index.css
};

export default SettingsModal;