// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from 'firebase/auth';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

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
const analytics = getAnalytics(app);
export const auth = getAuth(app);