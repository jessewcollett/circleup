import React, { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signInWithCredential, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import { auth } from '../firebase';
import Spinner from './Spinner';
import { Capacitor } from '@capacitor/core';

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(() => {
    const saved = localStorage.getItem('circleup_login_email_expanded');
    return saved === 'true';
  });

  const handleEmailLogin = async () => {
    console.log('[Login] handleEmailLogin called');
    setLoading(true);
    setError(null);
    try {
      console.log('[Login] Attempting signInWithEmailAndPassword');
      await signInWithEmailAndPassword(auth, email.trim(), password);
      console.log('[Login] signInWithEmailAndPassword success');
    } catch (e: any) {
      console.error('[Login] signInWithEmailAndPassword error:', e);
      setError(e?.message || 'Login failed');
    } finally {
      setLoading(false);
      console.log('[Login] handleEmailLogin finished');
    }
  };

  const handleEmailSignup = async () => {
    console.log('[Login] handleEmailSignup called');
    setLoading(true);
    setError(null);
    try {
      console.log('[Login] Attempting createUserWithEmailAndPassword');
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      console.log('[Login] createUserWithEmailAndPassword success');
    } catch (e: any) {
      console.error('[Login] createUserWithEmailAndPassword error:', e);
      setError(e?.message || 'Sign up failed');
    } finally {
      setLoading(false);
      console.log('[Login] handleEmailSignup finished');
    }
  };

  const handleGuest = async () => {
    const confirmed = window.confirm(
      '⚠️ Guest Mode Limitations\n\n' +
      'In guest mode:\n' +
      '• Your data is stored ONLY on this device\n' +
      '• No sync across devices\n' +
      '• Data will be lost if you clear browser data\n' +
      '• You can upgrade to a full account later to enable sync\n\n' +
      'Continue as guest?'
    );
    
    if (!confirmed) return;

    console.log('[Login] handleGuest called');
    setLoading(true);
    setError(null);
    try {
      console.log('[Login] Attempting signInAnonymously');
      await signInAnonymously(auth);
      console.log('[Login] signInAnonymously success');
    } catch (e: any) {
      console.error('[Login] signInAnonymously error:', e);
      setError(e?.message || 'Guest sign-in failed');
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    console.log('[Login] handleGoogleLogin called');
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      if (Capacitor.isNativePlatform()) {
        console.log('[Login] Native platform detected, importing GoogleAuth');
        const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
        try {
          console.log('[Login] Initializing GoogleAuth');
          await GoogleAuth.initialize({ scopes: ['profile', 'email'] });
        } catch (e) {
          console.warn('[Login] GoogleAuth already initialized or error:', e);
        }
        console.log('[Login] Signing in with GoogleAuth');
        const googleUser = await GoogleAuth.signIn();
        const idToken = googleUser?.authentication?.idToken;
        const accessToken = googleUser?.authentication?.accessToken;
        if (!idToken) throw new Error('Missing idToken from native Google sign-in');
        const credential = GoogleAuthProvider.credential(idToken, accessToken);
        await signInWithCredential(auth, credential);
        console.log('[Login] signInWithCredential success');
      } else {
        console.log('[Login] Web platform detected, signing in with popup');
        await signInWithPopup(auth, provider);
        console.log('[Login] signInWithPopup success');
      }
      // onAuthStateChanged in App.tsx will proceed
    } catch (e: any) {
      console.error('[Login] Google sign-in error:', e);
      setError(e?.message || 'Google sign-in failed');
      setLoading(false);
    }
  };

  const canSubmit = email.trim().length > 0 && password.length >= 6;

  const toggleEmailForm = () => {
    setShowEmailForm(prev => {
      const next = !prev;
      localStorage.setItem('circleup_login_email_expanded', String(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">CircleUp</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">Please sign in to continue</p>
        </div>

        <div className="mt-6 space-y-4">
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

          {/* Error area (global) */}
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</div>
          )}

          {/* Collapsible Email/Password section */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-md">
            <button
              type="button"
              onClick={toggleEmailForm}
              className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-t-md"
              aria-expanded={showEmailForm}
              aria-controls="email-section"
            >
              <span>Login / Sign-Up with Email</span>
              <svg className={`h-5 w-5 transition-transform ${showEmailForm ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.25 4.25a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
            </button>
            {showEmailForm && (
              <div id="email-section" className="p-4 space-y-3 border-t border-gray-200 dark:border-gray-700">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field mt-1"
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field mt-1"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={loading}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleEmailLogin}
                    disabled={loading || !canSubmit}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
                  >
                    {loading ? <Spinner size={20} /> : 'Login'}
                  </button>
                  <button
                    onClick={handleEmailSignup}
                    disabled={loading || !canSubmit}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-60"
                  >
                    {loading ? <Spinner size={20} /> : 'Sign Up'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Guest option - deemphasized */}
          <div className="pt-1 text-center">
            <button
              onClick={handleGuest}
              disabled={loading}
              className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline-offset-2 hover:underline disabled:opacity-60"
              title="Guest mode: Data won't sync across devices and is stored only locally."
              aria-label="Continue as guest with limited features"
            >
              {loading ? <Spinner size={16} /> : 'Continue as Guest (limited)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
