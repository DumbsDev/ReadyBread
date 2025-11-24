// src/config/firebase.ts
// This file initializes Firebase for our app
// We import from the NEW Firebase v9+ modular SDK (not compat mode)

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  type Auth,
} from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Your Firebase project configuration
// (Keep these credentials - they're safe for client-side use)
const firebaseConfig = {
  apiKey: "AIzaSyAvnG-Nesta-HERywtlm7ExCx4Wh0YmShY",
  authDomain: "readybread-56d81.firebaseapp.com",
  projectId: "readybread-56d81",
  storageBucket: "readybread-56d81.appspot.com",
  messagingSenderId: "395342082020",
  appId: "1:395342082020:web:68aec4475c0b70729fe1f1",
  measurementId: "G-PNWFC5Z96Y"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Export auth and database instances so other files can use them
const authInstance: Auth = getAuth(app);
void setPersistence(authInstance, browserLocalPersistence).catch((err) => {
  console.warn("Failed to set auth persistence to local:", err);
});

export const auth: Auth = authInstance;
export const db: Firestore = getFirestore(app);
export { app }
