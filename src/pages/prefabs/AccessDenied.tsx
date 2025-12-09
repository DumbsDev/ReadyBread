import React from "react";

export const AccessDenied: React.FC<{ message?: string }> = ({ message }) => (
  <main className="rb-content">
    <div className="dash-card modern-card glassy-card admin-denied">
      <h2>Access denied</h2>
      <p className="dash-muted">
        {message || "You do not have permission to view this page."}
      </p>
    </div>
  </main>
);

export default AccessDenied;
