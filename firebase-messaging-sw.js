// [firebase-messaging-sw.js]
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-compat.js');

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


const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
