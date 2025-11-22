import React, { useState, useEffect, useMemo, useRef } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { LoginPage } from './components/LoginPage';
import LoginScreen from './components/LoginScreen';
import OnboardingController from './components/OnboardingController';
import { Person, Group, Interaction, Activity, ModalType, SupportRequest, AskHistoryEntry } from './types';
import { INITIAL_PEOPLE, INITIAL_GROUPS, INITIAL_INTERACTIONS, INITIAL_ACTIVITIES, DEFAULT_CIRCLES, INITIAL_SUPPORT_REQUESTS, INITIAL_ASK_HISTORY, DEFAULT_CONNECTION_TYPES, DEFAULT_REMINDER_LOOKAHEAD } from './constants';
import Modal from './components/Modal';
import PersonForm from './components/PersonForm';
import GroupForm from './components/GroupForm';
import InteractionForm from './components/InteractionForm';
import ActivityForm from './components/ActivityForm';
import ActivityIdeaForm from './components/ActivityIdeaForm';
import SettingsModal from './components/SettingsModal';
import UpgradeAccountModal from './components/UpgradeAccountModal';
import { migrateLocalToCloud, pullRemoteToLocal, startRealtimeSync, syncStateToCloud } from './lib/firestoreSync';
import SupportRequestForm from './components/SupportRequestForm';
import PastConnections from './components/PastConnections';
import SwipeableListItem from './components/SwipeableListItem';
import InfoModal from './components/InfoModal';
import Spinner from './components/Spinner';
import { useDebounce } from './hooks/useDebounce';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Clipboard } from '@capacitor/clipboard';

type Tab = 'dashboard' | 'people' | 'groups' | 'activities' | 'ask-a-friend';

// Guard to avoid duplicate initial render logs under React.StrictMode double invocation
let hasLoggedInitialAuthState = false;

