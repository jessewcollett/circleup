import React, { useState, useRef } from 'react';

interface SettingsModalProps {
  circles: string[];
  setCircles: React.Dispatch<React.SetStateAction<string[]>>;
  connectionTypes: string[];
  setConnectionTypes: React.Dispatch<React.SetStateAction<string[]>>;
  onClose: () => void;
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
          className="flex justify-between items-center bg-gray-100 dark:bg-gray-700 p-2 rounded-md"
        >
          <div className="flex items-center gap-2">
             {isReorderMode ? (
                <div className="flex flex-col">
                    <button onClick={() => handleMove(index, 'up')} disabled={index === 0} className="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button onClick={() => handleMove(index, 'down')} disabled={index === items.length - 1} className="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                </div>
             ) : (
                <div className="w-8 h-12"></div> // Placeholder for alignment
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

const SettingsModal: React.FC<SettingsModalProps> = ({ circles, setCircles, connectionTypes, setConnectionTypes, onClose }) => {
  const [newCircle, setNewCircle] = useState('');
  const [newConnectionType, setNewConnectionType] = useState('');
  const [isCirclesReorderMode, setIsCirclesReorderMode] = useState(false);
  const [isConnectionTypesReorderMode, setIsConnectionTypesReorderMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Manage Circles</h3>
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
      
      <div>
        <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Manage Connection Types</h3>
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

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Data Backup & Restore</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Save all your app data to a file on your device, or restore it from a backup. This is useful for transferring data between devices.
        </p>
        <div className="flex space-x-2 pt-4">
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
          >
            Export All Data
          </button>
          <button
            onClick={handleImportClick}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            Import Data
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
          />
        </div>
      </div>

       <style>{`.input-field { display: block; width: 100%; min-width: 0; padding: 0.5rem 0.75rem; background-color: white; border: 1px solid #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); font-size: 1rem; color: #111827; } .dark .input-field { background-color: #374151; border-color: #4B5563; color: #F9FAFB; } .dark .input-field:focus { outline: none; ring: 2px; ring-color: #3B82F6; border-color: #3B82F6; }`}</style>
    </div>
  );
};

export default SettingsModal;