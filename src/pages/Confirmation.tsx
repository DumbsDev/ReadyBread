import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";

export const Confirmation: React.FC = () => {
  const { authUser } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (authUser?.emailVerified) {
      const timer = setTimeout(() => navigate("/dashboard"), 2500);
      return () => clearTimeout(timer);
    }
  }, [authUser?.emailVerified, navigate]);

  return (
    <main className="rb-content">
      <div className="login-card">
        <h2>Email verified</h2>
        <p className="dash-muted">
          Thanks for confirming your email. You can now access payouts and referrals.
        </p>
        {authUser?.emailVerified ? (
          <p className="dash-muted">Redirecting you to your dashboard...</p>
        ) : (
          <p className="dash-muted">
            If you haven't verified yet, please click the link in your inbox to finish.
          </p>
        )}
        <button className="rb-btn" onClick={() => navigate("/dashboard")}>
          Go to dashboard
        </button>
      </div>
    </main>
  );
};

export default Confirmation;
