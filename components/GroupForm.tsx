import React, { useState, useMemo } from 'react';
import { Group, Person, CustomDate } from '../types';

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
      customDates: [],
      isPinned: false,
      showOnDashboard: true,
    }
  );

  const [newCustomDateDesc, setNewCustomDateDesc] = useState('');
  const [newCustomDateDate, setNewCustomDateDate] = useState('');
  const [newCustomDateRecurring, setNewCustomDateRecurring] = useState<'none' | 'yearly' | 'monthly'>('none');

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

  const addCustomDate = () => {
      if (!newCustomDateDesc.trim() || !newCustomDateDate) return;
      const newDate: CustomDate = {
          id: Date.now().toString(),
          description: newCustomDateDesc.trim(),
          date: newCustomDateDate,
          recurring: newCustomDateRecurring
      };
      setGroup(g => ({ ...g, customDates: [...(g.customDates || []), newDate] }));
      setNewCustomDateDesc('');
      setNewCustomDateDate('');
      setNewCustomDateRecurring('none');
  };

  const removeCustomDate = (id: string) => {
      setGroup(g => ({ ...g, customDates: (g.customDates || []).filter(d => d.id !== id) }));
  };

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
       <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="name" className="form-label">Group Name</label>
          <input type="text" id="name" name="name" value={group.name} onChange={handleChange} className="input-field" required autoFocus={!groupToEdit} />
        </div>
         <div>
          <label htmlFor="anniversary" className="form-label">Special Date</label>
          <input 
            type="date"
            id="anniversary" 
            name="anniversary" 
            value={group.anniversary ? group.anniversary.split('T')[0] : ''} 
            onChange={handleChange} 
            className="input-field" />
        </div>
      </div>
      
      <div className="form-section-tight">
        <label className="form-label">Connection Goal</label>
        <div className="flex items-center space-x-1.5 mt-0.5">
          <select name="goalType" value={group.connectionGoal.type} onChange={handleChange} className="input-field w-1/2">
            {connectionTypes.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
          <span className="text-xs text-gray-600 dark:text-gray-400">every</span>
          <input type="number" name="goalFrequency" value={group.connectionGoal.frequency} onChange={handleChange} className="input-field w-1/4" min="1" />
          <span className="text-xs text-gray-600 dark:text-gray-400">days</span>
        </div>
      </div>

      <div className="form-section-tight">
        <label className="form-label">Custom Dates</label>
        <p className="form-helper">Add special dates for this group</p>
        <div className="mt-1 space-y-1.5">
            {(group.customDates || []).map(customDate => (
                <div key={customDate.id} className="flex justify-between items-center text-xs p-1.5 bg-gray-50 dark:bg-gray-700/50 rounded">
                    <div className="flex flex-col">
                        <span className="font-medium">{customDate.description}</span>
                        <span className="text-[0.65rem] text-gray-500">
                            {customDate.date} 
                            {customDate.recurring !== 'none' && ` (${customDate.recurring})`}
                        </span>
                    </div>
                    <button type="button" onClick={() => removeCustomDate(customDate.id)} className="text-red-500 hover:text-red-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            ))}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
            <input type="text" value={newCustomDateDesc} onChange={e => setNewCustomDateDesc(e.target.value)} placeholder="Description" className="input-field-sm flex-grow"/>
            <input type="date" value={newCustomDateDate} onChange={e => setNewCustomDateDate(e.target.value)} className="input-field-sm"/>
            <select value={newCustomDateRecurring} onChange={e => setNewCustomDateRecurring(e.target.value as 'none' | 'yearly' | 'monthly')} className="input-field-sm">
                <option value="none">Once</option>
                <option value="yearly">Yearly</option>
                <option value="monthly">Monthly</option>
            </select>
            <button type="button" onClick={addCustomDate} className="px-2.5 py-1.5 bg-gray-200 dark:bg-gray-600 text-xs rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 whitespace-nowrap">Add</button>
        </div>
      </div>

      <div className="form-section-tight">
        <label className="form-label">Members</label>
        <div className="form-scroll-box mt-1">
            {Object.entries(groupedPeople).map(([circle, members]) => (
                <div key={circle}>
                    <h4 className="form-sticky-header">{circle}</h4>
                    {(members as Person[]).map(person => (
                        <div key={person.id} className="flex items-center pl-1 py-0.5">
                            <input id={`person-${person.id}`} type="checkbox" checked={group.memberIds.includes(person.id)} onChange={() => handleMemberToggle(person.id)} className="h-3.5 w-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                            <label htmlFor={`person-${person.id}`} className="ml-2 block text-xs text-gray-900 dark:text-gray-100">{person.name}</label>
                        </div>
                    ))}
                </div>
            ))}
        </div>
      </div>

       <div className="pt-1.5 space-y-1.5">
        <div className="flex items-center">
            <input id="isPinned" name="isPinned" type="checkbox" checked={!!group.isPinned} onChange={handleChange} className="h-3.5 w-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
            <label htmlFor="isPinned" className="ml-1.5 block text-xs text-gray-900 dark:text-gray-100">Pin this group</label>
        </div>
        <div className="flex items-center">
            <input id="showOnDashboard" name="showOnDashboard" type="checkbox" checked={group.showOnDashboard !== false} onChange={handleChange} className="h-3.5 w-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
            <label htmlFor="showOnDashboard" className="ml-1.5 block text-xs text-gray-900 dark:text-gray-100">Show on Dashboard for reminders</label>
        </div>
      </div>

      <div className="form-actions border-t border-gray-200 dark:border-gray-700 mt-3 pt-3">
        <div>
           {groupToEdit && onDelete && (
             <button type="button" onClick={handleDelete} className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700">Delete</button>
           )}
        </div>
        <div className="flex space-x-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Cancel</button>
            <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">Save Group</button>
        </div>
      </div>
      {/* Global .input-field styles now centralized in index.css */}
    </form>
  );
};

export default GroupForm;