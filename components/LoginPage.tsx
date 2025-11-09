import React, { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { auth } from '../firebase';
import { migrateLocalToCloud } from '../lib/firestoreSync';
import Spinner from './Spinner';

export const LoginPage = () => {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      // Try popup first (best UX). If popup is blocked (common in new/incognito browsers),
      // fall back to redirect which is more reliable.
      const result = await signInWithPopup(auth, provider);
      console.log('Logged in user (popup):', result.user);
      await migrateLocalToCloud(result.user.uid);
    } catch (error: any) {
      console.error('Popup sign-in failed:', error);
      // If the error indicates popup was blocked or closed, fallback to redirect
      const code = error?.code || '';
      if (code.includes('popup') || code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user') {
        try {
          await signInWithRedirect(auth, provider);
          // redirect will take over; no need to setLoading(false) here
          return;
        } catch (err2) {
          console.error('Redirect sign-in also failed:', err2);
          alert('Login failed. Please try again.');
        }
      } else {
        alert('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
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