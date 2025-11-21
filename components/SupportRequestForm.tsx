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
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="name" className="form-label">Favor / Request Name</label>
        <input type="text" id="name" name="name" value={request.name} onChange={handleChange} className="input-field" placeholder="e.g., Watch the dog" required autoFocus={!supportRequestToEdit} />
      </div>

      <div className="form-section-tight">
        <label className="form-label">Who can help?</label>
        <div className="form-scroll-box mt-1">
          {Object.entries(groupedPeople).map(([circle, members]) => {
                const list = members as Person[];
                return (
                  <div key={circle}>
                      <h4 className="form-sticky-header">{circle}</h4>
                      {list.map(person => (
                          <div key={person.id} className="flex items-center pl-1 py-0.5">
                            <input id={`sr-p-${person.id}`} type="checkbox" checked={request.helperIds.includes(person.id)} onChange={() => handleHelperToggle(person.id)} className="h-3.5 w-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                            <label htmlFor={`sr-p-${person.id}`} className="ml-2 block text-xs text-gray-900 dark:text-gray-100">{person.name}</label>
                          </div>
                      ))}
                  </div>
                );
            })}
          {groups.length > 0 && <h4 className="form-sticky-header pt-1">Groups</h4>}
          {groups.map(group => (
            <div key={group.id} className="flex items-center pl-1 py-0.5">
              <input id={`sr-g-${group.id}`} type="checkbox" checked={request.helperIds.includes(group.id)} onChange={() => handleHelperToggle(group.id)} className="h-3.5 w-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
              <label htmlFor={`sr-g-${group.id}`} className="ml-2 block text-xs text-gray-900 dark:text-gray-100">{group.name}</label>
            </div>
          ))}
        </div>
      </div>

      <div className="form-actions border-t border-gray-200 dark:border-gray-700 mt-3 pt-3">
        <div>
          {supportRequestToEdit && onDelete && (
            <button type="button" onClick={handleDelete} className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700">Delete</button>
          )}
        </div>
        <div className="flex space-x-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Cancel</button>
          <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">Save</button>
        </div>
      </div>
       {/* Global .input-field styles now centralized in index.css */}
    </form>
  );
};

export default SupportRequestForm;