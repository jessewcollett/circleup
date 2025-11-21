import React, { useState, useMemo } from 'react';
import { Person, Group, GiftIdea, Reminder } from '../types';

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
            <label className="form-label">{label}</label>
            <div className="flex flex-wrap gap-1.5 p-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700">
                {tags.map(tag => (
                    <span key={tag} className="flex items-center bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 text-xs font-medium px-2 py-0.5 rounded-full">
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)} className="ml-1 -mr-0.5 text-blue-500 hover:text-blue-700">
                            <svg className="h-2.5 w-2.5" viewBox="0 0 14 14" fill="currentColor"><path d="M14 1.41L12.59 0L7 5.59L1.41 0L0 1.41L5.59 7L0 12.59L1.41 14L7 8.41L12.59 14L14 12.59L8.41 7L14 1.41z"/></svg>
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
                    className="flex-grow bg-transparent focus:outline-none text-xs p-0.5"
                    placeholder={`+ Add ${label.slice(0,-1)}`}
                />
            </div>
            {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-32 overflow-y-auto">
                    {filteredSuggestions.map(suggestion => (
                        <div
                            key={suggestion}
                            onMouseDown={() => addTag(suggestion)}
                            className="px-2.5 py-1.5 text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
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
      connectionGoal: { type: connectionTypes[0] || 'Call', frequency: 30 },
      lastConnection: new Date(0).toISOString(), // Default to long ago to appear on dashboard
      interests: [],
      dislikes: [],
      notes: '',
      followUpTopics: '',
      giftIdeas: [],
      reminders: [],
      birthdate: '',
      isPinned: false,
      showOnDashboard: true,
    }
  );

  // Birthdate input handling (allows MM/DD or MM/DD/YYYY with validation)
  const formatBirthdateForInput = (bd?: string) => {
    if (!bd) return '';
    if (bd.startsWith('--')) {
      const parts = bd.substring(2).split('-');
      if (parts.length === 2) return `${parts[0]}/${parts[1]}`;
      return '';
    }
    const parts = bd.split('-');
    if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0]}`;
    return '';
  };

  const [birthdateInput, setBirthdateInput] = useState<string>(formatBirthdateForInput(person.birthdate));
  const [birthdateError, setBirthdateError] = useState<string>('');

  const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const maxDayForMonth = (month: number, year?: number) => {
    if ([1,3,5,7,8,10,12].includes(month)) return 31;
    if ([4,6,9,11].includes(month)) return 30;
    // February: if year provided and leap, 29; if year not provided, default 28 (user requested)
    if (month === 2) return year ? (isLeapYear(year) ? 29 : 28) : 28;
    return 31;
  };

  const parseBirthdateInput = (value: string): { canon: string | null; error: string } => {
    const cleaned = value.replace(/\s+/g, '');
    if (!cleaned) return { canon: '', error: '' };
    const parts = cleaned.split('/');
    if (parts.length < 2 || parts.length > 3) return { canon: null, error: 'Use MM/DD or MM/DD/YYYY' };
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    if (isNaN(month) || month < 1 || month > 12) return { canon: null, error: 'Invalid month' };
    if (isNaN(day) || day < 1) return { canon: null, error: 'Invalid day' };

    if (parts.length === 2) {
      // No year
      const md = maxDayForMonth(month);
      if (day > md) return { canon: null, error: `Day must be ≤ ${md} for this month` };
      const mm = month.toString().padStart(2, '0');
      const dd = day.toString().padStart(2, '0');
      return { canon: `--${mm}-${dd}`, error: '' };
    }

    const year = parseInt(parts[2], 10);
    if (isNaN(year) || parts[2].length !== 4 || year < 1900 || year > new Date().getFullYear()) {
      return { canon: null, error: 'Invalid year' };
    }
    const md = maxDayForMonth(month, year);
    if (day > md) return { canon: null, error: `Day must be ≤ ${md} for this month/year` };
    const mm = month.toString().padStart(2, '0');
    const dd = day.toString().padStart(2, '0');
    return { canon: `${year}-${mm}-${dd}`, error: '' };
  };

  const [newGiftText, setNewGiftText] = useState('');
  const [newGiftUrl, setNewGiftUrl] = useState('');
  const [newReminderText, setNewReminderText] = useState('');
  const [newReminderDate, setNewReminderDate] = useState('');

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
          [isFrequency ? 'frequency' : 'type']: isFrequency
            ? value === ''
              ? ''
              : parseInt(value)
            : value,
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

  const addReminder = () => {
      if (!newReminderText.trim() || !newReminderDate) return;
      const newReminder: Reminder = {
          id: Date.now().toString(),
          text: newReminderText.trim(),
          date: newReminderDate,
          completed: false
      };
      setPerson(p => ({ ...p, reminders: [...(p.reminders || []), newReminder] }));
      setNewReminderText('');
      setNewReminderDate('');
  };

  const toggleReminderCompleted = (id: string) => {
      setPerson(p => ({
          ...p,
          reminders: (p.reminders || []).map(r => r.id === id ? { ...r, completed: !r.completed } : r)
      }));
  };

  const removeReminder = (id: string) => {
      setPerson(p => ({ ...p, reminders: (p.reminders || []).filter(r => r.id !== id) }));
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
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="name" className="form-label">Name</label>
          <input type="text" id="name" name="name" value={person.name} onChange={handleChange} className="input-field" required autoFocus={!personToEdit} />
        </div>
         <div>
          <label htmlFor="birthdate" className="form-label">Birthdate</label>
          <input 
            type="text"
            id="birthdate" 
            name="birthdate" 
            placeholder="MM/DD or MM/DD/YYYY"
            value={birthdateInput}
            onChange={(e) => {
              const val = e.target.value.replace(/[^\d\/]/g, '');
              setBirthdateInput(val);
              const parsed = parseBirthdateInput(val);
              setBirthdateError(parsed.error);
              if (parsed.canon !== null) {
                setPerson(p => ({ ...p, birthdate: parsed.canon || '' }));
              }
            }}
            className="input-field" 
          />
          {birthdateError && <p className="form-error">{birthdateError}</p>}
        </div>
      </div>

      {!isMe && (
        <div className="form-section-tight">
          <label className="form-label">
            Connection Goal
          </label>
          <div className="flex items-center space-x-2 mt-1">
            <select name="goalType" value={person.connectionGoal.type} onChange={handleChange} className="input-field w-1/2">
              {connectionTypes.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
            <span className="text-gray-600 dark:text-gray-400">every</span>
            <input type="number" name="goalFrequency" value={person.connectionGoal.frequency} onChange={handleChange} className="input-field w-1/4" min="1" />
            <span className="text-gray-600 dark:text-gray-400">days</span>
          </div>
        </div>
      )}

      {!isMe && (
        <>
            <div className="form-section-tight">
                <label className="form-label">Circles</label>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1.5">
                    {allAvailableCircles.map(circle => (
                        <div key={circle} className="flex items-center">
                            <input id={`circle-${circle}`} type="checkbox" checked={person.circles.includes(circle)} onChange={() => handleCircleToggle(circle)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                            <label htmlFor={`circle-${circle}`} className="ml-1.5 text-xs text-gray-900 dark:text-gray-100">{circle}</label>
                        </div>
                    ))}
                </div>
            </div>

            {personToEdit && (
                <div className="form-section-tight">
                    <label className="form-label">Groups / Relationships</label>
                    <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-md text-xs text-gray-600 dark:text-gray-400">
                        {personGroups.length > 0 ? personGroups.map(g => g.name).join(', ') : 'Not in any groups yet.'}
                    </div>
                </div>
            )}
        </>
      )}
      
      <div className="space-y-3">
        <TagInput label="Interests" tags={person.interests} setTags={tags => setPerson(p => ({ ...p, interests: tags }))} suggestions={allInterests} />
        <TagInput label="Dislikes" tags={person.dislikes} setTags={tags => setPerson(p => ({ ...p, dislikes: tags }))} suggestions={allDislikes} />
      </div>

      <div className="form-section-tight">
        <label className="form-label">Gift Ideas</label>
        <div className="mt-1 space-y-1.5">
            {(person.giftIdeas || []).map(gift => (
                <div key={gift.id} className="flex justify-between items-center text-xs p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">
                    {gift.url ? (
                        <a href={gift.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">{gift.text}</a>
                    ) : (
                        <span className="text-gray-900 dark:text-gray-100">{gift.text}</span>
                    )}
                    <button type="button" onClick={() => removeGiftIdea(gift.id)} className="text-red-500 hover:text-red-700 ml-2 flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            ))}
        </div>
        <div className="mt-1.5 flex items-stretch gap-1.5">
            <input type="text" value={newGiftText} onChange={e => setNewGiftText(e.target.value)} placeholder="Gift Name" className="input-field flex-grow"/>
            <input type="url" value={newGiftUrl} onChange={e => setNewGiftUrl(e.target.value)} placeholder="URL" className="input-field flex-grow"/>
            <button type="button" onClick={addGiftIdea} className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 whitespace-nowrap">Add</button>
        </div>
      </div>

    {!isMe && (
      <div className="space-y-3">
        <div className="form-section-tight">
          <label className="form-label">Reminders & Follow-ups</label>
          <div className="mt-1 space-y-1.5">
            {(person.reminders || []).map(reminder => (
              <div key={reminder.id} className="flex justify-between items-center text-xs p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">
                <div className="flex items-center gap-1.5 flex-grow min-w-0">
                  <input
                    type="checkbox"
                    checked={reminder.completed || false}
                    onChange={() => toggleReminderCompleted(reminder.id)}
                    className="h-3.5 w-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 flex-shrink-0"
                  />
                  <span className={reminder.completed ? 'line-through text-gray-500 dark:text-gray-400 truncate' : 'text-gray-900 dark:text-gray-100 truncate'}>{reminder.text}</span>
                  <span className="text-[0.65rem] text-gray-500 dark:text-gray-400 flex-shrink-0">({reminder.date})</span>
                </div>
                <button type="button" onClick={() => removeReminder(reminder.id)} className="text-red-500 hover:text-red-700 ml-2 flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex items-stretch gap-1.5">
            <input type="text" value={newReminderText} onChange={e => setNewReminderText(e.target.value)} placeholder="Reminder" className="input-field flex-1 min-w-0"/>
            <div className="relative flex-1 min-w-0">
              <input 
                type="date" 
                value={newReminderDate} 
                onChange={e => setNewReminderDate(e.target.value)} 
                className="input-field absolute inset-0"
              />
              {!newReminderDate && (
                <div className="absolute inset-0 flex items-center px-3 pointer-events-none text-gray-400 dark:text-gray-500 text-sm">
                  Date
                </div>
              )}
            </div>
            <button type="button" onClick={addReminder} className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 whitespace-nowrap">Add</button>
          </div>
        </div>
        
        <div className="form-section-tight">
          <label htmlFor="followUpTopics" className="form-label">Follow-up Topics</label>
          <textarea id="followUpTopics" name="followUpTopics" value={person.followUpTopics} onChange={handleChange} rows={3} className="input-field" placeholder="e.g., Ask about their new project at work"/>
        </div>
      </div>
    )}

      <div className="form-section-tight">
        <label htmlFor="notes" className="form-label">Notes (Dietary, etc.)</label>
        <textarea id="notes" name="notes" value={person.notes} onChange={handleChange} rows={2} className="input-field" />
      </div>
      
      <div className="pt-1.5 space-y-1.5">
        {!isMe && (
          <>
            <div className="flex items-center">
                <input id="isPinned" name="isPinned" type="checkbox" checked={!!person.isPinned} onChange={handleChange} className="h-3.5 w-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                <label htmlFor="isPinned" className="ml-1.5 block text-xs text-gray-900 dark:text-gray-100">Pin this person</label>
            </div>
            <div className="flex items-center">
                <input id="showOnDashboard" name="showOnDashboard" type="checkbox" checked={person.showOnDashboard !== false} onChange={handleChange} className="h-3.5 w-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                <label htmlFor="showOnDashboard" className="ml-1.5 block text-xs text-gray-900 dark:text-gray-100">Show on Dashboard for reminders</label>
            </div>
          </>
        )}
      </div>

      <div className="form-actions border-t border-gray-200 dark:border-gray-700 mt-3 pt-3">
        <div>
           {personToEdit && onDelete && !isMe && (
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

export default PersonForm;