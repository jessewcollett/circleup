import React, { useState } from 'react';
import { GoogleAuthProvider, EmailAuthProvider, linkWithCredential, linkWithPopup } from 'firebase/auth';
import { auth } from '../firebase';
import { migrateLocalToCloud, startRealtimeSync } from '../lib/firestoreSync';
import Spinner from './Spinner';
import { Capacitor } from '@capacitor/core';

interface UpgradeAccountModalProps {
  onClose: () => void;
  onUpgradeSuccess: () => void;
}

const UpgradeAccountModal: React.FC<UpgradeAccountModalProps> = ({ onClose, onUpgradeSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleEmailUpgrade = async () => {
    if (!auth.currentUser || !auth.currentUser.isAnonymous) {
      setError('Not in guest mode');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const credential = EmailAuthProvider.credential(email.trim(), password);
      await linkWithCredential(auth.currentUser, credential);
      
      // Now that account is linked, migrate data to cloud
      const uid = auth.currentUser.uid;
      await migrateLocalToCloud(uid);
      
      setSuccess(true);
      setTimeout(() => {
        onUpgradeSuccess();
        onClose();
      }, 2000);
    } catch (e: any) {
      setError(e?.message || 'Upgrade failed');
      setLoading(false);
    }
  };

  const handleGoogleUpgrade = async () => {
    if (!auth.currentUser || !auth.currentUser.isAnonymous) {
      setError('Not in guest mode');
      return;
    }

    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      if (Capacitor.isNativePlatform()) {
        const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
        try {
          await GoogleAuth.initialize({ scopes: ['profile', 'email'] });
        } catch (e) {
          // may already be initialized
        }
        const googleUser = await GoogleAuth.signIn();
        const idToken = googleUser?.authentication?.idToken;
        const accessToken = googleUser?.authentication?.accessToken;
        if (!idToken) throw new Error('Missing idToken from native Google sign-in');
        const credential = GoogleAuthProvider.credential(idToken, accessToken);
        await linkWithCredential(auth.currentUser, credential);
      } else {
        await linkWithPopup(auth.currentUser, provider);
      }

      // Now that account is linked, migrate data to cloud
      const uid = auth.currentUser.uid;
      await migrateLocalToCloud(uid);
      
      setSuccess(true);
      setTimeout(() => {
        onUpgradeSuccess();
        onClose();
      }, 2000);
    } catch (e: any) {
      setError(e?.message || 'Google upgrade failed');
      setLoading(false);
    }
  };

  const canSubmit = email.trim().length > 0 && password.length >= 6;

  if (success) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full text-center">
        <div className="mb-4">
          <svg className="h-16 w-16 text-green-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Account Upgraded!</h2>
        <p className="text-gray-600 dark:text-gray-300">
          Your data is now synced to the cloud and will be available across all your devices.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Upgrade Your Account</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
        Create a permanent account to sync your data across devices. All your current data will be preserved.
      </p>

      <div className="space-y-4">
        <button
          onClick={handleGoogleUpgrade}
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm text-sm disabled:opacity-60"
        >
          {loading ? <Spinner size={20} /> : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M21.35 11.1h-9.36v2.92h5.36c-.23 1.45-1.01 2.67-2.15 3.49v2.9h3.48c2.04-1.88 3.22-4.66 3.22-8.31 0-.63-.06-1.24-.15-1.99z"/><path d="M12 22c2.7 0 4.97-.9 6.63-2.44l-3.48-2.9c-.97.65-2.22 1.04-3.15 1.04-2.42 0-4.46-1.64-5.19-3.85H3.22v2.42C4.88 19.98 8.21 22 12 22z"/><path d="M6.81 13.37A6.99 6.99 0 016 12c0-.67.11-1.32.31-1.93V7.65H3.22A9.99 9.99 0 002 12c0 1.64.39 3.19 1.07 4.6l3.72-3.23z"/><path d="M12 6.24c1.47 0 2.79.5 3.84 1.48l2.88-2.88C16.96 2.95 14.71 2 12 2 8.21 2 4.88 4.02 3.22 7.65l3.09 2.42C7.54 7.88 9.58 6.24 12 6.24z"/></svg>
              <span>Link with Google</span>
            </>
          )}
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">or</span>
          </div>
        </div>

        <div>
          <label htmlFor="upgrade-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
          <input
            id="upgrade-email"
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
          <label htmlFor="upgrade-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
          <input
            id="upgrade-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field mt-1"
            placeholder="••••••••"
            autoComplete="new-password"
            disabled={loading}
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleEmailUpgrade}
            disabled={loading || !canSubmit}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-60"
          >
            {loading ? <Spinner size={20} /> : 'Create Account'}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpgradeAccountModal;
