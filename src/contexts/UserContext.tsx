// src/contexts/UserContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { auth, db } from "../config/firebase";
import { doc, getDoc, onSnapshot } from "firebase/firestore";

import type { RBUser } from "../types";

/* ------------------------------------------------------------
   FIRESTORE USER PROFILE (strict shape from Firestore)
------------------------------------------------------------ */
export interface UserProfile {
  username: string;
  balance: number;
  email?: string;
  referralCode: string;
  referredBy: string | null;
  totalReferralEarnings: number;
  isBanned: boolean;
  admin: boolean;
  createdAt: any;
  shortcutBonusClaimed: boolean;
}

/* ------------------------------------------------------------
   MERGED USER TYPE
   This is what ALL pages will receive as `user`
   - FirebaseUser (emailVerified, uid, etc.)
   - RBUser fields (username, balance, referralCode, etc.)
   - profile: full Firestore profile object
------------------------------------------------------------ */
export type ReadyBreadUser = Omit<FirebaseUser, "email"> &
  RBUser & {
    email: string; // non-null for app usage
    profile: UserProfile;
  };

/* ------------------------------------------------------------
   CONTEXT SHAPE
------------------------------------------------------------ */
interface UserContextType {
  user: ReadyBreadUser | null;     // merged user object for all pages
  authUser: FirebaseUser | null;   // raw firebase user
  profile: UserProfile | null;     // firestore profile
  balance: number;                 // always a number
  loading: boolean;                // global loading state
  admin: boolean;                  // admin boolean
  refreshProfile: () => Promise<void>;
}

/* ------------------------------------------------------------
   CONTEXT DEFAULT VALUES
------------------------------------------------------------ */
const UserContext = createContext<UserContextType>({
  user: null,
  authUser: null,
  profile: null,
  balance: 0,
  loading: true,
  admin: false,
  refreshProfile: async () => {},
});

/* ------------------------------------------------------------
   USER PROVIDER
------------------------------------------------------------ */
export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  /* ------------------------------------------------------------
     AUTH LISTENER (firebase auth)
  ------------------------------------------------------------ */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      if (!u) {
        setProfile(null);
        setBalance(0);
      }
    });
    return () => unsub();
  }, []);

  /* ------------------------------------------------------------
     FIRESTORE PROFILE LISTENER (live)
  ------------------------------------------------------------ */
  useEffect(() => {
    if (!authUser) {
      setProfile(null);
      setBalance(0);
      setLoading(false);
      return;
    }

    const ref = doc(db, "users", authUser.uid);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          setProfile(data);
          setBalance(data.balance ?? 0);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Firestore profile error:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [authUser]);

  /* ------------------------------------------------------------
     MANUAL PROFILE REFRESH (optional but useful)
  ------------------------------------------------------------ */
  const refreshProfile = async () => {
    if (!authUser) return;
    const ref = doc(db, "users", authUser.uid);
    await getDoc(ref); // forces Firestore to return fresh data
  };

  /* ------------------------------------------------------------
     MERGED USER OBJECT
     Combines:
     - FirebaseUser
     - profile fields
     - RBUser fields
     - profile object attached
  ------------------------------------------------------------ */
  const mergedUser: ReadyBreadUser | null =
    authUser && profile
      ? ({
          ...authUser,   // firebase fields (uid, metadata...)
          ...profile,    // RBUser fields (username, balance, referralCode...)
          email: profile.email || authUser.email || "", // ensure string
          profile,       // original Firestore profile included
        } as ReadyBreadUser)
      : null;

  /* ------------------------------------------------------------
     ADMIN CHECK
  ------------------------------------------------------------ */
  const admin =
    profile?.admin === true ||
    authUser?.uid === "c0WrVU0aaOSM4SGrwhWrSlNjJk72";

  /* ------------------------------------------------------------
     PROVIDER OUTPUT
  ------------------------------------------------------------ */
  return (
    <UserContext.Provider
      value={{
        user: mergedUser,
        authUser,
        profile,
        balance,
        loading,
        admin,
        refreshProfile,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

/* ------------------------------------------------------------
   HOOK
------------------------------------------------------------ */
export const useUser = () => useContext(UserContext);
