import React, { useState, useEffect, useMemo } from 'react';
import { Activity, Person, Group } from '../types';

interface ActivityFormProps {
  people: Person[];
  groups: Group[];
  onSave: (activity: Activity) => void;
  onDelete?: (activityId: string) => void;
  onClose: () => void;
  activityToEdit?: Activity;
  circles: string[];
}

const ActivityForm: React.FC<ActivityFormProps> = ({ people, groups, onSave, onClose, activityToEdit, onDelete, circles }) => {
  const [activity, setActivity] = useState<Omit<Activity, 'id'>>({
      title: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
      participantIds: []
  });
  const [isTBD, setIsTBD] = useState(false);

  useEffect(() => {
    if (activityToEdit) {
      setActivity({
        title: activityToEdit.title,
        date: activityToEdit.date,
        notes: activityToEdit.notes,
        participantIds: activityToEdit.participantIds,
      });
      setIsTBD(!activityToEdit.date);
    }
  }, [activityToEdit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setActivity(prev => ({ ...prev, [name]: value }));
  };

  const handleToggle = (id: string) => {
    setActivity(prev => ({
        ...prev,
        participantIds: prev.participantIds.includes(id)
            ? prev.participantIds.filter(currentId => currentId !== id)
            : [...prev.participantIds, id]
    }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activity.title.trim() || activity.participantIds.length === 0) return;
    onSave({ 
        ...activity, 
        id: activityToEdit?.id || '', // ID will be set in App.tsx if new
        date: isTBD ? undefined : activity.date 
    });
    onClose();
  };
  
  const handleDelete = () => {
    if (onDelete && activityToEdit && window.confirm(`Are you sure you want to delete the activity "${activityToEdit.title}"?`)) {
      onDelete(activityToEdit.id);
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
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Activity Title</label>
        <input type="text" id="title" name="title" value={activity.title} onChange={handleChange} className="mt-1 input-field" required autoFocus={!activityToEdit} />
      </div>
      <div>
        <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
        <input 
            type="date"
            id="date" 
            name="date" 
            value={activity.date ? activity.date.split('T')[0] : ''} 
            onChange={handleChange} 
            className="mt-1 input-field" 
            disabled={isTBD} 
            required={!isTBD} />
        <div className="mt-2 flex items-center">
            <input id="isTBD" name="isTBD" type="checkbox" checked={isTBD} onChange={(e) => setIsTBD(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
            <label htmlFor="isTBD" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">Date is TBD</label>
        </div>
      </div>
       <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Participants</label>
        <div className="mt-2 max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md p-2 space-y-1">
            {Object.entries(groupedPeople).map(([circle, members]) => (
                <div key={circle}>
                    <h4 className="font-semibold text-xs uppercase text-gray-500 dark:text-gray-400 py-1 sticky top-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">{circle}</h4>
                    {members.map(person => (
                        <div key={person.id} className="flex items-center pl-2 py-0.5">
                            <input id={`act-p-${person.id}`} type="checkbox" checked={activity.participantIds.includes(person.id)} onChange={() => handleToggle(person.id)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                            <label htmlFor={`act-p-${person.id}`} className="ml-3 block text-sm text-gray-900 dark:text-gray-100">{person.name}</label>
                        </div>
                    ))}
                </div>
            ))}
            {groups.length > 0 && <h4 className="font-semibold text-xs uppercase text-gray-500 dark:text-gray-400 pt-2 sticky top-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">Groups</h4>}
            {groups.map(group => (
                 <div key={group.id} className="flex items-center pl-2 py-0.5">
                    <input id={`act-g-${group.id}`} type="checkbox" checked={activity.participantIds.includes(group.id)} onChange={() => handleToggle(group.id)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                    <label htmlFor={`act-g-${group.id}`} className="ml-3 block text-sm text-gray-900 dark:text-gray-100">{group.name}</label>
                </div>
            ))}
        </div>
      </div>
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
        <textarea id="notes" name="notes" value={activity.notes} onChange={handleChange} rows={3} className="mt-1 input-field" />
      </div>
       <div className="flex justify-between items-center pt-4">
        <div>
           {activityToEdit && onDelete && (
             <button type="button" onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Delete</button>
           )}
        </div>
        <div className="flex space-x-2">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Cancel</button>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save Activity</button>
        </div>
      </div>
      <style>{`.input-field { display: block; width: 100%; min-width: 0; padding: 0.5rem 0.75rem; background-color: white; border: 1px solid #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); font-size: 1rem; color: #111827; } .dark .input-field { background-color: #374151; border-color: #4B5563; color: #F9FAFB; } .dark .input-field:focus { outline: none; ring: 2px; ring-color: #3B82F6; border-color: #3B82F6; }`}</style>
    </form>
  );
};

export default ActivityForm;