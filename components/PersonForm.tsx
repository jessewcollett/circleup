import React, { useState, useMemo } from 'react';
import { Person, Group, GiftIdea } from '../types';

interface PersonFormProps {
  onSave: (person: Person) => void;
  onDelete?: (personId: string) => void;
  onClose: () => void;
  personToEdit?: Person;
  circles: string[];
  groups?: Group[];
  allPeople: Person[];
  connectionTypes: string[];
}

const TagInput: React.FC<{
    label: string;
    tags: string[];
    setTags: (tags: string[]) => void;
    suggestions: string[];
}> = ({ label, tags, setTags, suggestions }) => {
    const [inputValue, setInputValue] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);

    const filteredSuggestions = useMemo(() => {
        if (!inputValue) return [];
        return suggestions.filter(s => 
            s.toLowerCase().includes(inputValue.toLowerCase()) && 
            !tags.find(t => t.toLowerCase() === s.toLowerCase())
        ).slice(0, 5);
    }, [inputValue, suggestions, tags]);

    const addTag = (tag: string) => {
        const trimmed = tag.trim();
        if (trimmed && !tags.find(t => t.toLowerCase() === trimmed.toLowerCase())) {
            setTags([...tags, trimmed]);
        }
        setInputValue('');
        setShowSuggestions(false);
    };

    const removeTag = (tagToRemove: string) => {
        setTags(tags.filter(tag => tag !== tagToRemove));
    };

    return (
        <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
            <div className="flex flex-wrap gap-2 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700">
                {tags.map(tag => (
                    <span key={tag} className="flex items-center bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 text-sm font-medium px-2.5 py-0.5 rounded-full">
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)} className="ml-1.5 -mr-1 text-blue-500 hover:text-blue-700">
                            <svg className="h-3 w-3" viewBox="0 0 14 14" fill="currentColor"><path d="M14 1.41L12.59 0L7 5.59L1.41 0L0 1.41L5.59 7L0 12.59L1.41 14L7 8.41L12.59 14L14 12.59L8.41 7L14 1.41z"/></svg>
                        </button>
                    </span>
                ))}
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        setShowSuggestions(true);
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(inputValue); }}}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    className="flex-grow bg-transparent focus:outline-none text-sm p-0.5"
                    placeholder={`+ Add ${label.slice(0,-1)}`}
                />
            </div>
            {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {filteredSuggestions.map(suggestion => (
                        <div
                            key={suggestion}
                            onMouseDown={() => addTag(suggestion)}
                            className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            {suggestion}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const PersonForm: React.FC<PersonFormProps> = ({ onSave, onDelete, onClose, personToEdit, circles, groups, allPeople, connectionTypes }) => {
  const [person, setPerson] = useState<Person>(
    personToEdit || {
      id: '',
      name: '',
      circles: [],
      connectionGoal: { type: connectionTypes[0] || 'Call', frequency: 30 },
      lastConnection: new Date(0).toISOString(), // Default to long ago to appear on dashboard
      interests: [],
      dislikes: [],
      notes: '',
      followUpTopics: '',
      giftIdeas: [],
      birthdate: '',
      isPinned: false,
      showOnDashboard: true,
    }
  );

  const [newGiftText, setNewGiftText] = useState('');
  const [newGiftUrl, setNewGiftUrl] = useState('');

  const allInterests = useMemo(() => Array.from(new Set(allPeople.flatMap(p => p.interests))).sort(), [allPeople]);
  const allDislikes = useMemo(() => Array.from(new Set(allPeople.flatMap(p => p.dislikes))).sort(), [allPeople]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checked = (e.target as HTMLInputElement).checked;

    if (isCheckbox) {
        setPerson(p => ({ ...p, [name]: checked }));
        return;
    }
    if (name === 'goalType' || name === 'goalFrequency') {
      const isFrequency = name === 'goalFrequency';
      setPerson(p => ({
        ...p,
        connectionGoal: {
          ...p.connectionGoal,
          [isFrequency ? 'frequency' : 'type']: isFrequency ? parseInt(value) || 0 : value,
        }
      }));
    } else {
      setPerson(p => ({ ...p, [name]: value }));
    }
  };
  
  const handleCircleToggle = (circle: string) => {
    setPerson(p => ({
        ...p,
        circles: p.circles.includes(circle)
            ? p.circles.filter(c => c !== circle)
            : [...p.circles, circle]
    }));
  };
  
  const addGiftIdea = () => {
      if (!newGiftText.trim()) return;
      const newGift: GiftIdea = {
          id: Date.now().toString(),
          text: newGiftText.trim(),
          url: newGiftUrl.trim() || undefined
      };
      setPerson(p => ({ ...p, giftIdeas: [...(p.giftIdeas || []), newGift] }));
      setNewGiftText('');
      setNewGiftUrl('');
  };
  
  const removeGiftIdea = (id: string) => {
      setPerson(p => ({ ...p, giftIdeas: (p.giftIdeas || []).filter(g => g.id !== id) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!person.name.trim()) return;
    onSave({
      ...person,
      id: personToEdit?.id || Date.now().toString(),
    });
  };
  
  const handleDelete = () => {
    if (onDelete && personToEdit && window.confirm(`Are you sure you want to delete ${personToEdit.name}?`)) {
      onDelete(personToEdit.id);
    }
  }

  const allAvailableCircles = useMemo(() => {
    const combined = new Set([...circles, ...(personToEdit?.circles || [])]);
    return circles.filter(c => combined.has(c));
  }, [circles, personToEdit]);
  
  const personGroups = personToEdit && groups ? groups.filter(g => g.memberIds.includes(personToEdit.id)) : [];
  const isMe = personToEdit?.isMe;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
          <input type="text" id="name" name="name" value={person.name} onChange={handleChange} className="mt-1 input-field" required readOnly={isMe} autoFocus={!personToEdit} />
        </div>
         <div>
          <label htmlFor="birthdate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Birthdate</label>
          <input 
            type="date"
            id="birthdate" 
            name="birthdate" 
            value={person.birthdate ? person.birthdate.split('T')[0] : ''} 
            onChange={handleChange} 
            className="mt-1 input-field" />
        </div>
      </div>

      {!isMe && (
        <>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Circles</label>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                    {allAvailableCircles.map(circle => (
                        <div key={circle} className="flex items-center">
                            <input id={`circle-${circle}`} type="checkbox" checked={person.circles.includes(circle)} onChange={() => handleCircleToggle(circle)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                            <label htmlFor={`circle-${circle}`} className="ml-2 text-sm text-gray-900 dark:text-gray-100">{circle}</label>
                        </div>
                    ))}
                </div>
            </div>
            
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Connection Goal</label>
                <div className="flex items-center space-x-2 mt-1">
                <select name="goalType" value={person.connectionGoal.type} onChange={handleChange} className="input-field w-1/2">
                    {connectionTypes.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
                <span className="text-gray-600 dark:text-gray-400">every</span>
                <input type="number" name="goalFrequency" value={person.connectionGoal.frequency} onChange={handleChange} className="input-field w-1/4" min="1" />
                <span className="text-gray-600 dark:text-gray-400">days</span>
                </div>
            </div>

            {personToEdit && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Groups / Relationships</label>
                    <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-md text-sm text-gray-600 dark:text-gray-400">
                        {personGroups.length > 0 ? personGroups.map(g => g.name).join(', ') : 'Not in any groups yet.'}
                    </div>
                </div>
            )}

            <div>
              <label htmlFor="followUpTopics" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Follow-up Topics</label>
              <textarea id="followUpTopics" name="followUpTopics" value={person.followUpTopics} onChange={handleChange} rows={2} className="mt-1 input-field" placeholder="e.g., Ask about their new project at work"/>
            </div>
        </>
      )}
      
      <div className="space-y-4">
        <TagInput label="Interests" tags={person.interests} setTags={tags => setPerson(p => ({ ...p, interests: tags }))} suggestions={allInterests} />
        <TagInput label="Dislikes" tags={person.dislikes} setTags={tags => setPerson(p => ({ ...p, dislikes: tags }))} suggestions={allDislikes} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Gift Ideas</label>
        <div className="mt-1 space-y-2">
            {(person.giftIdeas || []).map(gift => (
                <div key={gift.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                    {gift.url ? (
                        <a href={gift.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">{gift.text}</a>
                    ) : (
                        <span>{gift.text}</span>
                    )}
                    <button type="button" onClick={() => removeGiftIdea(gift.id)} className="text-red-500 hover:text-red-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
            <input type="text" value={newGiftText} onChange={e => setNewGiftText(e.target.value)} placeholder="Gift Name" className="input-field flex-grow"/>
            <input type="url" value={newGiftUrl} onChange={e => setNewGiftUrl(e.target.value)} placeholder="URL (optional)" className="input-field flex-grow"/>
            <button type="button" onClick={addGiftIdea} className="px-3 py-2 bg-gray-200 dark:bg-gray-600 text-sm rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 whitespace-nowrap">Add Gift</button>
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes (Dietary, etc.)</label>
        <textarea id="notes" name="notes" value={person.notes} onChange={handleChange} rows={3} className="mt-1 input-field" />
      </div>
      
      {!isMe && (
        <div className="pt-2 space-y-2">
          <div className="flex items-center">
              <input id="isPinned" name="isPinned" type="checkbox" checked={!!person.isPinned} onChange={handleChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
              <label htmlFor="isPinned" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">Pin this person</label>
          </div>
          <div className="flex items-center">
              <input id="showOnDashboard" name="showOnDashboard" type="checkbox" checked={person.showOnDashboard !== false} onChange={handleChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
              <label htmlFor="showOnDashboard" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">Show on Dashboard for reminders</label>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center pt-4">
        <div>
           {personToEdit && onDelete && !isMe && (
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

export default PersonForm;