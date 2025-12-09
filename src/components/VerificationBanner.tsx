import React, { useState } from "react";
import { sendEmailVerification } from "firebase/auth";
import { auth } from "../config/firebase";
import { useUser } from "../contexts/UserContext";

export const VerificationBanner: React.FC = () => {
  const { authUser } = useUser();
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  if (!authUser || authUser.emailVerified) return null;

  const handleSend = async () => {
    if (!auth.currentUser) return;
    setStatus("sending");
    setError(null);
    try {
      await sendEmailVerification(auth.currentUser);
      setStatus("sent");
    } catch (err: any) {
      console.error("Verification email failed", err);
      setStatus("error");
      setError(err?.message || "Failed to send verification email.");
    }
  };

  const handleRefresh = async () => {
    if (!auth.currentUser) return;
    try {
      await auth.currentUser.reload();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="rb-banner verify-banner">
      <div>
        <p className="banner-title">Verify your email</p>
        <p className="dash-muted">
          Verification keeps payouts and offerwalls secure. Check spam or click
          resend below.
        </p>
        {status === "sent" && (
          <p className="banner-success">Verification email sent. Please check your inbox.</p>
        )}
        {status === "error" && (
          <p className="banner-error">{error || "Could not send email. Try again in a minute."}</p>
        )}
      </div>
      <div className="verify-actions">
        <button
          className="rb-btn"
          onClick={handleSend}
          disabled={status === "sending"}
        >
          {status === "sending" ? "Sending..." : "Send verification"}
        </button>
        <button className="rb-btn rb-btn-secondary" onClick={handleRefresh}>
          Refresh status
        </button>
      </div>
    </div>
  );
};
