// src/services/authService.ts
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  type User as FirebaseUser
} from "firebase/auth";
import { 
  doc,
  setDoc,
  serverTimestamp
} from "firebase/firestore";
import { auth, db } from "../config/firebase";

/**
 * Create a new user but DO NOT create Firestore
 * until the user verifies their email.
 */
export async function registerUser(email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);

  if (!cred.user.emailVerified) {
    await sendEmailVerification(cred.user);
  }

  // Immediately sign them out so they can't log in until verified
  await signOut(auth);

  return cred.user;
}

/**
 * Login only allowed if user is verified
 */
export async function loginUser(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);

  if (!cred.user.emailVerified) {
    await signOut(auth);
    throw new Error("Please verify your email before logging in.");
  }

  return cred.user;
}

/**
 * Create Firestore profile (called ONLY after verified)
 */
export async function createUserProfile(user: FirebaseUser) {
  const ref = doc(db, "users", user.uid);
  const baseUsername = user.email?.split("@")[0] || "";
  await setDoc(ref, {
    email: user.email,
    username: baseUsername,
    usernameLower: baseUsername.toLowerCase(),
    balance: 0,
    warnings: 0,
    banned: false,
    createdAt: serverTimestamp()
  });
}

/**
 * Logout helper
 */
export function logoutUser() {
  return signOut(auth);
}
