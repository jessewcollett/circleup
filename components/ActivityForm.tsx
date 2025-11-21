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
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="title" className="form-label">Activity Title</label>
        <input type="text" id="title" name="title" value={activity.title} onChange={handleChange} className="input-field" required autoFocus={!activityToEdit} />
      </div>
      <div className="form-section-tight">
        <label htmlFor="date" className="form-label">Date</label>
        <input 
            type="date"
            id="date" 
            name="date" 
            value={activity.date ? activity.date.split('T')[0] : ''} 
            onChange={handleChange} 
            className="input-field" 
            disabled={isTBD} 
            required={!isTBD} />
        <div className="mt-1.5 flex items-center">
            <input id="isTBD" name="isTBD" type="checkbox" checked={isTBD} onChange={(e) => setIsTBD(e.target.checked)} className="h-3.5 w-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
            <label htmlFor="isTBD" className="ml-1.5 block text-xs text-gray-900 dark:text-gray-100">Date is TBD</label>
        </div>
      </div>
       <div className="form-section-tight">
        <label className="form-label">Participants</label>
        <div className="form-scroll-box mt-1">
      {Object.entries(groupedPeople).map(([circle, members]) => {
        const list = members as Person[]; // explicit cast for TS inference
        return (
          <div key={circle}>
            <h4 className="form-sticky-header">{circle}</h4>
            {list.map(person => (
              <div key={person.id} className="flex items-center pl-1 py-0.5">
                <input id={`act-p-${person.id}`} type="checkbox" checked={activity.participantIds.includes(person.id)} onChange={() => handleToggle(person.id)} className="h-3.5 w-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                <label htmlFor={`act-p-${person.id}`} className="ml-2 block text-xs text-gray-900 dark:text-gray-100">{person.name}</label>
              </div>
            ))}
          </div>
        );
      })}
            {groups.length > 0 && <h4 className="form-sticky-header pt-1">Groups</h4>}
            {groups.map(group => (
                 <div key={group.id} className="flex items-center pl-1 py-0.5">
                    <input id={`act-g-${group.id}`} type="checkbox" checked={activity.participantIds.includes(group.id)} onChange={() => handleToggle(group.id)} className="h-3.5 w-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                    <label htmlFor={`act-g-${group.id}`} className="ml-2 block text-xs text-gray-900 dark:text-gray-100">{group.name}</label>
                </div>
            ))}
        </div>
      </div>
      <div className="form-section-tight">
        <label htmlFor="notes" className="form-label">Notes</label>
        <textarea id="notes" name="notes" value={activity.notes} onChange={handleChange} rows={2} className="input-field" />
      </div>
       <div className="form-actions border-t border-gray-200 dark:border-gray-700 mt-3 pt-3">
        <div>
           {activityToEdit && onDelete && (
             <button type="button" onClick={handleDelete} className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700">Delete</button>
           )}
        </div>
        <div className="flex space-x-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Cancel</button>
          <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">Save Activity</button>
        </div>
      </div>
      {/* Global .input-field styles now centralized in index.css */}
    </form>
  );
};

export default ActivityForm;