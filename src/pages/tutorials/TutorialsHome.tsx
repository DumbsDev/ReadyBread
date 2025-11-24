// src/pages/tutorials/TutorialsHome.tsx
import React from "react";
import "../tutorials.css";
import { tutorialCategories } from "../../config/tutorials";
import { Link } from "react-router-dom";

export const TutorialsHome: React.FC = () => {
  return (
    <div className="tutorials-container">
      <h1 className="tutorials-title">Tutorial Center</h1>
      <p className="tutorials-sub">
        Choose a category to learn how ReadyBread works.
      </p>

      <div className="tutorials-grid">
        {tutorialCategories.map((cat) => (
          <Link
            key={cat.id}
            to={`/tutorials/${cat.id}`}
            className="tutorial-category-card"
          >
            <span className="tutorial-category-icon">{cat.icon}</span>
            <h2>{cat.name}</h2>
            <p>{cat.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
};
