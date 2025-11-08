import React, { useState, useEffect, useMemo } from 'react';
import { Interaction, Person, Group } from '../types';

interface InteractionFormProps {
  people: Person[];
  groups: Group[];
  onSave: (interaction: Interaction) => void;
  onClose: () => void;
  connectionTypes: string[];
  circles: string[];
  logForItem?: { id: string; name: string; type: 'person' | 'group' } | null;
  interactionToEdit?: Interaction;
}

const InteractionForm: React.FC<InteractionFormProps> = ({ people, groups, onSave, onClose, connectionTypes, circles, logForItem, interactionToEdit }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [type, setType] = useState(connectionTypes[0] || '');
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  useEffect(() => {
    if (interactionToEdit) {
      setDate(interactionToEdit.date.split('T')[0]);
      setNotes(interactionToEdit.notes);
      setType(interactionToEdit.type || connectionTypes[0] || '');
      setSelectedPersonIds(interactionToEdit.personIds);
      setSelectedGroupIds(interactionToEdit.groupIds);
    } else if (logForItem) {
      if (logForItem.type === 'person') {
        setSelectedPersonIds([logForItem.id]);
      } else {
        setSelectedGroupIds([logForItem.id]);
      }
    }
  }, [interactionToEdit, logForItem, connectionTypes]);


  const handleToggle = (id: string, itemType: 'person' | 'group') => {
    const state = itemType === 'person' ? selectedPersonIds : selectedGroupIds;
    const setState = itemType === 'person' ? setSelectedPersonIds : setSelectedGroupIds;
    setState(
      state.includes(id)
        ? state.filter(currentId => currentId !== id)
        : [...state, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPersonIds.length === 0 && selectedGroupIds.length === 0) return;
    onSave({ 
        id: interactionToEdit?.id || Date.now().toString(),
        date, 
        type, 
        notes, 
        personIds: selectedPersonIds, 
        groupIds: selectedGroupIds 
    });
  };
  
  const isEditingSingleItem = !!logForItem || !!interactionToEdit;
  
  const groupedPeople = useMemo(() => {
      const peopleByCircle: Record<string, Person[]> = {};
      
      circles.forEach(circle => {
          const peopleInCircle = people.filter(p => p.circles.includes(circle)).sort((a, b) => a.name.localeCompare(b.name));
          if (peopleInCircle.length > 0) {
              peopleByCircle[circle] = peopleInCircle;
          }
      });

      const uncategorized = people.filter(p => p.circles.length === 0).sort((a, b) => a.name.localeCompare(b.name));
      if (uncategorized.length > 0) {
          peopleByCircle['Uncategorized'] = uncategorized;
      }

      return peopleByCircle;
  }, [people, circles]);
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
            <input 
              type="date"
              id="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              className="mt-1 input-field" 
              required />
        </div>
        <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Connection Type</label>
            <select id="type" value={type} onChange={e => setType(e.target.value)} className="mt-1 input-field">
                {connectionTypes.map(ct => <option key={ct} value={ct}>{ct}</option>)}
            </select>
        </div>
      </div>
      
      <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Who was involved?</label>
          {isEditingSingleItem ? (
            <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-md text-gray-900 dark:text-gray-100">
                {logForItem?.name || 
                 [...selectedPersonIds, ...selectedGroupIds]
                    .map(id => people.find(p => p.id === id)?.name || groups.find(g => g.id === id)?.name)
                    .join(', ')}
            </div>
          ) : (
            <div className="mt-2 max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md p-2 space-y-1">
                {Object.entries(groupedPeople).map(([circle, members]) => (
                    <div key={circle}>
                        <h4 className="font-semibold text-xs uppercase text-gray-500 dark:text-gray-400 py-1 sticky top-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">{circle}</h4>
                        {members.map(person => (
                            <div key={person.id} className="flex items-center pl-2 py-0.5">
                                <input id={`p-${person.id}`} type="checkbox" checked={selectedPersonIds.includes(person.id)} onChange={() => handleToggle(person.id, 'person')} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                                <label htmlFor={`p-${person.id}`} className="ml-3 block text-sm text-gray-900 dark:text-gray-100">{person.name}</label>
                            </div>
                        ))}
                    </div>
                ))}
                
                {groups.length > 0 && <h4 className="font-semibold text-xs uppercase text-gray-500 dark:text-gray-400 pt-2 sticky top-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">Groups</h4>}
                {groups.map(group => (
                    <div key={group.id} className="flex items-center pl-2 py-0.5">
                        <input id={`g-${group.id}`} type="checkbox" checked={selectedGroupIds.includes(group.id)} onChange={() => handleToggle(group.id, 'group')} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                        <label htmlFor={`g-${group.id}`} className="ml-3 block text-sm text-gray-900 dark:text-gray-100">{group.name}</label>
                    </div>
                ))}
            </div>
          )}
      </div>
      
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
        <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="mt-1 input-field" />
      </div>
      <div className="flex justify-end space-x-2 pt-4">
        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Cancel</button>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{interactionToEdit ? 'Save Changes' : 'Log Connection'}</button>
      </div>
      <style>{`.input-field { display: block; width: 100%; min-width: 0; padding: 0.5rem 0.75rem; background-color: white; border: 1px solid #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); font-size: 1rem; color: #111827; } .dark .input-field { background-color: #374151; border-color: #4B5563; color: #F9FAFB; } .dark .input-field:focus { outline: none; ring: 2px; ring-color: #3B82F6; border-color: #3B82F6; }`}</style>
    </form>
  );
};

export default InteractionForm;