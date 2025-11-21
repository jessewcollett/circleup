import React, { useCallback, useEffect, useMemo, useState } from 'react';
import OnboardingTour, { type TourStep } from './OnboardingTour';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { ONBOARDING_ENABLED, ONBOARDING_VERSION } from '../constants';
import { getOnboardingSeen, setOnboardingSeen } from '../lib/onboarding';

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

export default function OnboardingController() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid || null);

  // Build steps referencing data attributes in App
  const steps: TourStep[] = useMemo(() => {
    return [
      {
        id: 'welcome',
        title: 'Welcome to CircleUp',
        body: 'Take a tour and learn the basics of CircleUp.',
      },
      {
        id: 'tab-people',
        title: 'People Tab',
        body: 'Tap here to add and manage the people in your circles. Swipe cards left to log connections or fully right to pin.',
        targetSelector: '[data-tab="people"]',
        allowInteraction: true,
        nextOnTargetClick: true,
        navigateToTab: 'dashboard',
      },
      {
        id: 'quick-log',
        title: 'Log Connections',
        body: 'Swipe a person\'s card or tap this button to log a connection.',
        targetSelector: '[data-tour="log-fab"]',
        allowInteraction: true,
        nextOnTargetClick: true,
        navigateToTab: 'people',
      },
      {
        id: 'tab-groups',
        title: 'Groups Tab',
        body: 'Tap here to organize people into focused circles like friend or family groups, work friends, or hobby groups. Swipe to log connections or pin groups.',
        targetSelector: '[data-tab="groups"]',
        allowInteraction: true,
        nextOnTargetClick: true,
        navigateToTab: 'dashboard',
      },
      {
        id: 'tab-activities',
        title: 'Activities Tab',
        body: 'Tap here to plan future hangouts, trips, or events with dates or keep them as TBD.',
        targetSelector: '[data-tab="activities"]',
        allowInteraction: true,
        nextOnTargetClick: true,
        navigateToTab: 'dashboard',
      },
      {
        id: 'tab-favors',
        title: 'Ask a Friend',
        body: 'Tap here to track favors and rotate who you ask for help.',
        targetSelector: '[data-tab="ask-a-friend"]',
        allowInteraction: true,
        nextOnTargetClick: true,
        navigateToTab: 'dashboard',
      },
      {
        id: 'help',
        title: 'Help & Settings',
        body: 'Find tips in Info and manage preferences in Settings. Tap Finish to complete the tour.',
        targetSelector: '[data-tour="help-settings"]',
        navigateToTab: 'dashboard',
      },
    ];
  }, []);

  const start = useCallback(async () => {
    if (!ONBOARDING_ENABLED) return;
    // Close any open modals
    window.dispatchEvent(new CustomEvent('circleup:closeModals'));
    // Navigate to dashboard first
    window.dispatchEvent(new CustomEvent('circleup:navigateToDashboard'));
    // give UI a moment to render the correct tab/buttons and close modals
    await wait(500);
    setIndex(0);
    setOpen(true);
  }, []);

  // Listen for global start events (replay from Info/Settings)
  useEffect(() => {
    const handler = () => start();
    window.addEventListener('circleup:startOnboarding' as any, handler);
    return () => window.removeEventListener('circleup:startOnboarding' as any, handler);
  }, [start]);

  // Auto-run after first successful login (including guests)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setUid(user?.uid || null);
      if (!ONBOARDING_ENABLED) return;

      // Only trigger when user exists and not already shown for this uid/version
      if (user) {
        const seen = getOnboardingSeen(user.isAnonymous ? null : user.uid);
        if (!seen || seen.version !== ONBOARDING_VERSION) {
          // small delay to ensure app layout is ready
          await wait(800);
          setIndex(0);
          setOpen(true);
        }
      }
    });
    return () => unsub();
  }, []);

  const closeAndPersist = (skipped = false) => {
    setOpen(false);
    setOnboardingSeen(uid, { version: ONBOARDING_VERSION, completedAt: Date.now(), skipped });
  };

  if (!open) return null;

  return (
    <OnboardingTour
      isOpen={open}
      steps={steps}
      currentIndex={index}
      onNext={() => {
        if (index >= steps.length - 1) {
          closeAndPersist(false);
        } else {
          setIndex(index + 1);
        }
      }}
      onPrev={() => setIndex(Math.max(0, index - 1))}
      onSkip={() => closeAndPersist(true)}
    />
  );
}
