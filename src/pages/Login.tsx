// src/pages/Login.tsx
import React, { useState, useRef, useEffect } from "react";
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
import { auth, db } from "../config/firebase";
import { type User } from "../types/index";

const REFERRAL_REWARD = 0.25;
const REFERRAL_CAP = 1.0;

/* -------------------------------------------------------
   DEVICE ID HANDLER
------------------------------------------------------- */
const getDeviceId = () => {
  const KEY = "rb_device_id";

  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        id = crypto.randomUUID();
      } else {
        id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      }
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "unknown";
  }
};

interface LoginProps {
  user: User | null;
}

export const Login: React.FC<LoginProps> = ({ user }) => {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const referredByParam = params.get("ref") || null;

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [agreeTOS, setAgreeTOS] = useState(false);
  const [agreePP, setAgreePP] = useState(false);
  const [agreeED, setAgreeED] = useState(false);

  const lastResendRef = useRef(0);

  /* -------------------------------------------------------
     PERSIST REFERRAL CODE FROM URL
     - If /login?ref=ABC123, store it so it survives navigation
  ------------------------------------------------------- */
  useEffect(() => {
    if (referredByParam) {
      try {
        localStorage.setItem("referralCode", referredByParam);
      } catch {
        // ignore storage issues (private mode, etc.)
      }
    }
  }, [referredByParam]);

  /* -------------------------------------------------------
     LOGGED IN VIEW
  ------------------------------------------------------- */
  if (user) {
    return (
      <main className="rb-content">
        <div className="login-card">
          <h2 id="login-title">Account</h2>

          <div id="logout-section" style={{ textAlign: "center" }}>
            <p style={{ color: "var(--soft-sugar)" }}>
              Logged in as <b>{user.username}</b> <br />
              UID: <span style={{ opacity: 0.8 }}>{user.uid}</span>
            </p>

            {!user.emailVerified && (
              <>
                <p style={{ color: "var(--golden-toast)", marginTop: "10px" }}>
                  Please verify your email to access earning features.
                </p>
                <button
                  onClick={() => resendVerificationEmail()}
                  style={{ marginTop: "10px" }}
                >
                  Resend verification email
                </button>
              </>
            )}

            <button
              style={{ marginTop: "20px" }}
              onClick={() => signOut(auth)}
            >
              Logout
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* -------------------------------------------------------
     RESEND VERIFICATION EMAIL
  ------------------------------------------------------- */
  const resendVerificationEmail = async () => {
    const now = Date.now();
    if (now - lastResendRef.current < 30000) {
      alert("Please wait before resending verification email.");
      return;
    }

    if (!auth.currentUser) {
      alert("You must be logged in.");
      return;
    }

    try {
      await sendEmailVerification(auth.currentUser);
      lastResendRef.current = now;
      alert("Verification email sent!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  /* -------------------------------------------------------
     REFERRAL BONUS AFTER FIRST VERIFIED LOGIN
     (client-side fallback; main payout handled in Cloud Function)
  ------------------------------------------------------- */
  const applyReferralBonusIfQualified = async (uid: string) => {
    const userRef = doc(db, "users", uid);
    const uSnap = await getDoc(userRef);

    if (!uSnap.exists()) return;

    const uData = uSnap.data();

    if (!uData.referredBy) return;
    if (!uData.referralPending) return;

    const referredDeviceId = uData.deviceId || null;

    // lookup referrer
    const qRef = query(
      collection(db, "users"),
      where("referralCode", "==", uData.referredBy)
    );

    const snapRef = await getDocs(qRef);
    if (snapRef.empty) {
      await updateDoc(userRef, { referralPending: false });
      return;
    }

    const referrerDoc = snapRef.docs[0];
    const referrerId = referrerDoc.id;
    const refData = referrerDoc.data();

    const referrerDeviceId = refData.deviceId || null;
    const sameDevice =
      !!referrerDeviceId &&
      !!referredDeviceId &&
      referrerDeviceId === referredDeviceId;

    const current = refData.totalReferralEarnings || 0;

    // Pay referrer
    if (!sameDevice && current < REFERRAL_CAP) {
      await updateDoc(doc(db, "users", referrerId), {
        balance: increment(REFERRAL_REWARD),
        totalReferralEarnings: increment(REFERRAL_REWARD),
      });
    }

    // Mark that referral is done
    await updateDoc(userRef, { referralPending: false });
  };

  /* -------------------------------------------------------
     LOGIN LOGIC (CLEANED & FIXED)
  ------------------------------------------------------- */
  const handleLogin = async () => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);

      if (!cred.user.emailVerified) {
        await signOut(auth);
        alert("Please verify your email before logging in.");
        return;
      }

      // Hit cloud function (backend handles real referral payout + subdocs)
      try {
        await fetch(
          `https://us-central1-readybread-56d81.cloudfunctions.net/processReferrals?uid=${cred.user.uid}`
        );
      } catch (err) {
        console.error("Referral cloud function failed:", err);
      }

      // Frontend fallback (will be mostly blocked by rules, but kept as a feature)
      await applyReferralBonusIfQualified(cred.user.uid);

      alert("Logged in!");
      navigate("/");
    } catch (err: any) {
      alert(err.message);
    }
  };

  /* -------------------------------------------------------
     SIGN UP — FIXED TO MATCH SECURITY RULES
------------------------------------------------------- */
  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      alert("Please fill all fields.");
      return;
    }
    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }
    if (!agreeTOS || !agreePP || !agreeED) {
      alert("You must agree to all required fields.");
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      const deviceId = getDeviceId();

      // Prefer ?ref= from URL; if missing, fall back to saved localStorage code
      let referredBy: string | null = referredByParam;
      if (!referredBy) {
        try {
          referredBy = localStorage.getItem("referralCode");
        } catch {
          referredBy = null;
        }
      }

      /* -----------------------------
         1) Create Firestore doc
         MUST follow your strict rules
      ----------------------------- */
      await setDoc(doc(db, "users", uid), {
        balance: 0,
        isBanned: false,
        admin: false,
        createdAt: serverTimestamp(),

        referralCode: uid.slice(-6).toUpperCase(),
        referredBy: referredBy || null,

        // Extra fields allowed:
        email,
        username: email.split("@")[0],
        deviceId,

        referralPending: referredBy ? true : false,
        totalReferralEarnings: 0,
        shortcutBonusClaimed: false,
        auditLog: [],
      });

      /* -----------------------------
         2) Send verification email
      ----------------------------- */
      await sendEmailVerification(cred.user);

      /* -----------------------------
         3) Trigger backend referral logic
         (It will only pay after email is verified)
      ----------------------------- */
      try {
        await fetch(
          `https://us-central1-readybread-56d81.cloudfunctions.net/processReferrals?uid=${uid}`
        );
      } catch (err) {
        console.error("Referral function failed:", err);
      }

      // Clear saved referral code now that it's attached to an account
      try {
        localStorage.removeItem("referralCode");
      } catch {
        // ignore
      }

      alert("A verification email has been sent. Please verify before logging in.");

      await signOut(auth);
      setIsSignUp(false);
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
              <br />
              Don't have an account? Sign up →
            </p>
          </>
        ) : (
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
              <br />
              Already have an account? Login →
            </p>
          </>
        )}
      </div>
    </main>
  );
};
