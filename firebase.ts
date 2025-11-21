// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { initializeAuth, browserLocalPersistence, inMemoryPersistence, getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAccWig5OsxOjK-MykqrGdX1pZjpZhWdx8",
  authDomain: "circleup-bdd94.firebaseapp.com",
  projectId: "circleup-bdd94",
  storageBucket: "circleup-bdd94.firebasestorage.app",
  messagingSenderId: "1031944311075",
  appId: "1:1031944311075:web:b0c0469bceb6be85987c96",
  measurementId: "G-8QQS4HFJHL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Analytics can throw on some hybrid environments before consent; wrap safely.
let analytics: ReturnType<typeof getAnalytics> | null = null;
try { analytics = getAnalytics(app); } catch (e) { console.warn('Analytics init skipped:', e); }
// Use initializeAuth explicitly on native to avoid delayed web-worker initialization in WKWebView.
const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.();
export const auth = isNative
  ? initializeAuth(app, { persistence: inMemoryPersistence })
  : getAuth(app);
export const db = getFirestore(app);
// Initialize Firebase Messaging for PWA push notifications
export const messaging = getMessaging(app);
export { getToken, onMessage };

// Try to enable IndexedDB persistence for offline support; ignore errors if not possible
enableIndexedDbPersistence(db).catch((err) => {
  // Typical errors: failed-precondition (multiple tabs open) or unimplemented (browser)
  console.warn('IndexedDB persistence not enabled:', err?.code || err?.message || err);
});

// Provide a promise that resolves when persistence is set; Login flows can await this to avoid races.
// On web, ensure local persistence. On native we already set inMemory via initializeAuth.
export const authReady: Promise<void> = (async () => {
  if (!isNative) {
    try {
      const { setPersistence } = await import('firebase/auth');
      await setPersistence(auth, browserLocalPersistence);
      console.log('[authReady] Using browserLocalPersistence');
    } catch (err) {
      console.warn('[authReady] browser persistence failed; using inMemory', err);
      try {
        const { setPersistence } = await import('firebase/auth');
        await setPersistence(auth, inMemoryPersistence);
        console.log('[authReady] Fallback to inMemoryPersistence');
      } catch (err2) {
        console.error('[authReady] Failed to set any auth persistence:', err2);
      }
    }
  } else {
    console.log('[authReady] Native initializeAuth with inMemoryPersistence');
  }
})();

// Lightweight REST probe for anonymous sign-up to diagnose WKWebView stalls.
export async function probeAnonymousSignup(apiKey: string) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true })
    });
    const ms = Date.now() - started;
    const text = await res.text();
    console.log('[probeAnonymousSignup] status:', res.status, 'elapsed(ms):', ms);
    console.log('[probeAnonymousSignup] raw body (truncated 500):', text.slice(0, 500));
    return { status: res.status, elapsed: ms, body: text };
  } catch (err) {
    const ms = Date.now() - started;
    console.error('[probeAnonymousSignup] network error after', ms, 'ms:', err);
    return { status: 0, elapsed: ms, error: (err as any)?.message || String(err) };
  }
}

export const FIREBASE_API_KEY = firebaseConfig.apiKey;