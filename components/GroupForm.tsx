import React, { useState, useMemo } from 'react';
import { Group, Person } from '../types';

interface GroupFormProps {
  people: Person[];
  onSave: (group: Group) => void;
  onDelete?: (groupId: string) => void;
  onClose: () => void;
  groupToEdit?: Group;
  connectionTypes: string[];
  circles: string[];
}

const GroupForm: React.FC<GroupFormProps> = ({ people, onSave, onDelete, onClose, groupToEdit, connectionTypes, circles }) => {
  const [group, setGroup] = useState<Group>(
    groupToEdit || {
      id: '',
      name: '',
      memberIds: [],
      connectionGoal: { type: connectionTypes[0] || 'Hang out', frequency: 30 },
      lastConnection: new Date(0).toISOString(), // Default to long ago to appear on dashboard
      anniversary: '',
      isPinned: false,
      showOnDashboard: true,
    }
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    if (type === 'checkbox') {
        setGroup(g => ({ ...g, [name]: checked }));
        return;
    }
    if (name === 'goalType' || name === 'goalFrequency') {
      const isFrequency = name === 'goalFrequency';
      setGroup(g => ({
        ...g,
        connectionGoal: {
          ...g.connectionGoal,
          [isFrequency ? 'frequency' : 'type']: isFrequency ? parseInt(value) || 0 : value,
        }
      }));
    } else {
      setGroup(g => ({ ...g, [name]: value }));
    }
  };

  const handleMemberToggle = (personId: string) => {
    setGroup(g => ({
        ...g,
        memberIds: g.memberIds.includes(personId)
            ? g.memberIds.filter(id => id !== personId)
            : [...g.memberIds, personId]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!group.name.trim() || group.memberIds.length < 2) {
        alert("A group must have a name and at least two members.");
        return;
    }
    onSave({
        ...group,
        id: groupToEdit?.id || Date.now().toString()
    });
  };

  const handleDelete = () => {
    if (onDelete && groupToEdit && window.confirm(`Are you sure you want to delete the group "${groupToEdit.name}"?`)) {
        onDelete(groupToEdit.id);
    }
  }

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
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Group Name</label>
          <input type="text" id="name" name="name" value={group.name} onChange={handleChange} className="mt-1 input-field" required autoFocus={!groupToEdit} />
        </div>
         <div>
          <label htmlFor="anniversary" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Special Date (e.g., Anniversary)</label>
          <input 
            type="date"
            id="anniversary" 
            name="anniversary" 
            value={group.anniversary ? group.anniversary.split('T')[0] : ''} 
            onChange={handleChange} 
            className="mt-1 input-field" />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Connection Goal</label>
        <div className="flex items-center space-x-2 mt-1">
          <select name="goalType" value={group.connectionGoal.type} onChange={handleChange} className="input-field w-1/2">
            {connectionTypes.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
          <span className="text-gray-600 dark:text-gray-400">every</span>
          <input type="number" name="goalFrequency" value={group.connectionGoal.frequency} onChange={handleChange} className="input-field w-1/4" min="1" />
          <span className="text-gray-600 dark:text-gray-400">days</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Members</label>
        <div className="mt-2 max-h-60 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md p-2 space-y-1">
            {Object.entries(groupedPeople).map(([circle, members]) => (
                <div key={circle}>
                    <h4 className="font-semibold text-xs uppercase text-gray-500 dark:text-gray-400 py-1 sticky top-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">{circle}</h4>
                    {members.map(person => (
                        <div key={person.id} className="flex items-center pl-2 py-0.5">
                            <input id={`person-${person.id}`} type="checkbox" checked={group.memberIds.includes(person.id)} onChange={() => handleMemberToggle(person.id)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                            <label htmlFor={`person-${person.id}`} className="ml-3 block text-sm text-gray-900 dark:text-gray-100">{person.name}</label>
                        </div>
                    ))}
                </div>
            ))}
        </div>
      </div>

       <div className="pt-2 space-y-2">
        <div className="flex items-center">
            <input id="isPinned" name="isPinned" type="checkbox" checked={!!group.isPinned} onChange={handleChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
            <label htmlFor="isPinned" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">Pin this group</label>
        </div>
        <div className="flex items-center">
            <input id="showOnDashboard" name="showOnDashboard" type="checkbox" checked={group.showOnDashboard !== false} onChange={handleChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
            <label htmlFor="showOnDashboard" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">Show on Dashboard for reminders</label>
        </div>
      </div>

      <div className="flex justify-between items-center pt-4">
        <div>
           {groupToEdit && onDelete && (
             <button type="button" onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Delete</button>
           )}
        </div>
        <div className="flex space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save Group</button>
        </div>
      </div>
      <style>{`.input-field { display: block; width: 100%; min-width: 0; padding: 0.5rem 0.75rem; background-color: white; border: 1px solid #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); font-size: 1rem; color: #111827; } .dark .input-field { background-color: #374151; border-color: #4B5563; color: #F9FAFB; } .dark .input-field:focus { outline: none; ring: 2px; ring-color: #3B82F6; border-color: #3B82F6; }`}</style>
    </form>
  );
};

export default GroupForm;