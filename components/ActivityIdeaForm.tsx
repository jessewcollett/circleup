import React, { useState, useMemo } from 'react';
import { Person, Group } from '../types';
import { GoogleGenAI } from '@google/genai';

interface ActivityIdeaFormProps {
  people: Person[];
  groups: Group[];
  onClose: () => void;
  circles: string[];
}

type IdeaType = 'Activity' | 'Gift' | 'Food Recommendation';

const SimpleMarkdownRenderer = ({ content }: { content: string }) => {
  const html = content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
    .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italics
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">$1</a>') // Links
    .replace(/^\s*[\-\*]\s(.*)/gm, '<li class="ml-4 list-disc">$1</li>') // List items
    .replace(/(<\/li><li)/g, '</li><li') // remove extra space between li
    .replace(/(<li.*<\/li>)/gs, '<ul>$1</ul>') // Wrap lists
    .replace(/\n/g, '<br />');

  return <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html.replace(/<br \/>/g, '') }} />;
};


const ActivityIdeaForm: React.FC<ActivityIdeaFormProps> = ({ people, groups, onClose, circles }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [ideaType, setIdeaType] = useState<IdeaType>('Activity');
  const [customPrompt, setCustomPrompt] = useState('');
  const [location, setLocation] = useState('');
  const [result, setResult] = useState<string>('');
  const [sources, setSources] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(currentId => currentId !== id) : [...prev, id]
    );
  };
  
  const generateIdeas = async () => {
    if (selectedIds.length === 0) {
      setError("Please select at least one person or group.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult('');
    setSources([]);
    
    let participantProfiles = '';
    const involvedPeople: Person[] = [];
    const meProfile = people.find(p => p.isMe);
    
    if (meProfile) {
        involvedPeople.push(meProfile);
    }
    
    selectedIds.forEach(id => {
        const person = people.find(p => p.id === id);
        if (person && !involvedPeople.some(p => p.id === person.id)) involvedPeople.push(person);
        const group = groups.find(g => g.id === id);
        if (group) {
            group.memberIds.forEach(memberId => {
                const member = people.find(p => p.id === memberId);
                if (member && !involvedPeople.some(p => p.id === member.id)) involvedPeople.push(member);
            });
        }
    });
    
    participantProfiles = involvedPeople.map(p => 
        `Person: ${p.name}\n- Interests: ${p.interests.join(', ')}\n- Dislikes: ${p.dislikes.join(', ')}\n- Notes (e.g., dietary): ${p.notes}\n- Gift Ideas: ${p.giftIdeas?.map(g => g.text).join(', ') || 'None'}\n- Birthdate: ${p.birthdate}`
    ).join('\n\n');

    let tools: any[] = [];
    let promptInstruction = '';
    
    if (ideaType === 'Food Recommendation' || ideaType === 'Activity') {
        tools = [{googleMaps: {}}];
        promptInstruction = 'For any locations, restaurants, or businesses you recommend, please provide a hyperlink to it on Google Maps.';
    } else if (ideaType === 'Gift') {
        tools = [{googleSearch: {}}];
        promptInstruction = 'For any gift ideas you suggest, please provide a hyperlink to a Google Search for that item.';
    }

    try {
      if (!process.env.API_KEY) throw new Error("API_KEY environment variable not set.");
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const prompt = `
        You are an assistant for helping plan social activities and gifts.
        Based on the following profiles, generate a concise list of ${ideaType} ideas.
        Format the output as a clean markdown list.
        ${promptInstruction}

        **Profiles:**
        ${participantProfiles}

        **Request:**
        Generate ideas for: ${ideaType}
        Location: ${location || 'No specific location provided'}
        ${customPrompt ? `Additional context: ${customPrompt}` : ''}
      `;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          tools: tools,
        },
      });

      setResult(response.text);
      if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        setSources(response.candidates[0].groundingMetadata.groundingChunks);
      }

    } catch (e: any) {
      setError(`Failed to generate ideas: ${e.message}`);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };
  
  const groupedPeople = useMemo(() => {
    const peopleByCircle: Record<string, Person[]> = {};
    const peopleToGroup = people.filter(p => !p.isMe);
    
    circles.forEach(circle => {
        const peopleInCircle = peopleToGroup.filter(p => p.circles.includes(circle)).sort((a, b) => a.name.localeCompare(b.name));
        if (peopleInCircle.length > 0) {
            peopleByCircle[circle] = peopleInCircle;
        }
    });

    const uncategorized = peopleToGroup.filter(p => p.circles.length === 0).sort((a, b) => a.name.localeCompare(b.name));
    if (uncategorized.length > 0) {
        peopleByCircle['Uncategorized'] = uncategorized;
    }

    return peopleByCircle;
  }, [people, circles]);

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        <div>
          <label htmlFor="ideaType" className="form-label">What do you need ideas for?</label>
          <select
            id="ideaType"
            value={ideaType}
            onChange={(e) => setIdeaType(e.target.value as IdeaType)}
            className="input-field"
          >
            <option value="">Select type...</option>
            <option value="Activity">Activity</option>
            <option value="Food Recommendation">Food Recommendation</option>
            <option value="Gift">Gift</option>
          </select>
        </div>

        {(ideaType === 'Activity' || ideaType === 'Food Recommendation') && (
          <div className="animate-fadeIn">
            <label htmlFor="location" className="form-label">Where should we look for ideas?</label>
            <input
              type="text"
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., San Francisco, CA"
              className="input-field"
            />
          </div>
        )}
      </div>

       <div className="form-section-tight">
        <label className="form-label">Who is this for? ("Me" is included by default)</label>
        <div className="form-scroll-box mt-1 max-h-40">
            {Object.entries(groupedPeople).map(([circle, members]) => {
                const list = members as Person[];
                return (
                  <div key={circle}>
                      <h4 className="form-sticky-header">{circle}</h4>
                      {list.map(person => (
                          <div key={person.id} className="flex items-center pl-1 py-0.5">
                              <input id={`ai-p-${person.id}`} type="checkbox" checked={selectedIds.includes(person.id)} onChange={() => handleToggle(person.id)} className="h-3.5 w-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                              <label htmlFor={`ai-p-${person.id}`} className="ml-2 block text-xs text-gray-900 dark:text-gray-100">{person.name}</label>
                          </div>
                      ))}
                  </div>
                );
            })}
             {groups.length > 0 && <h4 className="form-sticky-header pt-1">Groups</h4>}
            {groups.map(group => (
                 <div key={group.id} className="flex items-center pl-1 py-0.5">
                    <input id={`ai-g-${group.id}`} type="checkbox" checked={selectedIds.includes(group.id)} onChange={() => handleToggle(group.id)} className="h-3.5 w-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                    <label htmlFor={`ai-g-${group.id}`} className="ml-2 block text-xs text-gray-900 dark:text-gray-100">{group.name}</label>
                </div>
            ))}
        </div>
      </div>
      
      <div>
        <label htmlFor="customPrompt" className="form-label">Additional Details (optional)</label>
        <input type="text" id="customPrompt" value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} placeholder="e.g., for a birthday, near downtown" className="input-field" />
      </div>
      
      <div className="flex justify-end pt-1">
        <button onClick={generateIdeas} disabled={isLoading || selectedIds.length === 0} className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 disabled:bg-gray-400">
            {isLoading ? 'Generating...' : 'Get Ideas'}
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}      {result && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Suggestions</h3>
             <SimpleMarkdownRenderer content={result} />
            {sources.length > 0 && (
                <div className="mt-4 pt-2 border-t border-gray-200 dark:border-gray-600">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Sources</h4>
                    <ul className="text-xs space-y-1 mt-1">
                        {sources.map((chunk, index) => (
                            <li key={index}>
                                <a href={chunk.web?.uri || chunk.maps?.uri} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                    {chunk.web?.title || chunk.maps?.title || 'Source'}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
      )}
      {/* Global .input-field + .animate-fadeIn styles now centralized in index.css */}
    </div>
  );
};export default ActivityIdeaForm;