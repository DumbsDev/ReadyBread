import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { auth, db } from "../config/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import type { User } from "../types";

/* ------------------------------------------------------------
   TYPES
------------------------------------------------------------ */

// Your ReadyBread user profile from Firestore
type UserProfile = Omit<User, "uid" | "email" | "emailVerified">;

// The object ALL your pages expect (merged Firebase Auth + Firestore profile)
export type ReadyBreadUser = Omit<FirebaseUser, "email"> &
  User & {
    email: string; // force non-null for app components
    profile: UserProfile;
  };

// Context shape
interface UserContextType {
  user: ReadyBreadUser | null;   // <-- THIS fixes your type errors
  authUser: FirebaseUser | null; // raw firebase user if needed
  profile: UserProfile | null;
  balance: number;
  loading: boolean;
  isAdmin: boolean;
}

/* ------------------------------------------------------------
   CONTEXT DEFAULT
------------------------------------------------------------ */
const UserContext = createContext<UserContextType>({
  user: null,
  authUser: null,
  profile: null,
  balance: 0,
  loading: true,
  isAdmin: false,
});

/* ------------------------------------------------------------
   PROVIDER
------------------------------------------------------------ */
export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  /* ------------------------------------------------------------
     1) AUTH LISTENER
  ------------------------------------------------------------ */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setAuthUser(firebaseUser);
    });

    return () => unsub();
  }, []);

  /* ------------------------------------------------------------
     2) FIRESTORE USER PROFILE
  ------------------------------------------------------------ */
  useEffect(() => {
    if (!authUser) {
      setProfile(null);
      setBalance(0);
      setLoading(false);
      return;
    }

    const ref = doc(db, "users", authUser.uid);

    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<UserProfile>;

        // Ensure required fields exist on the merged user
        const normalizedProfile: UserProfile = {
          balance: 0,
          admin: false,
          username: authUser.email?.split("@")[0] ?? "",
          referralCode: "",
          referredBy: null,
          totalReferralEarnings: 0,
          isBanned: false,
          shortcutBonusClaimed: false,
          ...data,
        };

        setProfile(normalizedProfile);
        setBalance(normalizedProfile.balance);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [authUser]);

  /* ------------------------------------------------------------
     MERGED USER OBJECT
  ------------------------------------------------------------ */
  const mergedUser: ReadyBreadUser | null =
    authUser && profile
      ? ({
          ...authUser,
          ...profile,
          email: authUser.email || "",
          profile,
        } as ReadyBreadUser)
      : null;

  /* ------------------------------------------------------------
     ADMIN CHECK
  ------------------------------------------------------------ */
  const isAdmin =
    profile?.admin === true ||
    authUser?.uid === "c0WrVU0aaOSM4SGrwhWrSlNjJk72";

  /* ------------------------------------------------------------
     PROVIDER VALUE
------------------------------------------------------------ */
  return (
    <UserContext.Provider
      value={{
        user: mergedUser,   // <-- THIS is what all pages receive
        authUser,           // raw firebase user (optional)
        profile,
        balance,
        loading,
        isAdmin,
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
