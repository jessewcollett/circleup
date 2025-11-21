import { Person, Group, Interaction, Activity, SupportRequest, AskHistoryEntry } from './types';

export const DEFAULT_CIRCLES: string[] = ["Family", "Friend", "Work", "Neighbor"];
export const DEFAULT_CONNECTION_TYPES: string[] = ["Call", "Text", "Visit", "Hang out", "Meal", "Activity"];
export const DEFAULT_REMINDER_LOOKAHEAD: number = 7; // days

// Onboarding feature flag and versioning
export const ONBOARDING_ENABLED = true; // Flip to false to quickly disable the tour
export const ONBOARDING_VERSION = 1; // Increment to re-run tour for everyone

export const INITIAL_PEOPLE: Person[] = [
  {
    id: 'me',
    name: 'Me',
    circles: [],
    connectionGoal: { type: 'Self-care', frequency: 7 },
    lastConnection: new Date().toISOString(),
    interests: [],
    dislikes: [],
    notes: 'My own profile!',
    isMe: true,
    giftIdeas: [],
    reminders: [],
    showOnDashboard: false
  }
];

export const INITIAL_GROUPS: Group[] = [];

export const INITIAL_INTERACTIONS: Interaction[] = [];

export const INITIAL_ACTIVITIES: Activity[] = [];

export const INITIAL_SUPPORT_REQUESTS: SupportRequest[] = [];

export const INITIAL_ASK_HISTORY: AskHistoryEntry[] = [];