// src/pages/Login.tsx
import React, { useState, /* useRef */ useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

import { app, auth, db } from "../config/firebase";
import { useUser } from "../contexts/UserContext";

// Referral reward constants
const REFERRAL_REWARD = 0.25;
const REFERRAL_CAP = 1.0;

/* -------------------------------------------------------
   DEVICE ID GENERATION
------------------------------------------------------- */
const getDeviceId = () => {
  const KEY = "rb_device_id";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);

      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "unknown";
  }
};

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { authUser, profile, loading } = useUser();
  const [params] = useSearchParams();

  // ?ref= in URL
  const referredByParam = params.get("ref") || null;

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [agreeTOS, setAgreeTOS] = useState(false);
  const [agreePP, setAgreePP] = useState(false);
  const [agreeED, setAgreeED] = useState(false);

  // const lastResendRef = useRef(0);

  /* -------------------------------------------------------
     Persist ?ref= for signup
  ------------------------------------------------------- */
  useEffect(() => {
    if (referredByParam) {
      try {
        localStorage.setItem("referralCode", referredByParam);
      } catch {
        // ignore storage errors
      }
    }
  }, [referredByParam]);

  /* -------------------------------------------------------
     AUTO-REDIRECT LOGGED IN USERS
     - Verified → dashboard
     - Unverified → stay here with a prompt
  ------------------------------------------------------- */
  useEffect(() => {
    if (loading) return;

    if (authUser && profile) {
      if (authUser.emailVerified) {
        navigate("/dashboard");
      } else {
        // Unverified users stay on this page
        // (you can show a banner here if you want later)
      }
    }
  }, [authUser, profile, loading, navigate]);

  // /* -------------------------------------------------------
  //    RESEND VERIFICATION
  // ------------------------------------------------------- */
  // const resendVerificationEmail = async () => {
  //   const now = Date.now();
  //   if (now - lastResendRef.current < 30000) {
  //     alert("Please wait ~30 seconds before resending.");
  //     return;
  //   }

  //   if (!auth.currentUser) {
  //     alert("You must be logged in.");
  //     return;
  //   }

  //   await sendEmailVerification(auth.currentUser);
  //   alert("Verification email sent!");
  //   lastResendRef.current = now;
  // };

  /* -------------------------------------------------------
     APPLY REFERRAL BONUS (fallback)
  ------------------------------------------------------- */
  const applyReferralBonusIfQualified = async (uid: string) => {
    const userRef = doc(db, "users", uid);
    const uSnap = await getDoc(userRef);
    if (!uSnap.exists()) return;

    const uData = uSnap.data();
    if (!uData.referredBy || !uData.referralPending) return;

    const referredDevice = uData.deviceId || null;

    const qRef = query(
      collection(db, "users"),
      where("referralCode", "==", uData.referredBy)
    );
    const snapRef = await getDocs(qRef);

    if (snapRef.empty) {
      await updateDoc(userRef, { referralPending: false });
      return;
    }

    const refDoc = snapRef.docs[0];
    const refData = refDoc.data();

    const refDevice = refData.deviceId || null;
    const sameDevice = refDevice && referredDevice && refDevice === referredDevice;

    const current = refData.totalReferralEarnings || 0;

    if (!sameDevice && current < REFERRAL_CAP) {
      await updateDoc(doc(db, "users", refDoc.id), {
        balance: increment(REFERRAL_REWARD),
        totalReferralEarnings: increment(REFERRAL_REWARD),
      });
    }

    await updateDoc(userRef, { referralPending: false });
  };

  /* -------------------------------------------------------
     LOGIN
  ------------------------------------------------------- */
  const handleLogin = async () => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);

      if (!cred.user.emailVerified) {
        await signOut(auth);
        alert("Please verify your email before logging in.");
        return;
      }

      // Cloud Function to process referrals
      try {
        const functions = getFunctions(app, "us-central1");
        const processReferrals = httpsCallable(functions, "processReferralsCallable");
        await processReferrals({});
      } catch (err) {
        console.error("Referral function error:", err);
      }

      // Fallback referral bonus check
      await applyReferralBonusIfQualified(cred.user.uid);

      navigate("/dashboard");
    } catch (err: any) {
      alert(err.message);
    }
  };

  /* -------------------------------------------------------
     SIGN UP
  ------------------------------------------------------- */
  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      alert("Fill all fields.");
      return;
    }
    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }
    if (!agreeTOS || !agreePP || !agreeED) {
      alert("You must agree to everything.");
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      const deviceId = getDeviceId();

      let referredBy: string | null = referredByParam;
      if (!referredBy) {
        try {
          referredBy = localStorage.getItem("referralCode");
        } catch {
          // ignore
        }
      }

      // Firestore user doc — MUST follow your security rules
      await setDoc(doc(db, "users", uid), {
        balance: 0,
        isBanned: false,
        admin: false,
        createdAt: serverTimestamp(),

        referralCode: uid.slice(-6).toUpperCase(),
        referredBy: referredBy || null,
        referralPending: !!referredBy,

        email,
        username: email.split("@")[0],
        deviceId,

        shortcutBonusClaimed: false,
        totalReferralEarnings: 0,
        auditLog: [],
      });

      // Public profile doc for safe lookups (username, etc.)
      await setDoc(doc(db, "publicProfiles", uid), {
        username: email.split("@")[0],
        createdAt: serverTimestamp(),
      });

      await sendEmailVerification(cred.user);

      // Cloud function to process referrals on signup as well
      try {
        const functions = getFunctions(app, "us-central1");
        const processReferrals = httpsCallable(functions, "processReferralsCallable");
        await processReferrals({});
      } catch {
        // non-fatal
      }

      // Clear stored referral code so it doesn't leak to future signups
      try {
        localStorage.removeItem("referralCode");
      } catch {
        // ignore
      }

      alert(
        "Verification email sent! Please verify before logging in. If you don't see it, check your spam folder."
      );

      // Log them out after signup so they must verify first
      await signOut(auth);
      setIsSignUp(false);
      navigate("/login");
    } catch (err: any) {
      alert(err.message);
    }
  };

  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */
  return (
    <main className="rb-content">
      <div className="login-card">
        <h2 id="login-title">{isSignUp ? "Sign Up" : "Login"}</h2>

        {/* --------------------- LOGIN FORM --------------------- */}
        {!isSignUp ? (
          <>
            <input
              type="email"
              placeholder="Email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button onClick={handleLogin}>Login</button>

            <p
              style={{
                marginTop: "10px",
                cursor: "pointer",
                color: "var(--golden-toast)",
                textAlign: "center",
              }}
              onClick={() => setIsSignUp(true)}
            >
              <br /> Don't have an account? Sign up →
            </p>
          </>
        ) : (
          <>
            {/* --------------------- SIGNUP FORM --------------------- */}
            <input
              type="email"
              placeholder="Email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <input
              type="password"
              placeholder="Confirm Password"
              autoComplete="off"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            <div className="legal-checks">
              <label>
                <input
                  type="checkbox"
                  checked={agreeTOS}
                  onChange={(e) => setAgreeTOS(e.target.checked)}
                />{" "}
                I agree to the{" "}
                <a href="/tos" target="_blank">
                  Terms of Service
                </a>
                .
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={agreePP}
                  onChange={(e) => setAgreePP(e.target.checked)}
                />{" "}
                I have read the{" "}
                <a href="/privacy" target="_blank">
                  Privacy Policy
                </a>
                .
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={agreeED}
                  onChange={(e) => setAgreeED(e.target.checked)}
                />{" "}
                I understand the{" "}
                <a href="/earnings" target="_blank">
                  Earnings Disclaimer
                </a>
                .
              </label>
            </div>

            <button onClick={handleSignUp}>Create Account</button>

            <p
              style={{
                marginTop: "10px",
                cursor: "pointer",
                color: "var(--golden-toast)",
                textAlign: "center",
              }}
              onClick={() => setIsSignUp(false)}
            >
              <br /> Already have an account? Login →
            </p>
          </>
        )}
      </div>
    </main>
  );
};
