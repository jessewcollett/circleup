import React, { useState, useMemo } from 'react';
import { SupportRequest, Person, Group } from '../types';

interface SupportRequestFormProps {
  people: Person[];
  groups: Group[];
  onSave: (request: SupportRequest) => void;
  onDelete?: (requestId: string) => void;
  onClose: () => void;
  supportRequestToEdit?: SupportRequest;
  circles: string[];
}

const SupportRequestForm: React.FC<SupportRequestFormProps> = ({ people, groups, onSave, onDelete, onClose, supportRequestToEdit, circles }) => {
  const [request, setRequest] = useState<SupportRequest>(
    supportRequestToEdit || {
      id: '',
      name: '',
      helperIds: [],
    }
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRequest(r => ({ ...r, name: e.target.value }));
  };

  const handleHelperToggle = (id: string) => {
    setRequest(r => ({
      ...r,
      helperIds: r.helperIds.includes(id)
        ? r.helperIds.filter(hId => hId !== id)
        : [...r.helperIds, id],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!request.name.trim() || request.helperIds.length === 0) {
      alert('A request must have a name and at least one helper.');
      return;
    }
    onSave({
      ...request,
      id: supportRequestToEdit?.id || Date.now().toString(),
    });
  };

  const handleDelete = () => {
    if (onDelete && supportRequestToEdit && window.confirm(`Are you sure you want to delete "${supportRequestToEdit.name}"?`)) {
      onDelete(supportRequestToEdit.id);
    }
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Favor / Request Name</label>
        <input type="text" id="name" name="name" value={request.name} onChange={handleChange} className="mt-1 input-field" placeholder="e.g., Watch the dog" required autoFocus={!supportRequestToEdit} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Who can help?</label>
        <div className="mt-2 max-h-60 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md p-2 space-y-1">
          {Object.entries(groupedPeople).map(([circle, members]) => (
                <div key={circle}>
                    <h4 className="font-semibold text-xs uppercase text-gray-500 dark:text-gray-400 py-1 sticky top-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">{circle}</h4>
                    {members.map(person => (
                        <div key={person.id} className="flex items-center pl-2 py-0.5">
                          <input id={`sr-p-${person.id}`} type="checkbox" checked={request.helperIds.includes(person.id)} onChange={() => handleHelperToggle(person.id)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                          <label htmlFor={`sr-p-${person.id}`} className="ml-3 block text-sm text-gray-900 dark:text-gray-100">{person.name}</label>
                        </div>
                    ))}
                </div>
            ))}
          {groups.length > 0 && <h4 className="font-semibold text-xs uppercase text-gray-500 dark:text-gray-400 pt-2 sticky top-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">Groups</h4>}
          {groups.map(group => (
            <div key={group.id} className="flex items-center pl-2 py-0.5">
              <input id={`sr-g-${group.id}`} type="checkbox" checked={request.helperIds.includes(group.id)} onChange={() => handleHelperToggle(group.id)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
              <label htmlFor={`sr-g-${group.id}`} className="ml-3 block text-sm text-gray-900 dark:text-gray-100">{group.name}</label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center pt-4">
        <div>
          {supportRequestToEdit && onDelete && (
            <button type="button" onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Delete</button>
          )}
        </div>
        <div className="flex space-x-2">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Cancel</button>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save</button>
        </div>
      </div>
       <style>{`.input-field { display: block; width: 100%; min-width: 0; padding: 0.5rem 0.75rem; background-color: white; border: 1px solid #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); font-size: 1rem; color: #111827; } .dark .input-field { background-color: #374151; border-color: #4B5563; color: #F9FAFB; } .dark .input-field:focus { outline: none; ring: 2px; ring-color: #3B82F6; border-color: #3B82F6; }`}</style>
    </form>
  );
};

export default SupportRequestForm;