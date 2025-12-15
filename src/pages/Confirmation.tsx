import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { applyActionCode, checkActionCode, reload } from "firebase/auth";
import { auth } from "../config/firebase";
import { useUser } from "../contexts/UserContext";

type VerifyStatus =
  | "idle"
  | "verifying"
  | "verified"
  | "error"
  | "invalid";

export const Confirmation: React.FC = () => {
  const { authUser } = useUser();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [status, setStatus] = useState<VerifyStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const mode = params.get("mode");
  const oobCode = params.get("oobCode");

  const isVerifyEmail = useMemo(
    () => mode === "verifyEmail" && Boolean(oobCode),
    [mode, oobCode]
  );

  useEffect(() => {
    let cancelled = false;

    const runVerify = async () => {
      if (!isVerifyEmail || !oobCode) {
        setStatus("idle");
        setMessage(
          "We could not find a verification code in this link. Please open the link from your email."
        );
        return;
      }

      setStatus("verifying");
      setMessage("Verifying your email...");

      try {
        await checkActionCode(auth, oobCode);
        await applyActionCode(auth, oobCode);

        if (auth.currentUser) {
          await reload(auth.currentUser);
        }

        if (cancelled) return;

        setStatus("verified");
        setMessage(
          "Success! Your email is verified. You can log in and continue."
        );

        // If they are already signed in, send them along.
        if (auth.currentUser?.emailVerified) {
          setTimeout(() => navigate("/dashboard"), 1200);
        }
      } catch (err: any) {
        if (cancelled) return;

        const code = err?.code || "";
        if (code.includes("expired") || code.includes("invalid")) {
          setStatus("invalid");
          setMessage(
            "This verification link is no longer valid. Request a new email from the login page."
          );
        } else {
          setStatus("error");
          setMessage(
            "We could not verify this code. Please try again or request a new email."
          );
        }
      }
    };

    void runVerify();

    return () => {
      cancelled = true;
    };
  }, [isVerifyEmail, oobCode, navigate]);

  const heading =
    status === "verified"
      ? "Email verified"
      : status === "verifying"
      ? "Verifying..."
      : status === "invalid"
      ? "Link expired or invalid"
      : status === "error"
      ? "Verification failed"
      : "Check your email";

  return (
    <main className="rb-content">
      <div className="login-card">
        <h2>{heading}</h2>

        <p className="dash-muted">
          {message ||
            "Follow the verification link we sent to your inbox to finish setting up your account."}
        </p>

        {status === "verified" && (
          <p className="dash-muted">
            {authUser?.emailVerified
              ? "Redirecting you to your dashboard..."
              : "You can now log in with your verified email."}
          </p>
        )}

        {status === "invalid" && (
          <p className="dash-muted">
            Return to the login page and request a fresh verification email.
          </p>
        )}

        <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
          <button className="rb-btn" onClick={() => navigate("/login")}>
            Back to login
          </button>
          <button className="rb-btn ghost" onClick={() => navigate("/dashboard")}>
            Go to dashboard
          </button>
        </div>
      </div>
    </main>
  );
};

export default Confirmation;
