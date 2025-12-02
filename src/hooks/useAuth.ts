// src/hooks/useAuth.ts
import { useState, useEffect } from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import type { User } from "../types";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(
      auth,
      async (firebaseUser: FirebaseUser | null) => {
        if (!firebaseUser) {
          setUser(null);
          setLoading(false);
          return;
        }

        // Require email verification
        if (!firebaseUser.emailVerified) {
          setUser({
            uid: firebaseUser.uid,
            emailVerified: false,
          } as any);
          setLoading(false);
          return;
        }

        const ref = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(ref);

        // If no profile yet, create one automatically
        if (!snap.exists()) {
          const baseUsername = (firebaseUser.email || "").split("@")[0];
          await setDoc(ref, {
            email: firebaseUser.email,
            username: baseUsername,
            usernameLower: baseUsername.toLowerCase(),
            balance: 0,
            warnings: 0,
            banned: false,
            createdAt: serverTimestamp(),
          });
        }

        const freshSnap = await getDoc(ref);

        setUser({
          uid: firebaseUser.uid,
          emailVerified: true,
          ...freshSnap.data(),
        } as User);

        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return { user, loading };
};
