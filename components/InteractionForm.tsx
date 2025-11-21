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
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-3">
        <div>
            <label htmlFor="date" className="form-label">Date</label>
            <input 
              type="date"
              id="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              className="input-field w-full" 
              required />
        </div>
        <div>
            <label htmlFor="type" className="form-label">Connection Type</label>
            <select id="type" value={type} onChange={e => setType(e.target.value)} className="input-field w-full">
                {connectionTypes.map(ct => <option key={ct} value={ct}>{ct}</option>)}
            </select>
        </div>
      </div>
      
      <div className="form-section-tight">
          <label className="form-label">Who was involved?</label>
          {isEditingSingleItem ? (
            <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-md text-xs text-gray-900 dark:text-gray-100">
                {logForItem?.name || 
                 [...selectedPersonIds, ...selectedGroupIds]
                    .map(id => people.find(p => p.id === id)?.name || groups.find(g => g.id === id)?.name)
                    .join(', ')}
            </div>
          ) : (
            <div className="form-scroll-box mt-1">
        {Object.entries(groupedPeople).map(([circle, members]) => {
          const list = members as Person[];
          return (
            <div key={circle}>
              <h4 className="form-sticky-header">{circle}</h4>
              {list.map(person => (
                <div key={person.id} className="flex items-center pl-1 py-0.5">
                  <input id={`p-${person.id}`} type="checkbox" checked={selectedPersonIds.includes(person.id)} onChange={() => handleToggle(person.id, 'person')} className="h-3.5 w-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                  <label htmlFor={`p-${person.id}`} className="ml-2 block text-xs text-gray-900 dark:text-gray-100">{person.name}</label>
                </div>
              ))}
            </div>
          );
        })}
                
                {groups.length > 0 && <h4 className="form-sticky-header pt-1">Groups</h4>}
                {groups.map(group => (
                    <div key={group.id} className="flex items-center pl-1 py-0.5">
                        <input id={`g-${group.id}`} type="checkbox" checked={selectedGroupIds.includes(group.id)} onChange={() => handleToggle(group.id, 'group')} className="h-3.5 w-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                        <label htmlFor={`g-${group.id}`} className="ml-2 block text-xs text-gray-900 dark:text-gray-100">{group.name}</label>
                    </div>
                ))}
            </div>
          )}
      </div>
      
      <div className="form-section-tight">
        <label htmlFor="notes" className="form-label">Notes</label>
        <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="input-field" />
      </div>
      <div className="form-actions border-t border-gray-200 dark:border-gray-700 mt-3 pt-3">
        <div></div>
        <div className="flex space-x-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Cancel</button>
          <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">{interactionToEdit ? 'Save Changes' : 'Log Connection'}</button>
        </div>
      </div>
      {/* Global .input-field styles now centralized in index.css */}
    </form>
  );
};

export default InteractionForm;