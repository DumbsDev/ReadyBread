// src/pages/SimplePlaceholders.tsx
// Simple placeholder pages (Receipts, Misc, Dashboard, 404)

import React from 'react';
import { Link } from 'react-router-dom';

// Coming Soon Page
export const Misc: React.FC = () => {
  return (
    <main className="rb-content">
      <div className="earn-shell">
        <div className="earn-header">
          <div>
            <h2 className="accent-toast">✨ Misc Tasks</h2>
            <p className="earn-sub">Daily bonuses, quick tasks, quizzes & streaks.</p>
          </div>
        </div>

        <div className="survey-list">
          <div className="survey-empty">
            Misc earnings are coming soon.<br /><br />
            Daily streaks & mini tasks will appear here later.
          </div>
        </div>
      </div>
    </main>
  );
};

// 404 PAGE
export const NotFound: React.FC = () => {
  return (
    <main className="rb-content">
      <p id="404">
        Oops! Looks like you hit a snag, there's no page here. Let's get you back to{' '}
        <Link to="/" id="emphasis">earning</Link>!
      </p>
    </main>
  );
};