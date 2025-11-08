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
    <div className="space-y-4">
      <div>
        <label htmlFor="ideaType" className="block text-sm font-medium text-gray-700 dark:text-gray-300">What do you need ideas for?</label>
        <select id="ideaType" value={ideaType} onChange={(e) => setIdeaType(e.target.value as IdeaType)} className="mt-1 input-field">
          <option>Activity</option>
          <option>Gift</option>
          <option>Food Recommendation</option>
        </select>
      </div>

       <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Who is this for? ("Me" is included by default)</label>
        <div className="mt-2 max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md p-2 space-y-1">
            {Object.entries(groupedPeople).map(([circle, members]) => (
                <div key={circle}>
                    <h4 className="font-semibold text-xs uppercase text-gray-500 dark:text-gray-400 py-1 sticky top-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">{circle}</h4>
                    {members.map(person => (
                        <div key={person.id} className="flex items-center pl-2 py-0.5">
                            <input id={`ai-p-${person.id}`} type="checkbox" checked={selectedIds.includes(person.id)} onChange={() => handleToggle(person.id)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                            <label htmlFor={`ai-p-${person.id}`} className="ml-3 block text-sm text-gray-900 dark:text-gray-100">{person.name}</label>
                        </div>
                    ))}
                </div>
            ))}
             {groups.length > 0 && <h4 className="font-semibold text-xs uppercase text-gray-500 dark:text-gray-400 pt-2 sticky top-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">Groups</h4>}
            {groups.map(group => (
                 <div key={group.id} className="flex items-center pl-2 py-0.5">
                    <input id={`ai-g-${group.id}`} type="checkbox" checked={selectedIds.includes(group.id)} onChange={() => handleToggle(group.id)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                    <label htmlFor={`ai-g-${group.id}`} className="ml-3 block text-sm text-gray-900 dark:text-gray-100">{group.name}</label>
                </div>
            ))}
        </div>
      </div>
      
      <div>
        <label htmlFor="customPrompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Additional Details (optional)</label>
        <input type="text" id="customPrompt" value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} placeholder="e.g., for a birthday, near downtown" className="mt-1 input-field" />
      </div>
      
      <div className="flex justify-end pt-2">
        <button onClick={generateIdeas} disabled={isLoading || selectedIds.length === 0} className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400">
            {isLoading ? 'Generating...' : 'Get Ideas'}
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

      {result && (
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
      <style>{`.input-field { display: block; width: 100%; min-width: 0; padding: 0.5rem 0.75rem; background-color: white; border: 1px solid #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); font-size: 1rem; color: #111827; } .dark .input-field { background-color: #374151; border-color: #4B5563; color: #F9FAFB; } .dark .input-field:focus { outline: none; ring: 2px; ring-color: #3B82F6; border-color: #3B82F6; }`}</style>
    </div>
  );
};

export default ActivityIdeaForm;