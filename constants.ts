import { Person, Group, Interaction, Activity, SupportRequest } from './types';

export const DEFAULT_CIRCLES: string[] = ["Family", "Friend", "Work", "Neighbor"];
export const DEFAULT_CONNECTION_TYPES: string[] = ["Call", "Text", "Visit", "Hang out", "Meal", "Activity"];

export const INITIAL_PEOPLE: Person[] = [
  {
    id: 'me',
    name: 'Me',
    circles: [],
    connectionGoal: { type: 'Self-care', frequency: 7 },
    lastConnection: new Date().toISOString(),
    interests: ['Reading', 'Coding', 'Coffee'],
    dislikes: ['Traffic'],
    notes: 'My own profile!',
    isMe: true,
    giftIdeas: [],
    showOnDashboard: false,
  },
  { 
    id: '1', 
    name: 'Grandma', 
    circles: ['Family'], 
    connectionGoal: { type: 'Call', frequency: 30 },
    lastConnection: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 days ago
    interests: ['Gardening', 'Knitting', 'Watching classic movies'],
    dislikes: ['Loud noises', 'Cold weather'],
    notes: 'Loves hearing about my work.',
    followUpTopics: 'Ask about her new rose bush.',
    giftIdeas: [
        { id: 'g1-1', text: 'A new knitting pattern book' },
        { id: 'g1-2', text: 'A special blend of tea' }
    ],
    birthdate: '1945-10-26',
    showOnDashboard: true,
  },
  { 
    id: '2', 
    name: 'Alex', 
    circles: ['Friend', 'Work'], 
    connectionGoal: { type: 'Hang out', frequency: 14 },
    lastConnection: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
    interests: ['Video games', 'Board games', 'Trying new breweries'],
    dislikes: ['Waking up early', 'Cilantro'],
    notes: 'Vegan',
    followUpTopics: 'How did the presentation for the "Project X" go?',
    giftIdeas: [
      { id: 'g2-1', text: 'A new board game (maybe cooperative)' },
      { id: 'g2-2', text: 'Gift card to a brewery' }
    ],
    birthdate: '1992-05-15',
    showOnDashboard: true,
  },
    { 
    id: '3', 
    name: 'Beth', 
    circles: ['Friend'], 
    connectionGoal: { type: 'Meal', frequency: 21 },
    lastConnection: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(), // 25 days ago
    interests: ['Hiking', 'Photography', 'Local music scene'],
    dislikes: ['Crowded places'],
    notes: 'Gluten-free',
    followUpTopics: '',
    giftIdeas: [
      { id: 'g3-1', text: 'A cool camera strap' },
      { id: 'g3-2', text: 'A book about a famous photographer' }
    ],
    birthdate: '1993-11-08',
    showOnDashboard: true,
  },
];

export const INITIAL_GROUPS: Group[] = [
    { 
      id: 'g1', 
      name: 'Alex & Beth',
      memberIds: ['2', '3'],
      connectionGoal: { type: 'Hang out', frequency: 30 },
      lastConnection: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(), // 25 days ago
      anniversary: '2021-06-12',
      isPinned: true,
      showOnDashboard: true,
    },
];

export const INITIAL_INTERACTIONS: Interaction[] = [];
export const INITIAL_ACTIVITIES: Activity[] = [
    { id: 'a1', title: 'Hike', date: undefined, notes: 'Need to schedule this soon.', participantIds: ['3'] }
];
export const INITIAL_SUPPORT_REQUESTS: SupportRequest[] = [
    { id: 'sr1', name: 'Watch the dog', helperIds: ['1', 'g1'] },
    { id: 'sr2', name: 'Ride to the airport', helperIds: ['2'] }
];
export const INITIAL_ASK_HISTORY: any[] = [];