function App() {
  if (!hasLoggedInitialAuthState) {
    console.log('[startup] auth.currentUser at initial render:', auth.currentUser);
    hasLoggedInitialAuthState = true;
  }
  // Boot sequence states: 'splash' (initial), 'auth' (show login if needed), 'ready' (main app)
  const [bootStage, setBootStage] = useState<'splash' | 'auth' | 'ready'>('splash');
  const [loading, setLoading] = useState(true); // retained for legacy logic (postLoginLoading etc.)
  const [postLoginLoading, setPostLoginLoading] = useState(false);
  const [people, setPeople] = useState<Person[]>(() => {
    const saved = localStorage.getItem('circleup_people');
    return saved ? JSON.parse(saved) : INITIAL_PEOPLE;
  });
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(() => {
    const v = localStorage.getItem('circleup_lastSync');
    return v ? Number(v) : null;
  });
  const [groups, setGroups] = useState<Group[]>(() => {
    const saved = localStorage.getItem('circleup_groups');
    return saved ? JSON.parse(saved) : INITIAL_GROUPS;
  });
  const [interactions, setInteractions] = useState<Interaction[]>(() => {
    const saved = localStorage.getItem('circleup_interactions');
    return saved ? JSON.parse(saved) : INITIAL_INTERACTIONS;
  });
  const [activities, setActivities] = useState<Activity[]>(() => {
    const saved = localStorage.getItem('circleup_activities');
    return saved ? JSON.parse(saved) : INITIAL_ACTIVITIES;
  });
  const [circles, setCircles] = useState<string[]>(() => {
    const saved = localStorage.getItem('circleup_circles');
    return saved ? JSON.parse(saved) : DEFAULT_CIRCLES;
  });
  const [connectionTypes, setConnectionTypes] = useState<string[]>(() => {
    const saved = localStorage.getItem('circleup_connectionTypes');
    return saved ? JSON.parse(saved) : DEFAULT_CONNECTION_TYPES;
  });
  const [reminderLookahead, setReminderLookahead] = useState<number>(() => {
    const saved = localStorage.getItem('circleup_reminderLookahead');
    return saved ? JSON.parse(saved) : DEFAULT_REMINDER_LOOKAHEAD;
  });
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>(() => {
    const saved = localStorage.getItem('circleup_supportRequests');
    return saved ? JSON.parse(saved) : INITIAL_SUPPORT_REQUESTS;
  });
  const [askHistory, setAskHistory] = useState<AskHistoryEntry[]>(() => {
    const saved = localStorage.getItem('circleup_askHistory');
    return saved ? JSON.parse(saved) : INITIAL_ASK_HISTORY;
  });
  
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [editingPerson, setEditingPerson] = useState<Person | undefined>(undefined);
  const [editingGroup, setEditingGroup] = useState<Group | undefined>(undefined);
  const [editingActivity, setEditingActivity] = useState<Activity | undefined>(undefined);
  const [editingInteraction, setEditingInteraction] = useState<Interaction | undefined>(undefined);
  const [editingSupportRequest, setEditingSupportRequest] = useState<SupportRequest | undefined>(undefined);
  const [loggingForItem, setLoggingForItem] = useState<{ id: string; name: string; type: 'person' | 'group' } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [forceUpcomingRefresh, setForceUpcomingRefresh] = useState(0);
  interface UpcomingItem {
    id: string;
    type: 'birthday' | 'reminder' | 'groupDate';
    personId?: string;
    groupId?: string;
    date: Date;
    displayDate: string;
    title: string;    // primary line (e.g., Name)
    subtitle: string; // secondary line (e.g., "32nd birthday" or reminder text)
  }
  const [upcomingMenuItem, setUpcomingMenuItem] = useState<UpcomingItem | null>(null);
  
  // Sharing state
  interface ShareablePersonCard {
    version: number;
    name: string;
    interests: string[];
    dislikes: string[];
    birthdate?: string;
    giftIdeas?: { text: string; url?: string }[];
  }
  const [importingCard, setImportingCard] = useState<ShareablePersonCard | null>(null);
  const [mergingCard, setMergingCard] = useState<{ 
    card: ShareablePersonCard; 
    existingPerson: Person;
    mergeOptions: { interests: boolean; dislikes: boolean; birthdate: boolean; giftIdeas: boolean };
  } | null>(null);
  const [sharingCard, setSharingCard] = useState<{
    interests: boolean;
    dislikes: boolean;
    birthdate: boolean;
    giftIdeas: boolean;
  } | null>(null);
  const [manualMergeCard, setManualMergeCard] = useState<ShareablePersonCard | null>(null);
  const [showToast, setShowToast] = useState<string | null>(null);
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('circleup_theme');
    if (savedTheme) return savedTheme === 'dark';
    // Default to dark mode if no saved theme
    return true;
  });
  
  // State for People tab UI - start with all circles collapsed
  const [collapsedCircles, setCollapsedCircles] = useState<string[]>(() => circles);
  const [isPinnedCollapsed, setIsPinnedCollapsed] = useState(true);
  const [isPinnedReorderMode, setIsPinnedReorderMode] = useState(false);
  // This will be inside your App function
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const syncUnsubRef = useRef<(() => void)[] | null>(null);
  
  // Listen for onboarding navigation events
  useEffect(() => {
    const dashboardHandler = () => setActiveTab('dashboard');
    const tabHandler = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) setActiveTab(customEvent.detail as Tab);
    };
    const closeModalsHandler = () => setActiveModal(null);
    
    window.addEventListener('circleup:navigateToDashboard', dashboardHandler);
    window.addEventListener('circleup:navigateToTab', tabHandler);
    window.addEventListener('circleup:closeModals', closeModalsHandler);
    
    return () => {
      window.removeEventListener('circleup:navigateToDashboard', dashboardHandler);
      window.removeEventListener('circleup:navigateToTab', tabHandler);
      window.removeEventListener('circleup:closeModals', closeModalsHandler);
    };
  }, []);
  
  useEffect(() => {
    // This listener checks for login/logout
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // If user just logged in (transitioning from null to user), show post-login loading
      if (user && !currentUser) {
        setPostLoginLoading(true);
        setTimeout(() => setPostLoginLoading(false), 2000); // Show for 2 seconds after login
      }
      
      setCurrentUser(user); // user will be null if logged out
      // When auth state resolves, if splash finished we can move to appropriate stage
      if (bootStage === 'auth' && user) {
        setBootStage('ready');
      } else if (bootStage === 'auth' && !user) {
        // Stay in 'auth' until user logs in
      }
      setLoading(false); // legacy flag

      // If user signed in, immediately migrate local data to cloud (aggressive sync)
      // and start realtime listeners so changes sync between devices.
      // SKIP for anonymous users - they stay local-only.
      (async () => {
        // Clean up any previous listeners
        if (syncUnsubRef.current) {
          syncUnsubRef.current.forEach(u => u());
          syncUnsubRef.current = null;
        }

        if (user && !user.isAnonymous) {
          try {
            await pullRemoteToLocal(user.uid);
          } catch (err) {
            console.error('Error pulling remote data to local:', err);
          }

          // Start realtime listeners that will update localStorage and React state
          const unsubscribers = startRealtimeSync(user.uid, {
            onPeople: (items) => setPeople(items),
            onGroups: (items) => setGroups(items),
            onInteractions: (items) => setInteractions(items),
            onActivities: (items) => setActivities(items),
            onSupportRequests: (items) => setSupportRequests(items),
            onAskHistory: (items) => setAskHistory(items),
            onSettings: (settings) => {
              if (settings.circles) setCircles(settings.circles);
              if (settings.connectionTypes) setConnectionTypes(settings.connectionTypes);
              if (settings.reminderLookahead !== undefined) setReminderLookahead(settings.reminderLookahead);
              if (settings.theme) setIsDarkMode(settings.theme === 'dark');
            }
          });

          syncUnsubRef.current = unsubscribers;
        } else if (user && user.isAnonymous) {
          console.log('[guest-mode] Anonymous user detected; skipping cloud sync (local-only mode)');
        }
      })();
    });

    return () => {
      unsubscribe();
    };
  }, [bootStage, currentUser]);

  // Splash stage controller: wait for authReady (web) + minimum duration
  useEffect(() => {
    const MIN_SPLASH_MS = 1200; // minimum time to show splash so UX feels intentional
    const start = performance.now();
    let cancelled = false;
    (async () => {
      // Wait for auth persistence readiness (only meaningful on web)
      try {
        await Promise.race([
          (auth as any) && (window as any).Capacitor?.isNativePlatform?.() ? Promise.resolve() : (window as any).authReady || Promise.resolve(),
          new Promise(res => setTimeout(res, 4000)) // cap wait to 4s
        ]);
      } catch {/* ignore */}
      const elapsed = performance.now() - start;
      const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
      setTimeout(() => {
        if (cancelled) return;
        // If already authenticated move directly to ready, else go to auth stage (login screen)
        setBootStage(currentUser ? 'ready' : 'auth');
      }, remaining);
    })();
    return () => { cancelled = true; };
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('circleup_people', JSON.stringify(people));
    localStorage.setItem('circleup_groups', JSON.stringify(groups));
    localStorage.setItem('circleup_interactions', JSON.stringify(interactions));
    localStorage.setItem('circleup_activities', JSON.stringify(activities));
    localStorage.setItem('circleup_circles', JSON.stringify(circles));
    localStorage.setItem('circleup_connectionTypes', JSON.stringify(connectionTypes));
    localStorage.setItem('circleup_reminderLookahead', JSON.stringify(reminderLookahead));
    localStorage.setItem('circleup_supportRequests', JSON.stringify(supportRequests));
    localStorage.setItem('circleup_askHistory', JSON.stringify(askHistory));
  }, [people, groups, interactions, activities, circles, connectionTypes, reminderLookahead, supportRequests, askHistory]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('circleup_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('circleup_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  const handleSavePerson = (person: Person) => {
    setPeople(prev => {
      const exists = prev.some(p => p.id === person.id);
      if (exists) {
        return prev.map(p => {
          if (p.id !== person.id) return p;
          // Handle pinning logic on save
          if (person.isPinned && !p.isPinned) {
            const maxOrder = Math.max(0, ...prev.filter(px => px.isPinned).map(px => px.pinOrder || 0));
            return { ...person, pinOrder: maxOrder + 1 };
          }
          if (!person.isPinned && p.isPinned) {
            const { pinOrder, ...rest } = person;
            return rest;
          }
          return person;
        });
      }
      // New person
      if (person.isPinned) {
        const maxOrder = Math.max(0, ...prev.filter(px => px.isPinned).map(px => px.pinOrder || 0));
        return [...prev, { ...person, pinOrder: maxOrder + 1 }];
      }
      return [...prev, person];
    });
    setActiveModal(null);
    setEditingPerson(undefined);
  }

  const handleDeletePerson = (personId: string) => {
    setPeople(prev => prev.filter(p => p.id !== personId));
    setGroups(prev => prev.map(g => ({ ...g, memberIds: g.memberIds.filter(id => id !== personId) })));
    setSupportRequests(prev => prev.map(sr => ({ ...sr, helperIds: sr.helperIds.filter(id => id !== personId) })));
    setActiveModal(null);
    setEditingPerson(undefined);
    // Also delete from cloud so it doesn't reappear via realtime sync
    const uid = auth.currentUser?.uid;
    if (uid) {
      deleteDoc(doc(db, 'users', uid, 'people', personId)).catch((e) => console.warn('Cloud delete failed (person)', e));
    }
  }
  
  const handleTogglePin = (id: string, type: 'person' | 'group') => {
    if (type === 'person') {
        setPeople(prev => {
            const person = prev.find(p => p.id === id);
            if (!person) return prev;

            if (!person.isPinned) { // Pinning
                const maxOrder = Math.max(0, ...prev.filter(p => p.isPinned && p.id !== id).map(p => p.pinOrder || 0));
                return prev.map(p => p.id === id ? { ...p, isPinned: true, pinOrder: maxOrder + 1 } : p);
            } else { // Unpinning
                const { pinOrder, ...rest } = person;
                return prev.map(p => p.id === id ? { ...rest, isPinned: false } : p);
            }
        });
    } else {
        setGroups(prev => prev.map(g => g.id === id ? { ...g, isPinned: !g.isPinned } : g));
    }
  }
  
  const handleSnooze = (itemId: string, itemType: 'person' | 'group') => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const snoozeDate = tomorrow.toISOString();

    if (itemType === 'person') {
        setPeople(prev => prev.map(p => (p.id === itemId ? { ...p, snoozedUntil: snoozeDate } : p)));
    } else {
        setGroups(prev => prev.map(g => (g.id === itemId ? { ...g, snoozedUntil: snoozeDate } : g)));
    }
  };

  const handleQuickLog = (itemId: string, itemType: 'person' | 'group') => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const localDate = `${yyyy}-${mm}-${dd}`;
  const interaction: Interaction = {
    id: Date.now().toString(),
    date: localDate,
    type: 'Check-in',
    notes: 'Quick check-in.',
    personIds: itemType === 'person' ? [itemId] : [],
    groupIds: itemType === 'group' ? [itemId] : [],
  };
  handleSaveInteraction(interaction, false); 
  };
  
  const handleOpenDetailedLog = (id: string, name: string, type: 'person' | 'group') => {
    setLoggingForItem({ id, name, type });
    setActiveModal('log-interaction');
  };

  const handleSaveGroup = (group: Group) => {
    setGroups(prev => {
        const exists = prev.some(g => g.id === group.id);
        return exists ? prev.map(g => g.id === group.id ? group : g) : [...prev, group];
    });
    setActiveModal(null);
    setEditingGroup(undefined);
  }

  const handleDeleteGroup = (groupId: string) => {
    setGroups(prev => prev.filter(g => g.id !== groupId));
    setSupportRequests(prev => prev.map(sr => ({ ...sr, helperIds: sr.helperIds.filter(id => id !== groupId) })));
    setActiveModal(null);
    setEditingGroup(undefined);
  }

  const handleSaveInteraction = (interaction: Interaction, closeModal = true) => {
    setInteractions(prev => {
        const exists = prev.some(i => i.id === interaction.id);
        if (exists) {
            return prev.map(i => i.id === interaction.id ? interaction : i);
        }
        return [...prev, interaction];
    });

    // Parse interaction date as local date to avoid timezone shift
    const connectionDate = parseLocalDate(interaction.date).toISOString();
    
    const peopleIdsInGroups = interaction.groupIds.flatMap(groupId => {
        const group = groups.find(g => g.id === groupId);
        return group ? group.memberIds : [];
    });

    const allAffectedPersonIds = new Set([
        ...interaction.personIds,
        ...peopleIdsInGroups
    ]);

    setPeople(prev => 
        prev.map(p => 
            allAffectedPersonIds.has(p.id) 
                ? { ...p, lastConnection: connectionDate, snoozedUntil: undefined } 
                : p
        )
    );
    
    setGroups(prev => prev.map(g => interaction.groupIds.includes(g.id) ? { ...g, lastConnection: connectionDate, snoozedUntil: undefined } : g));
    
    if (closeModal) {
      setActiveModal(null);
      setLoggingForItem(null);
      setEditingInteraction(undefined);
    }
  };

  const handleDeleteInteraction = (interactionId: string) => {
    if (window.confirm("Are you sure you want to delete this connection log?")) {
        setInteractions(prev => prev.filter(i => i.id !== interactionId));
    }
  };
  
  const handleSaveActivity = (activity: Activity) => {
    setActivities(prev => {
        const exists = prev.some(a => a.id === activity.id);
        if (exists) {
            return prev.map(a => a.id === activity.id ? activity : a);
        }
        return [...prev, { ...activity, id: Date.now().toString() }];
    });
    setActiveModal(null);
    setEditingActivity(undefined);
  };
  
  const handleDeleteActivity = (activityId: string) => {
    setActivities(prev => prev.filter(a => a.id !== activityId));
    setActiveModal(null);
    setEditingActivity(undefined);
  };
  
  const handleLogActivityAsInteraction = (activity: Activity) => {
    if (!window.confirm(`Log "${activity.title}" as a completed connection? This will remove it from planned activities.`)) {
        return;
    }

    const personIdsInActivity = activity.participantIds.filter(id => people.some(p => p.id === id));
    const groupIdsInActivity = activity.participantIds.filter(id => groups.some(g => g.id === id));

    const interaction: Interaction = {
        id: Date.now().toString(),
        date: activity.date || new Date().toISOString().split('T')[0],
        notes: `Activity: ${activity.title}\n${activity.notes}`,
        personIds: personIdsInActivity,
        groupIds: groupIdsInActivity,
        type: 'Activity',
    };
    handleSaveInteraction(interaction, false);
    setActivities(prev => prev.filter(a => a.id !== activity.id));
  };


  const handleSaveSupportRequest = (request: SupportRequest) => {
    setSupportRequests(prev => {
        const exists = prev.some(r => r.id === request.id);
        return exists ? prev.map(r => r.id === request.id ? request : r) : [...prev, request];
    });
    setActiveModal(null);
    setEditingSupportRequest(undefined);
  }

  const handleDeleteSupportRequest = (requestId: string) => {
    setSupportRequests(prev => prev.filter(r => r.id !== requestId));
    setAskHistory(prev => prev.filter(h => h.supportRequestId !== requestId));
    setActiveModal(null);
    setEditingSupportRequest(undefined);
  }
  
  const handleLogAsk = (supportRequestId: string, helperId: string) => {
    const newEntry: AskHistoryEntry = {
        id: Date.now().toString(),
        supportRequestId,
        helperId,
        date: new Date().toISOString()
    };
    setAskHistory(prev => [...prev, newEntry]);
  };
  
  const handleImportContacts = async () => {
    try {
        const contacts = await (navigator as any).contacts.select(['name'], { multiple: true });
        if (contacts.length === 0) return;

        const newPeople: Person[] = contacts
            .filter((contact: any) => contact.name && contact.name.length > 0) 
            .map((contact: any) => {
                const name = contact.name[0];
                if (people.some(p => p.name.toLowerCase() === name.toLowerCase())) {
                    return null;
                }
                return {
                    id: `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: name,
                    circles: [],
                    connectionGoal: { type: connectionTypes[0] || 'Call', frequency: 30 },
                    lastConnection: new Date(0).toISOString(),
                    interests: [],
                    dislikes: [],
                    notes: 'Imported from contacts.',
                    followUpTopics: '',
                    giftIdeas: [],
                    isPinned: false,
                    showOnDashboard: true,
                };
            })
            .filter((p: Person | null): p is Person => p !== null);
        
        if (newPeople.length > 0) {
            setPeople(prev => [...prev, ...newPeople]);
            alert(`${newPeople.length} new contact(s) imported successfully!`);
        } else if (contacts.length > 0) {
            alert('No new contacts to import. They may already exist in your list.');
        }

    } catch (ex) {
        console.error('Could not import contacts:', ex);
    }
  };
  
  const getDaysSince = (isoDate: string) => {
      if (isoDate === new Date(0).toISOString()) return Infinity;
      const date = new Date(isoDate);
      const today = new Date();
      today.setHours(0,0,0,0);
      date.setHours(0,0,0,0);
      return Math.floor((today.getTime() - date.getTime()) / (1000 * 3600 * 24));
  }
  
  const getOverdueAmount = (item: Person | Group) => {
      return getDaysSince(item.lastConnection) - item.connectionGoal.frequency;
  }
  // Parse a YYYY-MM-DD string as a LOCAL date (avoids UTC shifting)
  const parseLocalDate = (ymd: string): Date => {
    const [y, m, d] = ymd.split('-').map(v => parseInt(v, 10));
    const dt = new Date(y, (m || 1) - 1, d || 1);
    dt.setHours(0, 0, 0, 0);
    return dt;
  };
  const formatLongDate = (date: Date): string => {
    return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };
  
  // Format birthdate string (--MM-DD or YYYY-MM-DD) for display without timezone issues
  const formatBirthdateDisplay = (birthdate?: string): string => {
    if (!birthdate) return '';
    if (birthdate.startsWith('--')) {
      // Format --MM-DD as "Month Day"
      const [mm, dd] = birthdate.substring(2).split('-');
      const month = parseInt(mm, 10);
      const day = parseInt(dd, 10);
      const date = new Date(2000, month - 1, day); // Use arbitrary year for formatting
      return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
    } else {
      // Format YYYY-MM-DD using parseLocalDate to avoid timezone shift
      const localDate = parseLocalDate(birthdate);
      return localDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
    }
  };
  
  // Hoisted helper for birthdays
  function getOrdinalSuffix(num: number): string {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  }

  const dueConnections = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return [...people, ...groups]
      .filter(item => {
        if ((item as Person).isMe) return false;
        if (item.showOnDashboard === false) return false;
        if (item.snoozedUntil && new Date(item.snoozedUntil) >= today) return false;
        return getOverdueAmount(item) >= 0;
      })
      .sort((a,b) => getOverdueAmount(b) - getOverdueAmount(a));
  }, [people, groups]);

  const upcomingReminders = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lookaheadDate = new Date(today);
    lookaheadDate.setDate(lookaheadDate.getDate() + reminderLookahead);

    // Exclude items snoozed specifically in upcoming list (local only for now)
    const dismissedRaw = localStorage.getItem('circleup_upcoming_dismissed');
    let dismissed: Record<string,string> = {};
    try { if (dismissedRaw) dismissed = JSON.parse(dismissedRaw); } catch {}
    const nowTs = Date.now();

    const items: UpcomingItem[] = [];

    // Person birthdays and reminders
    people.forEach(person => {
      if (person.isMe) return;

      // Birthdays
      if (person.birthdate) {
        const birthdateStr = person.birthdate; // already canonical '--MM-DD' or 'YYYY-MM-DD'
        let birthDate: Date | null = null;
        let hasYear = false;
        try {
          if (birthdateStr.startsWith('--')) {
            const parts = birthdateStr.substring(2).split('-');
            if (parts.length === 2) {
              const [mm, dd] = parts;
              const m = parseInt(mm,10); const d = parseInt(dd,10);
              if (!isNaN(m) && !isNaN(d)) {
                birthDate = new Date(today.getFullYear(), m - 1, d);
                birthDate.setHours(0,0,0,0);
                if (birthDate < today) {
                  birthDate = new Date(today.getFullYear()+1, m-1, d);
                  birthDate.setHours(0,0,0,0);
                }
              }
            }
          } else {
            const parts = birthdateStr.split('-');
            if (parts.length === 3) {
              const [yyyy, mm, dd] = parts;
              hasYear = true;
              const m = parseInt(mm,10); const d = parseInt(dd,10);
              if (!isNaN(m) && !isNaN(d)) {
                birthDate = new Date(today.getFullYear(), m - 1, d);
                birthDate.setHours(0,0,0,0);
                if (birthDate < today) {
                  birthDate = new Date(today.getFullYear()+1, m-1, d);
                  birthDate.setHours(0,0,0,0);
                }
              }
            }
          }
        } catch (e) {
          birthDate = null;
        }

        if (birthDate && birthDate >= today && birthDate <= lookaheadDate) {
          const birthYear = hasYear ? parseInt(birthdateStr.split('-')[0]) : null;
          const age = birthYear ? (birthDate.getFullYear() - birthYear) : null;
          const key = `birthday-${person.id}`;
          if (!(dismissed[key] && parseInt(dismissed[key]) > nowTs)) {
            items.push({
              id: key,
              type: 'birthday',
              personId: person.id,
              date: birthDate,
              displayDate: birthDate.toLocaleDateString(),
              title: person.name,
              subtitle: age ? `${age}${getOrdinalSuffix(age)} birthday` : `Birthday`
            });
          }
        }
      }

      // Reminders
      (person.reminders || []).forEach(reminder => {
        if (reminder.completed) return;
        const reminderDate = parseLocalDate(reminder.date);
        if (reminderDate >= today && reminderDate <= lookaheadDate) {
          if (!(dismissed[reminder.id] && parseInt(dismissed[reminder.id]) > nowTs)) {
            items.push({
              id: reminder.id,
              type: 'reminder',
              personId: person.id,
              date: reminderDate,
              displayDate: reminderDate.toLocaleDateString(),
              title: person.name,
              subtitle: reminder.text
            });
          }
        }
      });
    });

    // Group custom dates
    groups.forEach(group => {
      (group.customDates || []).forEach(customDate => {
        const dateStr = customDate.date.split('T')[0];
        let eventDate: Date | null = null;

        if (dateStr.startsWith('--')) {
          // Format: --MM-DD (recurring yearly by default)
          const [, month, day] = dateStr.split('-');
          eventDate = new Date(today.getFullYear(), parseInt(month) - 1, parseInt(day));
          eventDate.setHours(0, 0, 0, 0);
          if (eventDate < today) {
            eventDate = new Date(today.getFullYear() + 1, parseInt(month) - 1, parseInt(day));
            eventDate.setHours(0, 0, 0, 0);
          }
        } else {
          // Format: YYYY-MM-DD
          const [year, month, day] = dateStr.split('-');
          
          if (customDate.recurring === 'yearly') {
            eventDate = new Date(today.getFullYear(), parseInt(month) - 1, parseInt(day));
            eventDate.setHours(0, 0, 0, 0);
            if (eventDate < today) {
              eventDate = new Date(today.getFullYear() + 1, parseInt(month) - 1, parseInt(day));
              eventDate.setHours(0, 0, 0, 0);
            }
          } else if (customDate.recurring === 'monthly') {
            eventDate = new Date(today.getFullYear(), today.getMonth(), parseInt(day));
            eventDate.setHours(0, 0, 0, 0);
            if (eventDate < today) {
              eventDate = new Date(today.getFullYear(), today.getMonth() + 1, parseInt(day));
              eventDate.setHours(0, 0, 0, 0);
            }
          } else {
            // One-time event
            eventDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            eventDate.setHours(0, 0, 0, 0);
          }
        }

        if (eventDate && eventDate >= today && eventDate <= lookaheadDate) {
          if (!(dismissed[customDate.id] && parseInt(dismissed[customDate.id]) > nowTs)) {
            items.push({
              id: customDate.id,
              type: 'groupDate',
              groupId: group.id,
              date: eventDate,
              displayDate: eventDate.toLocaleDateString(),
              title: group.name,
              subtitle: customDate.description
            });
          }
        }
      });
    });

    return items.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [people, groups, reminderLookahead, forceUpcomingRefresh]);

  const dismissUpcomingItem = (id: string, days = 1) => {
    const raw = localStorage.getItem('circleup_upcoming_dismissed');
    let map: Record<string,string> = {};
    try { if (raw) map = JSON.parse(raw); } catch {}
    const expiry = Date.now() + days*24*60*60*1000;
    map[id] = expiry.toString();
    localStorage.setItem('circleup_upcoming_dismissed', JSON.stringify(map));
    setForceUpcomingRefresh(Date.now());
  };

  const handleUpcomingQuickLog = (item: UpcomingItem) => {
    if (item.personId) {
      handleQuickLog(item.personId, 'person');
    } else if (item.groupId) {
      handleQuickLog(item.groupId, 'group');
    }
  };

  const handleUpcomingSnooze = (item: UpcomingItem) => {
    if (item.type === 'reminder' && item.personId) {
      // add one day to reminder date
      setPeople(prev => prev.map(p => {
        if (p.id !== item.personId) return p;
        return {
          ...p,
          reminders: (p.reminders || []).map(r => {
            if (r.id !== item.id) return r;
            const d = new Date(r.date + 'T00:00:00');
            d.setDate(d.getDate() + 1);
            return { ...r, date: d.toISOString().split('T')[0] };
          })
        };
      }));
    } else {
      // birthdays & group dates -> dismiss for today
      dismissUpcomingItem(item.id, 1);
    }
  };

  const handleUpcomingDelete = (item: UpcomingItem) => {
    if (item.type === 'reminder' && item.personId) {
      setPeople(prev => prev.map(p => p.id === item.personId ? { ...p, reminders: (p.reminders || []).filter(r => r.id !== item.id) } : p));
    } else if (item.type === 'groupDate' && item.groupId) {
      setGroups(prev => prev.map(g => g.id === item.groupId ? { ...g, customDates: (g.customDates || []).filter(cd => cd.id !== item.id) } : g));
    }
    setUpcomingMenuItem(null);
  };

  

  const findNameById = (id: string) => people.find(p => p.id === id)?.name || groups.find(g => g.id === id)?.name || 'Unknown';

  const getNextToAsk = (supportRequest: SupportRequest): string | null => {
      if (supportRequest.helperIds.length === 0) return null;

      const lastAskedTimestamps = new Map<string, number>();
      supportRequest.helperIds.forEach(id => lastAskedTimestamps.set(id, 0));

      askHistory
          .filter(h => h.supportRequestId === supportRequest.id)
          .forEach(h => {
              const askDate = new Date(h.date).getTime();
              if (askDate > (lastAskedTimestamps.get(h.helperId) || 0)) {
                  lastAskedTimestamps.set(h.helperId, askDate);
              }
          });

      const sortedHelpers = [...supportRequest.helperIds].sort((a, b) => {
          const timeA = lastAskedTimestamps.get(a)!;
          const timeB = lastAskedTimestamps.get(b)!;
          return timeA - timeB;
      });
      
      return sortedHelpers[0];
  };

  const generateCalendarLink = (activity: Activity) => {
    if (!activity.date) return '#';
    const googleCalendarUrl = new URL('https://calendar.google.com/calendar/render');
    googleCalendarUrl.searchParams.append('action', 'TEMPLATE');
    googleCalendarUrl.searchParams.append('text', activity.title);

  const startDate = parseLocalDate(activity.date);
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const startTime = ymd(startDate).replace(/-/g, '');
  const endLocal = new Date(startDate);
  endLocal.setDate(endLocal.getDate() + 1);
  const endTime = ymd(endLocal).replace(/-/g, '');

    googleCalendarUrl.searchParams.append('dates', `${startTime}/${endTime}`);
    googleCalendarUrl.searchParams.append('details', `${activity.notes}\n\nParticipants: ${activity.participantIds.map(findNameById).join(', ')}`);
    return googleCalendarUrl.toString();
  };
  
  const handleModalClose = () => {
    setActiveModal(null);
    setEditingPerson(undefined);
    setEditingGroup(undefined);
    setEditingActivity(undefined);
    setEditingInteraction(undefined);
    setEditingSupportRequest(undefined);
    setLoggingForItem(null);
  };

  const getModalContent = () => {
    switch (activeModal) {
      case 'add-person': return { title: 'Add New Person', content: <PersonForm onSave={handleSavePerson} onClose={handleModalClose} circles={circles} allPeople={people} connectionTypes={connectionTypes} /> };
      case 'edit-person': 
        if (!editingPerson) return { title: 'Error', content: <div>Person not found</div> };
        return { title: `Edit ${editingPerson.name}`, content: <PersonForm onSave={handleSavePerson} onDelete={handleDeletePerson} onClose={handleModalClose} personToEdit={editingPerson} circles={circles} groups={groups} allPeople={people} connectionTypes={connectionTypes} /> };
      case 'add-group': return { title: 'Create New Group', content: <GroupForm people={people.filter(p => !p.isMe)} onSave={handleSaveGroup} onClose={handleModalClose} connectionTypes={connectionTypes} circles={circles} /> };
      case 'edit-group': return { title: `Edit ${editingGroup?.name}`, content: <GroupForm people={people.filter(p => !p.isMe)} onSave={handleSaveGroup} onDelete={handleDeleteGroup} onClose={handleModalClose} groupToEdit={editingGroup} connectionTypes={connectionTypes} circles={circles} /> };
      case 'log-interaction': return { title: 'Log a Connection', content: <InteractionForm people={people.filter(p => !p.isMe)} groups={groups} onSave={handleSaveInteraction} onClose={handleModalClose} connectionTypes={connectionTypes} circles={circles} logForItem={loggingForItem} /> };
      case 'edit-interaction': return { title: 'Edit Connection', content: <InteractionForm people={people.filter(p => !p.isMe)} groups={groups} onSave={handleSaveInteraction} onClose={handleModalClose} connectionTypes={connectionTypes} circles={circles} interactionToEdit={editingInteraction} /> };
      case 'plan-activity': return { title: 'Plan an Activity', content: <ActivityForm people={people} groups={groups} onSave={handleSaveActivity} onClose={handleModalClose} circles={circles} /> };
      case 'edit-activity': return { title: `Edit ${editingActivity?.title}`, content: <ActivityForm people={people} groups={groups} onSave={handleSaveActivity} onDelete={handleDeleteActivity} activityToEdit={editingActivity} onClose={handleModalClose} circles={circles} /> };
      case 'ai-generator': return { title: '✨ Generate Ideas with AI', content: <ActivityIdeaForm people={people} groups={groups} onClose={handleModalClose} circles={circles} /> };
      case 'settings': return { title: 'Settings', content: <SettingsModal circles={circles} setCircles={setCircles} connectionTypes={connectionTypes} setConnectionTypes={setConnectionTypes} reminderLookahead={reminderLookahead} setReminderLookahead={setReminderLookahead} onClose={handleModalClose} onManualSync={async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) { alert('Not signed in'); return; }
        try {
          await migrateLocalToCloud(uid);
          await pullRemoteToLocal(uid);
          setPeople(JSON.parse(localStorage.getItem('circleup_people') || '[]'));
          setGroups(JSON.parse(localStorage.getItem('circleup_groups') || '[]'));
          setInteractions(JSON.parse(localStorage.getItem('circleup_interactions') || '[]'));
          setActivities(JSON.parse(localStorage.getItem('circleup_activities') || '[]'));
          setSupportRequests(JSON.parse(localStorage.getItem('circleup_supportRequests') || '[]'));
          setAskHistory(JSON.parse(localStorage.getItem('circleup_askHistory') || '[]'));
          const rl = localStorage.getItem('circleup_reminderLookahead');
          if (rl) setReminderLookahead(JSON.parse(rl));
          const ts = Date.now();
          setLastSyncAt(ts);
          localStorage.setItem('circleup_lastSync', String(ts));
          alert('Sync complete');
        } catch (e) {
          console.error('Manual sync failed', e);
          alert('Sync failed');
        }
      }} lastSyncAt={lastSyncAt} /> };
      case 'add-support-request': return { title: 'Add a Favor / Support Request', content: <SupportRequestForm people={people.filter(p => !p.isMe)} groups={groups} onSave={handleSaveSupportRequest} onClose={handleModalClose} circles={circles} /> };
      case 'edit-support-request': return { title: `Edit ${editingSupportRequest?.name}`, content: <SupportRequestForm people={people.filter(p => !p.isMe)} groups={groups} onSave={handleSaveSupportRequest} onDelete={handleDeleteSupportRequest} supportRequestToEdit={editingSupportRequest} onClose={handleModalClose} circles={circles} />};
      case 'info': return { title: 'About CircleUp', content: <InfoModal /> };
      case 'upgrade-account': return { 
        title: 'Upgrade to Full Account', 
        content: <UpgradeAccountModal 
          onClose={handleModalClose} 
          onUpgradeSuccess={() => {
            // After upgrade, start cloud sync
            const user = auth.currentUser;
            if (user && !user.isAnonymous) {
              startRealtimeSync(user.uid, {
                onPeople: (items) => setPeople(items),
                onGroups: (items) => setGroups(items),
                onInteractions: (items) => setInteractions(items),
                onActivities: (items) => setActivities(items),
                onSupportRequests: (items) => setSupportRequests(items),
                onAskHistory: (items) => setAskHistory(items),
                onSettings: (settings) => {
                  if (settings.circles) setCircles(settings.circles);
                  if (settings.connectionTypes) setConnectionTypes(settings.connectionTypes);
                  if (settings.reminderLookahead !== undefined) setReminderLookahead(settings.reminderLookahead);
                  if (settings.theme) setIsDarkMode(settings.theme === 'dark');
                }
              });
            }
          }}
        /> 
      };
      default: return { title: '', content: null };
    }
  };

  const { title, content } = getModalContent();
  
  const TabButton = ({ tabId, icon, children, isMobile = false }: {tabId: Tab, icon: React.ReactNode, children: React.ReactNode, isMobile?: boolean}) => (
    <button 
      onClick={() => setActiveTab(tabId)} 
      className={`flex-grow sm:flex-grow-0 flex items-center justify-center sm:justify-start sm:gap-2 px-3 sm:px-4 sm:py-2 text-sm font-medium sm:rounded-md transition-colors duration-200 ${activeTab === tabId ? 'sm:bg-blue-600 sm:text-white' : 'text-gray-600 dark:text-gray-300 sm:hover:bg-gray-200 sm:dark:hover:bg-gray-700'} ${isMobile ? `h-full ${activeTab === tabId ? 'text-blue-600 dark:text-blue-500' : 'text-gray-400'}` : ''}`}
      aria-label={String(children)}
      data-tab={tabId}
    >
      {icon}
      <span className="hidden sm:inline">{children}</span>
    </button>
  );
  
  const meProfile = people.find(p => p.isMe);
  const otherPeople = people.filter(p => !p.isMe);
  const isContactsApiSupported = 'contacts' in navigator && 'select' in (navigator as any).contacts;

  // --- Debounced write-through syncing ---
  const DEBOUNCE_DELAY = 1500;
  const debouncedPeople = useDebounce(people, DEBOUNCE_DELAY);
  const debouncedGroups = useDebounce(groups, DEBOUNCE_DELAY);
  const debouncedInteractions = useDebounce(interactions, DEBOUNCE_DELAY);
  const debouncedActivities = useDebounce(activities, DEBOUNCE_DELAY);
  const debouncedSupportRequests = useDebounce(supportRequests, DEBOUNCE_DELAY);
  const debouncedAskHistory = useDebounce(askHistory, DEBOUNCE_DELAY);
  const debouncedSettings = useDebounce({
    circles,
    connectionTypes,
    reminderLookahead,
    theme: isDarkMode ? 'dark' : 'light'
  }, DEBOUNCE_DELAY);

  useEffect(() => {
    const uid = currentUser?.uid;
    const isAnonymous = currentUser?.isAnonymous;
    // Skip cloud sync for anonymous (guest) users - they stay local-only
    if (!uid || isAnonymous) return;
    // Optional: skip very first empty syncs if all lists are empty
    const allEmpty = [debouncedPeople, debouncedGroups, debouncedInteractions, debouncedActivities, debouncedSupportRequests, debouncedAskHistory]
      .every(arr => Array.isArray(arr) && arr.length === 0);
    if (allEmpty) return;

    const stateToSync = {
      people: debouncedPeople,
      groups: debouncedGroups,
      interactions: debouncedInteractions,
      activities: debouncedActivities,
      supportRequests: debouncedSupportRequests,
      askHistory: debouncedAskHistory,
      settings: debouncedSettings
    };

    syncStateToCloud(uid, stateToSync);
  }, [currentUser?.uid, currentUser?.isAnonymous, debouncedPeople, debouncedGroups, debouncedInteractions, debouncedActivities, debouncedSupportRequests, debouncedAskHistory, debouncedSettings]);

    const primaryFabConfig = useMemo(() => {
    switch (activeTab) {
      case 'people':
        return {
          visible: true,
          onClick: () => setActiveModal('add-person'),
          label: 'Add Person'
        };
      case 'groups':
        return {
          visible: true,
          onClick: () => setActiveModal('add-group'),
          label: 'Add Group'
        };
      case 'activities':
        return {
          visible: true,
          onClick: () => setActiveModal('plan-activity'),
          label: 'Plan Activity'
        };
      case 'ask-a-friend':
        return {
          visible: true,
          onClick: () => setActiveModal('add-support-request'),
          label: 'Add Favor'
        };
      default:
        return { visible: false, onClick: () => {}, label: '' };
    }
    }, [activeTab]);

    const navContent = (isMobile: boolean) => (
      <>
        <TabButton tabId="dashboard" isMobile={isMobile} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>}>Dashboard</TabButton>
        <TabButton tabId="people" isMobile={isMobile} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}>People</TabButton>
        <TabButton tabId="groups" isMobile={isMobile} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}>Groups</TabButton>
        <TabButton tabId="activities" isMobile={isMobile} icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-8 w-8"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" /></svg>}>Activities</TabButton>
        <TabButton tabId="ask-a-friend" isMobile={isMobile} icon={<svg fill="currentColor" viewBox="-47.31 -47.31 567.70 567.70" className="h-8 w-8"><path d="M471.176,162.893c-2.537-2.539-6.653-2.539-9.192,0l-40.487,40.488c-1.054,1.054-1.713,2.438-1.868,3.921 c-3.223,30.84-17.072,59.9-38.999,81.826l-9.621,9.621l-69.908-69.908c4.422,1.044,8.75,1.572,12.953,1.572 c6.165,0,12.065-1.127,17.607-3.395c3.323-1.359,4.914-5.155,3.555-8.477c-1.359-3.324-5.156-4.913-8.477-3.555 c-26.768,10.951-57.628-18.195-61.515-22.022l-18.575-18.575c2.306-9.78,0.315-20.276-5.615-28.803 c-6.704-9.638-17.362-15.165-29.287-15.165l-44.991,0.322c-0.04,0-0.08,0-0.119,0c-4.307,0-8.357-1.669-11.416-4.707 c-3.087-3.066-4.787-7.151-4.786-11.504v-0.677c0.002-8.733,6.84-15.844,15.567-16.188l81.933-3.228 c29.569-1.164,59.042,7.816,82.946,25.285c2.588,1.89,6.166,1.614,8.431-0.652l43.032-43.032c2.539-2.538,2.539-6.654,0.001-9.192 c-2.539-2.539-6.654-2.539-9.193,0l-39.173,39.174c-25.398-17.079-55.919-25.778-86.556-24.573l-81.933,3.228 c-0.193,0.008-0.382,0.025-0.573,0.037l-31.087-31.086c-2.538-2.539-6.654-2.539-9.192,0c-2.539,2.538-2.539,6.654,0,9.192 l26.352,26.352c-8.178,5.174-13.552,14.289-13.555,24.682v0.677c-0.002,7.842,3.062,15.204,8.625,20.73 c5.564,5.526,12.941,8.539,20.789,8.482l44.944-0.322c10.353,0,16.077,6.007,18.567,9.588c1.897,2.727,3.168,5.757,3.787,8.879 l-2.228-2.228c-2.538-2.539-6.654-2.539-9.192,0c-2.539,2.538-2.539,6.654,0,9.192l146.666,146.666 c6.334,6.333,6.334,16.639,0,22.972c-6.33,6.331-16.63,6.332-22.962,0.008l-93.42-93.419c-2.537-2.539-6.654-2.539-9.191,0 c-2.539,2.538-2.539,6.654,0,9.192l100.622,100.623c6.334,6.333,6.334,16.639,0,22.972c-3.067,3.068-7.146,4.758-11.486,4.758 c-4.339,0-8.418-1.69-11.485-4.758l-95.387-95.387c-2.539-2.538-6.654-2.538-9.192,0s-2.539,6.654,0,9.192l78.161,78.162 c6.328,6.334,6.326,16.634-0.005,22.965c-6.335,6.334-16.64,6.333-22.973,0l-84.888-84.888c-2.538-2.539-6.654-2.539-9.192,0 c-2.539,2.538-2.539,6.654,0,9.192l62.967,62.967c0,0,0.001,0.001,0.001,0.001c6.334,6.333,6.334,16.638,0,22.972 c-6.332,6.333-16.638,6.333-22.971,0L104.073,289.128c-21.926-21.926-35.776-50.986-38.998-81.826 c-0.155-1.483-0.814-2.867-1.869-3.921l-52.11-52.111c-2.538-2.539-6.654-2.539-9.192,0c-2.539,2.538-2.539,6.654,0,9.192 l50.502,50.502c3.968,32.934,18.996,63.876,42.475,87.355l9.586,9.586c-3.569,4.941-5.5,10.856-5.5,17.071 c0,7.811,3.042,15.155,8.565,20.678c5.701,5.701,13.189,8.552,20.678,8.552c0.737,0,1.473-0.036,2.208-0.091 c-0.251,1.552-0.386,3.134-0.386,4.737c0,7.811,3.042,15.155,8.565,20.678c5.701,5.701,13.189,8.552,20.678,8.552 c1.457,0,2.914-0.111,4.358-0.327c-1.325,8.865,1.414,18.226,8.224,25.036c5.523,5.523,12.867,8.565,20.678,8.565 c6.962,0,13.549-2.422,18.811-6.859c5.294,4.191,11.71,6.293,18.131,6.293c7.488,0,14.978-2.851,20.679-8.552 c4.247-4.247,6.909-9.487,7.992-14.979l4.733,4.733c5.702,5.702,13.189,8.552,20.679,8.552c7.488,0,14.979-2.851,20.68-8.552 c4.247-4.247,6.909-9.486,7.992-14.978l0.045,0.045c5.523,5.523,12.867,8.565,20.679,8.565c7.813,0,15.156-3.042,20.68-8.565 c8.349-8.349,10.576-20.53,6.698-30.932c6.66-0.55,13.168-3.36,18.252-8.445c10.858-10.858,11.368-28.195,1.546-39.672l9.69-9.691 c23.479-23.479,38.507-54.422,42.476-87.356l38.879-38.879C473.715,169.546,473.715,165.431,471.176,162.893z M116.725,336.462 c-3.068-3.068-4.758-7.147-4.758-11.486c0-2.717,0.663-5.331,1.911-7.66l21.992,21.992c-2.328,1.248-4.943,1.911-7.66,1.911 C123.872,341.221,119.793,339.531,116.725,336.462z M147.79,370.339c-3.068-3.068-4.758-7.147-4.758-11.486 c0-3.413,1.059-6.656,2.999-9.382l22.624,22.624C162.318,376.587,153.464,376.012,147.79,370.339z M181.05,403.599 c-5.674-5.674-6.248-14.527-1.756-20.865l22.624,22.624c-2.726,1.939-5.97,2.999-9.383,2.999 C188.197,408.357,184.118,406.667,181.05,403.599z" /></svg>}>Ask a Friend</TabButton>
      </>
    );
  
  
  // People Tab: Move Pinned Person
  const handleMovePinnedPerson = (personId: string, direction: 'up' | 'down') => {
    setPeople(prevPeople => {
        const currentPinned = prevPeople
            .filter(p => p.isPinned)
            .sort((a, b) => (a.pinOrder || 0) - (b.pinOrder || 0));

        const personIndex = currentPinned.findIndex(p => p.id === personId);

        if (personIndex === -1) return prevPeople; // Should not happen

        if (direction === 'up' && personIndex > 0) {
            // Swap with previous item
            [currentPinned[personIndex - 1], currentPinned[personIndex]] = [currentPinned[personIndex], currentPinned[personIndex - 1]];
        } else if (direction === 'down' && personIndex < currentPinned.length - 1) {
            // Swap with next item
            [currentPinned[personIndex], currentPinned[personIndex + 1]] = [currentPinned[personIndex + 1], currentPinned[personIndex]];
        } else {
            return prevPeople; // No move possible
        }

        // Create a map of new pin orders
        const newPinOrders = new Map<string, number>();
        currentPinned.forEach((p, index) => {
            newPinOrders.set(p.id, index);
        });

        // Update the main people array
        return prevPeople.map(p => {
            if (newPinOrders.has(p.id)) {
                return { ...p, pinOrder: newPinOrders.get(p.id) };
            }
            return p;
        });
    });
  };

  // Share your card - open selection modal
  const handleShareMyCard = () => {
    if (!meProfile) return;
    setSharingCard({
      interests: meProfile.interests.length > 0,
      dislikes: meProfile.dislikes.length > 0,
      birthdate: !!meProfile.birthdate,
      giftIdeas: (meProfile.giftIdeas?.length || 0) > 0,
    });
  };

  // Confirm and execute share
  const [manualShareLink, setManualShareLink] = useState<string | null>(null);
  const handleConfirmShare = async () => {
    if (!meProfile || !sharingCard) return;
    
    const card: ShareablePersonCard = {
      version: 1,
      name: meProfile.name,
      interests: sharingCard.interests ? meProfile.interests : [],
      dislikes: sharingCard.dislikes ? meProfile.dislikes : [],
      birthdate: sharingCard.birthdate ? meProfile.birthdate : undefined,
      giftIdeas: sharingCard.giftIdeas ? meProfile.giftIdeas : [],
    };
    
    const cardJson = JSON.stringify(card);
    const encoded = btoa(cardJson);
    // Use hosted domain when on native so pasted link is universal (avoids capacitor:// scheme)
    const baseUrl = Capacitor.isNativePlatform() ? 'https://circleup-bdd94.web.app' : window.location.origin;
    const shareUrl = `${baseUrl}/?import=${encoded}`;
    
    try {
      const isNative = Capacitor.isNativePlatform();

      if (isNative) {
        // Use Capacitor Share on native
        try {
          await Share.share({
            title: `${meProfile.name}'s CircleUp Card`,
            text: 'Import my CircleUp profile! ',
            url: shareUrl,
            dialogTitle: 'Share CircleUp Card'
          });
          setShowToast('Share sheet opened');
          setSharingCard(null);
          setTimeout(() => setShowToast(null), 3000);
          return;
        } catch (nativeShareErr) {
          console.warn('[share] Native Share failed, falling back to clipboard:', nativeShareErr);
        }
        // Native clipboard fallback
        try {
          await Clipboard.write({ string: shareUrl });
          // Optional read-back verification (some WKWebView versions may ignore write silently)
          try {
            const readBack = await Clipboard.read();
            if (!readBack?.value || !String(readBack.value).includes('/?import=')) {
              console.warn('[share] Clipboard verification uncertain:', readBack?.value);
            }
          } catch {}
          setShowToast('Link copied to clipboard!');
          setSharingCard(null);
          setTimeout(() => setShowToast(null), 3000);
          return;
        } catch (clipErr) {
          console.warn('[share] Native clipboard failed, showing manual copy UI.', clipErr);
        }
      }

      // Web: Try native share first if available and secure
      if (navigator.share && window.isSecureContext) {
        try {
          await navigator.share({
            title: `${meProfile.name}'s CircleUp Card`,
            text: 'Import my CircleUp profile!',
            url: shareUrl,
          });
          setShowToast('Shared successfully!');
          setSharingCard(null);
          setTimeout(() => setShowToast(null), 3000);
          return;
        } catch (shareErr: any) {
          if (shareErr.name === 'AbortError') return; // user canceled
          console.log('Web share failed, trying clipboard:', shareErr);
        }
      }

      // Web clipboard fallback
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
        setShowToast('Link copied to clipboard!');
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setShowToast('Link copied to clipboard!');
      }
      setSharingCard(null);
      setTimeout(() => setShowToast(null), 3000);
      // If we reach here on native without early return, we succeeded via web pathway
    } catch (err) {
      console.error('All share methods failed:', err);
      // As a last resort, show manual share overlay with selectable text
      setManualShareLink(shareUrl);
      setShowToast('Share failed. Manual copy shown.');
      setTimeout(() => setShowToast(null), 3000);
    }
  };

  // Import a received card
  const handleImportCard = (card: ShareablePersonCard) => {
    // Never auto-match with "Me" profile - always show manual selection
    const existingPerson = people.find(p => 
      !p.isMe && p.name.toLowerCase() === card.name.toLowerCase()
    );
    
    if (existingPerson) {
      // Show merge UI
      setMergingCard({ 
        card, 
        existingPerson,
        mergeOptions: { interests: false, dislikes: false, birthdate: false, giftIdeas: false }
      });
    } else {
      // Show import preview with option to manually merge
      setImportingCard(card);
    }
  };

  // User wants to manually select a person to merge with
  const handleManualMerge = () => {
    if (!importingCard) return;
    setManualMergeCard(importingCard);
    setImportingCard(null);
  };

  const handleSelectPersonForMerge = (personId: string) => {
    if (!manualMergeCard) return;
    const person = people.find(p => p.id === personId);
    if (!person) return;
    
    setMergingCard({
      card: manualMergeCard,
      existingPerson: person,
      mergeOptions: { interests: false, dislikes: false, birthdate: false, giftIdeas: false }
    });
    setManualMergeCard(null);
  };

  const handleConfirmImport = () => {
    if (!importingCard) return;
    
    const newPerson: Person = {
      id: Date.now().toString(),
      name: importingCard.name,
      interests: importingCard.interests,
      dislikes: importingCard.dislikes,
      birthdate: importingCard.birthdate || '',
      giftIdeas: importingCard.giftIdeas || [],
      circles: [],
      connectionGoal: { type: connectionTypes[0] || 'Call', frequency: 30 },
      lastConnection: new Date(0).toISOString(),
      notes: '',
      followUpTopics: '',
      reminders: [],
      isPinned: false,
      showOnDashboard: true,
    };
    
    setPeople(prev => [...prev, newPerson]);
    setImportingCard(null);
    alert(`${newPerson.name} added to your connections!`);
  };

  const handleConfirmMerge = (mergeOptions: { interests: boolean; dislikes: boolean; birthdate: boolean; giftIdeas: boolean }) => {
    if (!mergingCard) return;
    
    const { card, existingPerson } = mergingCard;
    const updated = { ...existingPerson };
    
    if (mergeOptions.interests) {
      // Merge interests (add new ones)
      const combined = new Set([...updated.interests, ...card.interests]);
      updated.interests = Array.from(combined);
    }
    
    if (mergeOptions.dislikes) {
      const combined = new Set([...updated.dislikes, ...card.dislikes]);
      updated.dislikes = Array.from(combined);
    }
    
    if (mergeOptions.birthdate && card.birthdate) {
      updated.birthdate = card.birthdate;
    }
    
    if (mergeOptions.giftIdeas && card.giftIdeas) {
      // Add new gift ideas
      const existingTexts = new Set(updated.giftIdeas?.map(g => g.text.toLowerCase()) || []);
      const newGifts = card.giftIdeas.filter(g => !existingTexts.has(g.text.toLowerCase()));
      updated.giftIdeas = [...(updated.giftIdeas || []), ...newGifts.map(g => ({ ...g, id: Date.now().toString() + Math.random() }))];
    }
    
    setPeople(prev => prev.map(p => p.id === existingPerson.id ? updated : p));
    setMergingCard(null);
    alert(`${card.name}'s card merged!`);
  };

  // People Tab: Data organization
  const pinnedPeople = useMemo(() => otherPeople.filter(p => p.isPinned).sort((a, b) => (a.pinOrder || 0) - (b.pinOrder || 0)), [otherPeople]);
  const unpinnedPeople = useMemo(() => otherPeople.filter(p => !p.isPinned), [otherPeople]);

  const peopleByCircle = useMemo(() => {
    const mapping: Record<string, Person[]> = {};
    circles.forEach(c => {
      const members = unpinnedPeople.filter(p => p.circles.includes(c)).sort((a, b) => a.name.localeCompare(b.name));
      if (members.length > 0) mapping[c] = members;
    });

    const uncategorized = unpinnedPeople.filter(p => p.circles.length === 0).sort((a, b) => a.name.localeCompare(b.name));
    if (uncategorized.length > 0) {
      mapping['Uncategorized'] = uncategorized;
    }
    return mapping;
  }, [unpinnedPeople, circles]);

  const toggleCircleCollapse = (circle: string) => {
    setCollapsedCircles(prev =>
      prev.includes(circle) ? prev.filter(c => c !== circle) : [...prev, circle]
    );
  };

  // Check for import card on load (after people data is available)
  useEffect(() => {
    if (!currentUser || loading) return; // Wait until user is loaded
    
    const urlParams = new URLSearchParams(window.location.search);
    const importData = urlParams.get('import');
    
    if (importData) {
      try {
        const decoded = atob(importData);
        const card: ShareablePersonCard = JSON.parse(decoded);
        
        const existingPerson = people.find(p => 
          p.name.toLowerCase() === card.name.toLowerCase()
        );
        
        if (existingPerson) {
          // Show merge UI
          setMergingCard({ 
            card, 
            existingPerson,
            mergeOptions: { interests: false, dislikes: false, birthdate: false, giftIdeas: false }
          });
        } else {
          // Show import preview
          setImportingCard(card);
        }
        
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
      } catch (err) {
        console.error('Failed to import card:', err);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, loading, people]);

  // Show splash while bootStage === 'splash' OR while postLoginLoading overlay active
  if (bootStage === 'splash' || postLoginLoading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-gray-100 dark:bg-gray-900 text-center p-4">
        <div className="relative w-full max-w-md aspect-square flex items-center justify-center">
          {/* Your app icon in the center */}
          <img 
            src="/icon-512.png" 
            alt="CircleUp" 
            className="absolute w-3/5 h-3/5 rounded-3xl shadow-lg z-10"
          />
          {/* Animated circle around the icon - larger and spinning reverse */}
          <svg className="absolute w-full h-full animate-slow-spin-reverse text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
        </div>
        <p className="mt-8 text-lg text-gray-600 dark:text-gray-400">Pursue Meaningful and Active Connection to Others</p>
        {bootStage === 'splash' && <p className="mt-4 text-xs text-gray-400">Initializing...</p>}
        {postLoginLoading && <p className="mt-4 text-xs text-gray-400">Signing in...</p>}
      </div>
    );
  }

  // After splash: if not authenticated and in auth stage, show login
  if (bootStage === 'auth' && !currentUser) {
    return <LoginScreen />;
  }

  return (
    <div className="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen font-sans overflow-x-hidden">
      {/* Guest mode banner */}
      {currentUser?.isAnonymous && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
          <div className="container mx-auto px-4 py-2 flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <svg className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-yellow-800 dark:text-yellow-200 truncate">
                <strong>Guest mode:</strong> Your data is local-only and won't sync across devices.
              </span>
            </div>
            <button
              onClick={() => setActiveModal('upgrade-account')}
              className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md text-xs font-semibold whitespace-nowrap flex-shrink-0"
            >
              Create Account
            </button>
          </div>
        </div>
      )}
      <header className="bg-white dark:bg-gray-800 shadow-sm fixed top-0 left-0 w-full z-50 safe-top">
        <div className="px-4 py-3 flex justify-between items-center max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">CircleUp</h1>
            <div className="flex items-center space-x-2 sm:space-x-4">
                <button onClick={() => setActiveModal('ai-generator')} className="p-2 sm:px-3 sm:py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center space-x-2 text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                    </svg>
                    <span className="hidden sm:inline">Generate Ideas</span>
                </button>
                <div data-tour="help-settings" className="flex gap-2">
                  <button data-tour="info-icon" onClick={() => setActiveModal('info')} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" aria-label="Information">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </button>
                  <button data-tour="settings-icon" onClick={() => setActiveModal('settings')} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" aria-label="Settings">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </button>
                </div>
                <button onClick={toggleDarkMode} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" aria-label="Toggle dark mode">
                    {isDarkMode ? 
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg> :
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                    }
                </button>
            </div>
        </div>
        {/* Desktop Nav */}
        <nav className="container mx-auto px-4 pb-2 hidden sm:block">
            <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-700">
               {navContent(false)}
            </div>
        </nav>
      </header>
      
  <main className="container mx-auto p-4 pb-40 sm:pb-4 pt-20">
        {activeTab === 'dashboard' && (
             <div className="space-y-6">
                <section>
                    <h2 className="text-xl font-semibold mb-4">Time to Circle Up!</h2>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                        {dueConnections.length > 0 ? dueConnections.map(item => {
                            const itemType = 'memberIds' in item ? 'group' : 'person';
                            const daysSince = getDaysSince(item.lastConnection);
                            const overdueDays = daysSince - item.connectionGoal.frequency;
                            const isNew = item.lastConnection === new Date(0).toISOString();
                            return (
                               <SwipeableListItem
                                key={item.id}
                                onFullSwipeRight={() => handleSnooze(item.id, itemType)}
                                onFullSwipeLeft={() => handleQuickLog(item.id, itemType)}
                                rightActionView={
                                  <div className="bg-yellow-500 h-full w-full flex flex-col items-center justify-center text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <span className="text-xs font-semibold mt-1">Snooze</span>
                                  </div>
                                }
                                leftActionView={
                                   <div className="bg-green-500 h-full w-full flex flex-col items-center justify-center text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                    <span className="text-xs font-semibold mt-1">Log</span>
                                   </div>
                                }
                               >
                                <div className="p-4 w-full" onClick={() => handleOpenDetailedLog(item.id, item.name, itemType)}>
                                    <div className="flex justify-between items-center">
                                      <div>
                                          <h3 className="font-bold">{item.name}</h3>
                                          <p className="text-sm text-gray-600 dark:text-gray-400">Goal: {item.connectionGoal.type} every {item.connectionGoal.frequency} days.</p>
                                          {!isNew && <p className="text-sm text-gray-600 dark:text-gray-400">Last connected: {daysSince} days ago.</p>}
                                      </div>
                                      {isNew ? (
                                          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No connections logged</p>
                                      ) : (
                                      <div className={`text-right ${overdueDays > 7 ? 'text-red-500' : (overdueDays > 0 ? 'text-yellow-500' : 'text-green-500')}`}>
                                          <span className="font-bold text-lg">{overdueDays}</span>
                                          <p className="text-xs">days overdue</p>
                                      </div>
                                      )}
                                    </div>
                                </div>
                               </SwipeableListItem>
                            )
                        }) : <li className="p-4 text-gray-600 dark:text-gray-400">You're all caught up with everyone!</li>}
                        </ul>
                    </div>
                </section>
                {upcomingReminders.length > 0 && (
                    <section>
                        <h2 className="text-xl font-semibold mb-4">Upcoming Reminders</h2>
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                        {upcomingReminders.map(item => {
                          const isToday = item.date.toDateString() === new Date().toDateString();
                          const rightLabel = item.type === 'reminder' ? 'Snooze' : 'Dismiss';
                          return (
                            <SwipeableListItem
                              key={item.id}
                              onFullSwipeLeft={() => handleUpcomingQuickLog(item)}
                              onFullSwipeRight={() => handleUpcomingSnooze(item)}
                              leftActionView={<div className="bg-green-500 h-full w-full flex flex-col items-center justify-center text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg><span className="text-xs font-semibold mt-1">Log</span></div>}
                              rightActionView={<div className="bg-yellow-500 h-full w-full flex flex-col items-center justify-center text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span className="text-xs font-semibold mt-1">{rightLabel}</span></div>}
                            >
                              <div className="p-4 w-full" onClick={() => setUpcomingMenuItem(item)}>
                                <div className="flex items-start gap-3">
                                  <div className="pt-0.5">
                                    {item.type === 'birthday' && <span className="text-2xl">🎂</span>}
                                    {item.type === 'reminder' && <span className="text-2xl">⏰</span>}
                                    {item.type === 'groupDate' && <span className="text-2xl">📅</span>}
                                  </div>
                                  <div className="min-w-0">
                                    <h3 className="font-semibold break-words">{item.title}</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 break-words">{item.subtitle}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      {item.displayDate}
                                      {isToday && <span className="ml-2 text-blue-600 dark:text-blue-400 font-semibold">Today!</span>}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </SwipeableListItem>
                          );
                        })}
                            </ul>
                        </div>
                    </section>
                )}
                <PastConnections 
                    interactions={interactions} 
                    people={people} 
                    groups={groups}
                    onDeleteInteraction={handleDeleteInteraction}
                    onEditInteraction={(interaction) => {
                        setEditingInteraction(interaction);
                        setActiveModal('edit-interaction');
                    }}
                />
                {upcomingMenuItem && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
                    <div className="bg-white dark:bg-gray-800 w-full sm:w-80 rounded-t-lg sm:rounded-lg p-4 space-y-3">
                      <h3 className="font-semibold">{upcomingMenuItem.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{upcomingMenuItem.subtitle}</p>
                      <button
                        className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                        onClick={() => { handleUpcomingQuickLog(upcomingMenuItem); setUpcomingMenuItem(null); }}
                      >Log Connection</button>
                      {(upcomingMenuItem.type === 'reminder' || upcomingMenuItem.type === 'groupDate') && (
                        <button
                          className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
                          onClick={() => handleUpcomingDelete(upcomingMenuItem)}
                        >Delete</button>
                      )}
                      <button
                        className="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 px-4 py-2 rounded"
                        onClick={() => setUpcomingMenuItem(null)}
                      >Cancel</button>
                    </div>
                  </div>
                )}
            </div>
        )}
        {activeTab === 'people' && (
            <section className="space-y-6">
                 <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold">All People</h2>
                    <div className="flex items-center space-x-2">
                        {isContactsApiSupported && (
                             <button onClick={handleImportContacts} className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm flex items-center space-x-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 11a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1v-1z" /></svg>
                                <span>Import</span>
                            </button>
                        )}
                        <button data-tour="add-person" onClick={() => setActiveModal('add-person')} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm">Add Person</button>
                    </div>
                 </div>

                 {meProfile && (
                   <div className="flex items-center gap-3">
                     <div className="bg-green-50 dark:bg-green-900/20 rounded-lg shadow w-full max-w-md">
                        <div
                          onClick={() => {
                            if (meProfile) {
                              setEditingPerson(meProfile);
                              setActiveModal('edit-person');
                            }
                          }}
                          className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                        >
                          <p className="font-semibold">Me ⭐</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => {
                            handleShareMyCard();
                          }}
                          className="bg-gray-500 hover:bg-gray-600 text-white p-2 rounded-md flex items-center justify-center"
                          title="Share your card"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                          </svg>
                        </button>
                      </div>
                   </div>
                 )}
                 
                 {pinnedPeople.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                        <button 
                          onClick={() => setIsPinnedCollapsed(!isPinnedCollapsed)} 
                          className="w-full p-3 text-left flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            <h3 className="text-sm font-bold uppercase text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                                Pinned
                            </h3>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform text-gray-400 ${!isPinnedCollapsed ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        </button>
                        {!isPinnedCollapsed && (
                          <>
                            <div className="flex justify-end px-3 py-2 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700">
                              <button
                                  onClick={() => setIsPinnedReorderMode(!isPinnedReorderMode)}
                                  className="px-2 py-1 text-xs font-semibold text-white bg-blue-500 rounded-md hover:bg-blue-600"
                              >
                                  {isPinnedReorderMode ? 'Done' : 'Reorder'}
                              </button>
                            </div>
                           <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                                {pinnedPeople.map((p, index) => (
                                    <SwipeableListItem 
                                        key={p.id}
                                        isDisabled={isPinnedReorderMode}
                                        onItemClick={() => {setEditingPerson(p); setActiveModal('edit-person');}}
                                        onFullSwipeLeft={() => handleQuickLog(p.id, 'person')}
                                        onFullSwipeRight={() => handleTogglePin(p.id, 'person')}
                                        rightActionView={
                                        <div className="bg-blue-500 h-full w-full flex flex-col items-center justify-center text-white">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                                            <span className="text-xs font-semibold mt-1">Unpin</span>
                                        </div>
                                        }
                                        leftActionView={
                                        <div className="bg-green-500 h-full w-full flex flex-col items-center justify-center text-white">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                            <span className="text-xs font-semibold mt-1">Log</span>
                                        </div>
                                        }
                                    >
                                        <div className={`p-4 w-full flex items-center gap-2`}>
                                            {isPinnedReorderMode && (
                                                <div className="flex flex-col">
                                                    <button onClick={() => handleMovePinnedPerson(p.id, 'up')} disabled={index === 0} className="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
                                                    </button>
                                                    <button onClick={() => handleMovePinnedPerson(p.id, 'down')} disabled={index === pinnedPeople.length - 1} className="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed">
                                                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                                    </button>
                                                </div>
                                            )}
                                            <div className="flex-grow pl-2">
                                                <p className="font-semibold">{p.name}</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">{p.circles.join(', ')}</p>
                                            </div>
                                        </div>
                                    </SwipeableListItem>
                                ))}
                            </ul>
                          </>
                        )}
                    </div>
                 )}

                 {Object.entries(peopleByCircle).map(([circle, members]: [string, Person[]]) => (
                    <div key={circle} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                        <button onClick={() => toggleCircleCollapse(circle)} className="w-full p-3 text-left flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700">
                           <h3 className="text-sm font-bold uppercase text-gray-500 dark:text-gray-400">{circle}</h3>
                           <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform text-gray-400 ${!collapsedCircles.includes(circle) ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        </button>
                        {!collapsedCircles.includes(circle) && (
                            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                                {members.map(p => (
                                    <SwipeableListItem 
                                        key={p.id}
                                        onItemClick={() => {setEditingPerson(p); setActiveModal('edit-person');}}
                                        onFullSwipeLeft={() => handleQuickLog(p.id, 'person')}
                                        onFullSwipeRight={() => handleTogglePin(p.id, 'person')}
                                        rightActionView={
                                        <div className="bg-blue-500 h-full w-full flex flex-col items-center justify-center text-white">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                                            <span className="text-xs font-semibold mt-1">Pin</span>
                                        </div>
                                        }
                                        leftActionView={
                                        <div className="bg-green-500 h-full w-full flex flex-col items-center justify-center text-white">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                            <span className="text-xs font-semibold mt-1">Log</span>
                                        </div>
                                        }
                                    >
                                    <div className="p-4 w-full">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold">{p.name}</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">{p.circles.join(', ')}</p>
                                            </div>
                                        </div>
                                    </div>
                                    </SwipeableListItem>
                                ))}
                            </ul>
                        )}
                    </div>
                 ))}
            </section>
        )}
        {activeTab === 'groups' && (
             <section>
                 <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">All Groups</h2>
                    <button data-tour="add-group" onClick={() => setActiveModal('add-group')} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm">Add Group</button>
                 </div>
                 <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                         {[...groups].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || a.name.localeCompare(b.name)).map(g => (
                            <SwipeableListItem 
                                key={`${g.id}-${g.isPinned}-${g.lastConnection}`}
                                onItemClick={() => {setEditingGroup(g); setActiveModal('edit-group');}}
                                onFullSwipeLeft={() => handleQuickLog(g.id, 'group')}
                                onFullSwipeRight={() => handleTogglePin(g.id, 'group')}
                                rightActionView={
                                  <div className="bg-blue-500 h-full w-full flex flex-col items-center justify-center text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                                    <span className="text-xs font-semibold mt-1">Pin</span>
                                  </div>
                                }
                                leftActionView={
                                   <div className="bg-green-500 h-full w-full flex flex-col items-center justify-center text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                    <span className="text-xs font-semibold mt-1">Log</span>
                                   </div>
                                }
                            >
                                <div className={`p-4 w-full ${g.isPinned ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold">{g.name}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{g.memberIds.map(findNameById).join(', ')}</p>
                                        </div>
                                        {g.isPinned && (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                                        )}
                                    </div>
                                </div>
                            </SwipeableListItem>
                        ))}
                    </ul>
                 </div>
            </section>
        )}
        {activeTab === 'activities' && (
            <section>
                 <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Planned Activities</h2>
                    <button data-tour="plan-activity" onClick={() => setActiveModal('plan-activity')} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm">Plan Activity</button>
                 </div>
                 <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {[...activities].sort((a, b) => (a.date && b.date) ? parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime() : a.date ? -1 : 1).map(a => (
                        <SwipeableListItem
                            key={a.id}
                            onItemClick={() => { setEditingActivity(a); setActiveModal('edit-activity'); }}
                            onFullSwipeLeft={() => handleLogActivityAsInteraction(a)}
                            leftActionView={
                               <div className="bg-green-500 h-full w-full flex flex-col items-center justify-center text-white">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                <span className="text-xs font-semibold mt-1">Log</span>
                               </div>
                            }
                        >
                            <div className="p-4 w-full">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold">{a.title}</h3>
                    <p className="font-normal text-sm text-gray-500 dark:text-gray-400">
                      {a.date ? formatLongDate(parseLocalDate(a.date)) : <span className="italic">Date TBD</span>}
                    </p>
                                    </div>
                                    {a.date && (
                                        <a href={generateCalendarLink(a)} onPointerDown={(e) => e.stopPropagation()} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600" aria-label="Add to calendar">
                                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6 w-6">
                                                <path d="M20 10V7C20 5.89543 19.1046 5 18 5H6C4.89543 5 4 5.89543 4 7V10M20 10H4M20 10V10.75M4 10V19C4 20.1046 4.89543 21 6 21H12M8 3V7M16 3V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
                                                <path d="M17.5356 14V17.5355M17.5356 21.0711V17.5355M17.5356 17.5355L21.0712 17.5355M17.5356 17.5355H14.0001" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
                                            </svg>
                                        </a>
                                    )}
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">With: {a.participantIds.map(findNameById).join(', ')}</p>
                                {a.notes && <p className="text-sm mt-1 text-gray-500 dark:text-gray-300 italic">"{a.notes}"</p>}
                            </div>
                        </SwipeableListItem>
                    )) }
                    {activities.length === 0 && <li className="p-4 text-gray-600 dark:text-gray-400">No activities planned yet.</li>}
                    </ul>
                  </div>
            </section>
        )}
        {activeTab === 'ask-a-friend' && (
            <section>
                 <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Ask a Friend</h2>
                    <button onClick={() => setActiveModal('add-support-request')} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm">Add Favor Type</button>
                 </div>
                  <div className="space-y-3">
                    {supportRequests.length > 0 ? supportRequests.map(sr => {
                        const nextToAskId = getNextToAsk(sr);
                        const nextToAskName = nextToAskId ? findNameById(nextToAskId) : 'N/A';
                        return (
                            <div key={sr.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-lg">{sr.name}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Helpers: {sr.helperIds.map(findNameById).join(', ')}</p>
                                    </div>
                                    <button onClick={() => { setEditingSupportRequest(sr); setActiveModal('edit-support-request'); }} className="text-xs text-blue-500 hover:underline">Edit</button>
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                    <div>
                                        <p className="text-sm font-medium">Next to ask:</p>
                                        <p className="font-semibold text-blue-600 dark:text-blue-400">{nextToAskName}</p>

                                    </div>
                                    <button 
                                        onClick={() => nextToAskId && handleLogAsk(sr.id, nextToAskId)} 
                                        disabled={!nextToAskId}
                                        className="px-3 py-1.5 bg-green-500 text-white rounded-md hover:bg-green-600 text-sm disabled:bg-gray-400"
                                    >
                                        Log Ask
                                    </button>
                                </div>
                            </div>
                        )
                    }) : (
                        <div className="text-center py-8 px-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                            <h3 className="text-lg font-semibold">No favors yet!</h3>
                            <p className="text-gray-500 dark:text-gray-400 mt-1">Click "Add Favor Type" to get started.</p>
                        </div>
                    )}
                  </div>
            </section>
        )}

      </main>

      {/* Mobile Bottom Nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-[0_-1px_3px_rgba(0,0,0,0.1)] z-30 h-24 pb-[env(safe-area-inset-bottom)]">
          <div className="flex justify-around items-stretch h-full">
              {navContent(true)}
          </div>
      </nav>

      <button 
        aria-label="Log a Connection"
        data-tour="log-fab"
        onClick={() => setActiveModal('log-interaction')} 
        className="fixed bottom-28 sm:bottom-6 left-6 bg-green-600 text-white rounded-full p-3.5 shadow-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-gray-900 z-10"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-7 w-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
        </svg>
      </button>

      {primaryFabConfig.visible && (
        <button 
          aria-label={primaryFabConfig.label}
          onClick={primaryFabConfig.onClick} 
          className="fixed bottom-28 sm:bottom-6 right-6 bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900 z-10"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        </button>
      )}

      {/* Share Selection Modal */}
      {sharingCard && meProfile && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-lg shadow-xl">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Share Your Card</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Choose what to share:
              </p>
              
              <div className="space-y-3 mb-6">
                {meProfile.interests.length > 0 && (
                  <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="checkbox"
                      checked={sharingCard.interests}
                      onChange={(e) => setSharingCard({ ...sharingCard, interests: e.target.checked })}
                    />
                    <div className="flex-1">
                      <p className="font-medium">Interests</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{meProfile.interests.join(', ')}</p>
                    </div>
                  </label>
                )}
                {meProfile.dislikes.length > 0 && (
                  <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="checkbox"
                      checked={sharingCard.dislikes}
                      onChange={(e) => setSharingCard({ ...sharingCard, dislikes: e.target.checked })}
                    />
                    <div className="flex-1">
                      <p className="font-medium">Dislikes</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{meProfile.dislikes.join(', ')}</p>
                    </div>
                  </label>
                )}
                {meProfile.birthdate && (
                  <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="checkbox"
                      checked={sharingCard.birthdate}
                      onChange={(e) => setSharingCard({ ...sharingCard, birthdate: e.target.checked })}
                    />
                    <div className="flex-1">
                      <p className="font-medium">Birthday</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{formatBirthdateDisplay(meProfile.birthdate)}</p>
                    </div>
                  </label>
                )}
                {meProfile.giftIdeas && meProfile.giftIdeas.length > 0 && (
                  <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="checkbox"
                      checked={sharingCard.giftIdeas}
                      onChange={(e) => setSharingCard({ ...sharingCard, giftIdeas: e.target.checked })}
                    />
                    <div className="flex-1">
                      <p className="font-medium">Gift Ideas</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{meProfile.giftIdeas.length} ideas</p>
                    </div>
                  </label>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleConfirmShare}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md font-medium"
                >
                  Share Selected
                </button>
                <button
                  onClick={() => setSharingCard(null)}
                  className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-md font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Merge Person Selection Modal */}
      {manualMergeCard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Select Person to Merge With</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Merging card for: <span className="font-semibold">{manualMergeCard.name}</span>
              </p>
              
              <div className="space-y-2 mb-6">
                {otherPeople.sort((a, b) => a.name.localeCompare(b.name)).map(person => (
                  <button
                    key={person.id}
                    onClick={() => handleSelectPersonForMerge(person.id)}
                    className="w-full text-left p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <p className="font-medium">{person.name}</p>
                    {person.circles.length > 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">{person.circles.join(', ')}</p>
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setManualMergeCard(null)}
                className="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-md font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Card Preview Modal */}
      {importingCard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-lg shadow-xl">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Import Contact</h2>
              <div className="space-y-3 mb-6">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</p>
                  <p className="font-semibold">{importingCard.name}</p>
                </div>
                {importingCard.birthdate && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Birthday</p>
                    <p>{formatBirthdateDisplay(importingCard.birthdate)}</p>
                  </div>
                )}
                {importingCard.interests.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Interests</p>
                    <p className="text-sm">{importingCard.interests.join(', ')}</p>
                  </div>
                )}
                {importingCard.dislikes.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Dislikes</p>
                    <p className="text-sm">{importingCard.dislikes.join(', ')}</p>
                  </div>
                )}
                {importingCard.giftIdeas && importingCard.giftIdeas.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Gift Ideas</p>
                    <ul className="text-sm list-disc list-inside">
                      {importingCard.giftIdeas.map((idea, i) => (
                        <li key={i}>{idea.text}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleConfirmImport}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md font-medium"
                >
                  Import as New
                </button>
                <button
                  onClick={handleManualMerge}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md font-medium"
                >
                  Merge with...
                </button>
              </div>
              <button
                onClick={() => setImportingCard(null)}
                className="w-full mt-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-md font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Card Dialog Modal */}
      {mergingCard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-2">Merge Contact Updates</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Merging <span className="font-semibold">{mergingCard.card.name}</span>'s card into <span className="font-semibold">{mergingCard.existingPerson.name}</span>
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Select which fields to update:
              </p>
              
              <div className="space-y-4 mb-6">
                {/* Interests */}
                {mergingCard.card.interests.length > 0 && (
                  <label className="flex items-start gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="checkbox"
                      checked={mergingCard.mergeOptions.interests}
                      onChange={(e) => setMergingCard({
                        ...mergingCard,
                        mergeOptions: { ...mergingCard.mergeOptions, interests: e.target.checked }
                      })}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="font-medium mb-1">Interests</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Current:</p>
                          <p>{mergingCard.existingPerson.interests.length > 0 ? mergingCard.existingPerson.interests.join(', ') : 'None'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">New:</p>
                          <p>{mergingCard.card.interests.join(', ')}</p>
                        </div>
                      </div>
                    </div>
                  </label>
                )}

                {/* Dislikes */}
                {mergingCard.card.dislikes.length > 0 && (
                  <label className="flex items-start gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="checkbox"
                      checked={mergingCard.mergeOptions.dislikes}
                      onChange={(e) => setMergingCard({
                        ...mergingCard,
                        mergeOptions: { ...mergingCard.mergeOptions, dislikes: e.target.checked }
                      })}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="font-medium mb-1">Dislikes</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Current:</p>
                          <p>{mergingCard.existingPerson.dislikes.length > 0 ? mergingCard.existingPerson.dislikes.join(', ') : 'None'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">New:</p>
                          <p>{mergingCard.card.dislikes.join(', ')}</p>
                        </div>
                      </div>
                    </div>
                  </label>
                )}

                {/* Birthdate */}
                {mergingCard.card.birthdate && (
                  <label className="flex items-start gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="checkbox"
                      checked={mergingCard.mergeOptions.birthdate}
                      onChange={(e) => setMergingCard({
                        ...mergingCard,
                        mergeOptions: { ...mergingCard.mergeOptions, birthdate: e.target.checked }
                      })}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="font-medium mb-1">Birthday</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Current:</p>
                          <p>{mergingCard.existingPerson.birthdate ? formatBirthdateDisplay(mergingCard.existingPerson.birthdate) : 'None'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">New:</p>
                          <p>{formatBirthdateDisplay(mergingCard.card.birthdate)}</p>
                        </div>
                      </div>
                    </div>
                  </label>
                )}

                {/* Gift Ideas */}
                {mergingCard.card.giftIdeas && mergingCard.card.giftIdeas.length > 0 && (
                  <label className="flex items-start gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="checkbox"
                      checked={mergingCard.mergeOptions.giftIdeas}
                      onChange={(e) => setMergingCard({
                        ...mergingCard,
                        mergeOptions: { ...mergingCard.mergeOptions, giftIdeas: e.target.checked }
                      })}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="font-medium mb-1">Gift Ideas</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Current:</p>
                          <ul className="list-disc list-inside">
                            {mergingCard.existingPerson.giftIdeas?.length > 0 ? mergingCard.existingPerson.giftIdeas.map((g, i) => (
                              <li key={i}>{g.text}</li>
                            )) : <li>None</li>}
                          </ul>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">New:</p>
                          <ul className="list-disc list-inside">
                            {mergingCard.card.giftIdeas.map((g, i) => (
                              <li key={i}>{g.text}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </label>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleConfirmMerge(mergingCard.mergeOptions)}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md font-medium"
                >
                  Merge Selected
                </button>
                <button
                  onClick={() => setMergingCard(null)}
                  className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-md font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={!!activeModal} onClose={handleModalClose} title={title}>
        {content}
      </Modal>

      {/* Onboarding Tour Overlay */}
      <OnboardingController />

      {/* Manual Share Overlay */}
      {manualShareLink && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setManualShareLink(null)}>
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-lg shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Copy Link</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Tap the field below to copy the link manually.</p>
            <input
              readOnly
              value={manualShareLink}
              onFocus={(e) => { e.currentTarget.select(); }}
              className="w-full input-field"
            />
            <div className="mt-4 flex gap-2">
              <button
                className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-md font-medium"
                onClick={async () => { try { await Clipboard.write({ string: manualShareLink }); setShowToast('Link copied!'); setTimeout(()=>setShowToast(null), 2000);} catch {} }}
              >Copy</button>
              <button
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md font-medium"
                onClick={() => setManualShareLink(null)}
              >Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-up">
          <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400 dark:text-green-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">{showToast}</span>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;