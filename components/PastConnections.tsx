import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Interaction, Person, Group } from '../types';

interface PastConnectionsProps {
  interactions: Interaction[];
  people: Person[];
  groups: Group[];
  onDeleteInteraction: (interactionId: string) => void;
  onEditInteraction: (interaction: Interaction) => void;
}

const PastConnections: React.FC<PastConnectionsProps> = ({
  interactions,
  people,
  groups,
  onDeleteInteraction,
  onEditInteraction,
}) => {
  const [isTimelineCollapsed, setIsTimelineCollapsed] = useState(true);
  const [areFiltersVisible, setAreFiltersVisible] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const menuRef = useRef<HTMLDivElement>(null);

  const findNameById = (id: string) => people.find(p => p.id === id)?.name || groups.find(g => g.id === id)?.name || 'Unknown';

  const filteredAndSortedInteractions = useMemo(() => {
    return interactions
      .filter(interaction => {
        const interactionDate = new Date(interaction.date);
        interactionDate.setUTCHours(0,0,0,0);
        
        if (startDate) {
            const filterStartDate = new Date(startDate);
            filterStartDate.setUTCHours(0,0,0,0);
            if(interactionDate < filterStartDate) return false;
        }
        if (endDate) {
            const filterEndDate = new Date(endDate);
            filterEndDate.setUTCHours(0,0,0,0);
            if (interactionDate > filterEndDate) return false;
        }
        
        if (searchTerm) {
          const lowerSearchTerm = searchTerm.toLowerCase();
          const participants = [...interaction.personIds, ...interaction.groupIds].map(findNameById).join(', ').toLowerCase();
          const notes = interaction.notes.toLowerCase();
          const type = (interaction.type || '').toLowerCase();
          
          return participants.includes(lowerSearchTerm) || notes.includes(lowerSearchTerm) || type.includes(lowerSearchTerm);
        }
        
        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateB !== dateA) {
            return dateB - dateA;
        }
        return parseInt(b.id) - parseInt(a.id);
      });
  }, [interactions, startDate, endDate, searchTerm, people, groups]);

  const toggleMenu = (interactionId: string) => {
    setActiveMenuId(prev => (prev === interactionId ? null : interactionId));
  };
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <section>
      <div className="flex justify-between items-center mb-4">
        <h2 
          className="text-xl font-semibold cursor-pointer flex items-center gap-2"
          onClick={() => setIsTimelineCollapsed(!isTimelineCollapsed)}
        >
          Past Connections
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${isTimelineCollapsed ? '-rotate-90' : ''}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </h2>
        <button 
          onClick={() => setAreFiltersVisible(!areFiltersVisible)}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
          aria-label="Toggle filters"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
          </svg>
        </button>
      </div>
      
      {areFiltersVisible && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4 space-y-4">
          <input
            type="text"
            placeholder="Search notes, people..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="input-field"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
              <input 
                type="date"
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
                className="mt-1 input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
              <input 
                type="date"
                value={endDate} 
                onChange={e => setEndDate(e.target.value)} 
                className="mt-1 input-field"
              />
            </div>
          </div>
          <style>{`.input-field { display: block; width: 100%; min-width: 0; padding: 0.5rem 0.75rem; background-color: white; border: 1px solid #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); font-size: 1rem; color: #111827; } .dark .input-field { background-color: #374151; border-color: #4B5563; color: #F9FAFB; } .dark .input-field:focus { outline: none; ring: 2px; ring-color: #3B82F6; border-color: #3B82F6; }`}</style>
        </div>
      )}
      
      {!isTimelineCollapsed && (
        <div className="relative">
          {filteredAndSortedInteractions.length > 0 ? (
            <ul className="space-y-8">
              {filteredAndSortedInteractions.map((interaction, index) => {
                const participants = [...interaction.personIds, ...interaction.groupIds].map(findNameById).join(', ');
                const isLastItem = index === filteredAndSortedInteractions.length - 1;
                return (
                  <li key={interaction.id} className="relative pl-8">
                    {!isLastItem && <div className="absolute left-3 top-1 bottom-[-2rem] w-0.5 bg-gray-300 dark:bg-gray-600"></div>}
                    <div className="absolute left-0 top-1 h-6 w-6 bg-blue-500 rounded-full flex items-center justify-center ring-4 ring-gray-100 dark:ring-gray-900">
                      <div className="h-2 w-2 bg-white rounded-full"></div>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                       <div className="flex justify-between items-start">
                         <div>
                            <p className="font-semibold">{interaction.type || 'Connection'} with {participants}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {new Date(interaction.date).toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                          </div>
                          <div className="relative" ref={activeMenuId === interaction.id ? menuRef : null}>
                            <button
                              onClick={() => toggleMenu(interaction.id)}
                              className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                              aria-label="More options"
                            >
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                 <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                               </svg>
                            </button>
                            {activeMenuId === interaction.id && (
                              <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-700 rounded-md shadow-lg z-10 ring-1 ring-black ring-opacity-5">
                                <button
                                  onClick={() => {
                                    onEditInteraction(interaction);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                  Edit
                                </button>
                                <button
                                  onClick={() => {
                                    onDeleteInteraction(interaction.id);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                       </div>
                       {interaction.notes && <p className="text-sm mt-2 text-gray-600 dark:text-gray-300 italic">"{interaction.notes}"</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center text-gray-600 dark:text-gray-400">
              No connections logged yet, or none match your filters.
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default PastConnections;