import React from 'react';

export interface ConnectionGoal {
  type: string;
  frequency: number; // in days
}

export interface GiftIdea {
  id: string;
  text: string;
  url?: string;
}

export interface Person {
  id: string;
  name: string;
  circles: string[];
  connectionGoal: ConnectionGoal;
  lastConnection: string; // ISO date string
  interests: string[];
  dislikes: string[];
  notes: string; // For dietary needs, etc.
  followUpTopics?: string;
  giftIdeas?: GiftIdea[];
  birthdate?: string; // 'YYYY-MM-DD'
  isPinned?: boolean;
  pinOrder?: number; // For custom sorting of pinned people
  isMe?: boolean;
  snoozedUntil?: string; // ISO date string
  showOnDashboard?: boolean;
}

export interface Group {
  id:string;
  name: string;
  memberIds: string[];
  connectionGoal: ConnectionGoal;
  lastConnection: string; // ISO date string
  anniversary?: string; // 'YYYY-MM-DD'
  isPinned?: boolean;
  snoozedUntil?: string; // ISO date string
  showOnDashboard?: boolean;
}

export interface Interaction {
  id: string;
  date: string; // ISO date string
  type?: string; // e.g., 'Call', 'Text', 'Visit'
  notes: string;
  personIds: string[];
  groupIds: string[];
}

export interface Activity {
  id: string;
  title: string;
  date?: string; // ISO date string, now optional for TBD
  notes: string;
  participantIds: string[]; // Can contain Person or Group IDs
}

export interface SupportRequest {
  id: string;
  name: string;
  helperIds: string[]; // Can be Person or Group IDs
}

export interface AskHistoryEntry {
  id: string;
  supportRequestId: string;
  helperId: string; // The Person or Group ID that was asked
  date: string; // ISO date string
}


export type ModalType = 
  | 'add-person' 
  | 'edit-person'
  | 'add-group'
  | 'edit-group'
  | 'log-interaction'
  | 'edit-interaction'
  | 'plan-activity'
  | 'edit-activity'
  | 'ai-generator'
  | 'settings'
  | 'add-support-request'
  | 'edit-support-request'
  | 'info'
  | null;