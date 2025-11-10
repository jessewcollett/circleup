import React, { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signInAnonymously, signInWithCredential } from 'firebase/auth';
import { auth, authReady, probeAnonymousSignup, FIREBASE_API_KEY } from '../firebase';
import { migrateLocalToCloud } from '../lib/firestoreSync';
import Spinner from './Spinner';
import { Capacitor } from '@capacitor/core';

export const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      if (Capacitor.isNativePlatform()) {
        console.log('[google-login] Native platform detected; using capacitor-google-auth plugin');
        const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
        try {
          await GoogleAuth.initialize({ scopes: ['profile', 'email'] });
        } catch (e) {
          console.warn('[google-login] initialize skipped/failed (may already be initialized):', e);
        }
        const googleUser = await GoogleAuth.signIn();
        console.log('[google-login] Plugin returned user:', googleUser?.email);
        const idToken = googleUser?.authentication?.idToken;
        const accessToken = googleUser?.authentication?.accessToken;
        if (!idToken) throw new Error('Missing idToken from native Google sign-in');
        const credential = GoogleAuthProvider.credential(idToken, accessToken);
        await signInWithCredential(auth, credential);
      } else {
        console.log('[google-login] Web platform; using signInWithPopup');
        await signInWithPopup(auth, provider);
      }
      // Auth state listener (App.tsx) will proceed
    } catch (error: any) {
      console.error('[google-login] Login failed:', error);
      setError(error?.message || 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  const handleAnonymousLogin = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Waiting for authReady...');
      // Await authReady only if not native (native path is immediate now)
      try {
        await Promise.race([
          authReady,
          new Promise((_, rej) => setTimeout(() => rej(new Error('authReady timeout')), 5000))
        ]);
        console.log('authReady resolved. Starting anonymous sign-in...');
      } catch (e) {
        console.warn('authReady wait skipped/timeout, proceeding anyway on native');
      }
      console.log('Starting anonymous sign-in...');
      console.log('Calling signInAnonymously...');
      const startTs = Date.now();
      let heartbeatCount = 0;
      const heartbeat = setInterval(() => {
        heartbeatCount++;
        console.log(`[anon-heartbeat] ${(Date.now()-startTs)}ms elapsed, awaiting Firebase response (count=${heartbeatCount})`);
      }, 1500);
      
      // Add a safety timeout so we can surface a visible error instead of hanging forever
      const result = await Promise.race([
        signInAnonymously(auth),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('signInAnonymously timeout after 12s')), 12000))
      ]);
      clearInterval(heartbeat);
      
      console.log('Anonymous sign-in successful:', result.user.uid);
      setLoading(false);
      // Auth state change in App.tsx will handle the rest
    } catch (error: any) {
      console.log('Anonymous sign-in failed or timed out at', Date.now());
      console.error('Anonymous login failed:', error);
      console.error('Error code:', error?.code);
      console.error('Error message:', error?.message);
      console.error('Error name:', error?.name);
      console.error('Error stack:', error?.stack);
      // Kick off a REST probe to check network reachability to Firebase Auth in WKWebView
      try {
        console.log('Probing identitytoolkit anonymous endpoint...');
        const probe = await probeAnonymousSignup(FIREBASE_API_KEY);
        console.log('Probe result:', probe);
      } catch (e) {
        console.warn('Probe failed:', e);
      }
      setError(`${error?.code || 'unknown'}: ${error?.message || 'Login failed'}`);
      setLoading(false);
    }
  };

  const handleCreateStubUser = () => {
    // Non-persistent stub so you can test the rest of the UI while auth is investigated.
    // We simulate a Firebase user object with just a uid and minimal fields.
    const stubUid = `stub-${Date.now()}`;
    console.warn('[stub-user] Creating temporary in-memory user', stubUid);
    // @ts-ignore force assignment for testing only
    auth.currentUser = { uid: stubUid };
    window.dispatchEvent(new Event('circleup-stub-user')); // optional custom event
    setLoading(false);
  };

  // If we used redirect flow, handle the result when the page loads
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const result = await getRedirectResult(auth);
        if (!mounted) return;
        if (result && result.user) {
          console.log('Logged in user (redirect):', result.user);
          await migrateLocalToCloud(result.user.uid);
        }
      } catch (err) {
        // It's normal to get no-redirect-result; only log unexpected errors
        console.debug('No redirect result or redirect handling error:', err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const showAnonymous = false; // Disabled for production

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
        <h1 className="text-4xl font-bold text-blue-600 dark:text-blue-400">CircleUp</h1>
        <p className="mt-4 text-gray-600 dark:text-gray-300">Pursue Meaningful and Active Connection to Others</p>

        <div className="mt-8">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Please sign in to continue</p>
          
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm text-sm disabled:opacity-60"
          >
            {loading ? <Spinner size={20} /> : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M21.35 11.1h-9.36v2.92h5.36c-.23 1.45-1.01 2.67-2.15 3.49v2.9h3.48c2.04-1.88 3.22-4.66 3.22-8.31 0-.63-.06-1.24-.15-1.99z"/><path d="M12 22c2.7 0 4.97-.9 6.63-2.44l-3.48-2.9c-.97.65-2.22 1.04-3.15 1.04-2.42 0-4.46-1.64-5.19-3.85H3.22v2.42C4.88 19.98 8.21 22 12 22z"/><path d="M6.81 13.37A6.99 6.99 0 016 12c0-.67.11-1.32.31-1.93V7.65H3.22A9.99 9.99 0 002 12c0 1.64.39 3.19 1.07 4.6l3.72-3.23z"/><path d="M12 6.24c1.47 0 2.79.5 3.84 1.48l2.88-2.88C16.96 2.95 14.71 2 12 2 8.21 2 4.88 4.02 3.22 7.65l3.09 2.42C7.54 7.88 9.58 6.24 12 6.24z"/></svg>
                <span>Sign in with Google</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};