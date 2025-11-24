// src/pages/SurveyUnavailable.tsx
import React from "react";
import { Link } from "react-router-dom";
import "../surveys.css";

export const SurveyUnavailable: React.FC = () => {
  return (
    <main className="rb-content theme-surveys">
      <section className="earn-shell">
        <div className="unavailable-wrapper glass-card">
          <h2 className="unavailable-title">😕 Survey Not Available</h2>
          <p className="unavailable-text">
            Sorry, it seems that survey wasn’t the right fit for you at the
            moment. No worries, we always have fresh ones coming in!
          </p>

          <Link to="/surveys" className="btn-primary unavailable-btn">
            Back to Surveys
          </Link>
        </div>
      </section>
    </main>
  );
};

export default SurveyUnavailable;
