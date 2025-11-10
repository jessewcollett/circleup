import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.circleupco.app',
  appName: 'CircleUp',
  webDir: 'dist',
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      forceCodeForRefreshToken: false,
      // Optional: set iosClientId explicitly; plugin can also read from GoogleService-Info.plist
      iosClientId: '1031944311075-cmthb2ka9ojm4fku272v78n7bv5kenv9.apps.googleusercontent.com'
    }
  }
};

export default config;
