// src/pages/tutorials/TutorialCategory.tsx
import React from "react";
import "../tutorials.css";
import { useParams, Link } from "react-router-dom";
import { tutorialCategories } from "../../config/tutorials";

export const TutorialCategory: React.FC = () => {
  const { category } = useParams();

  const cat = tutorialCategories.find((c) => c.id === category);

  if (!cat) return <div className="tutorials-container">Category not found.</div>;

  return (
    <div className="tutorials-container">
      <Link to="/tutorials" className="back-button">
        ← Back
      </Link>

      <h1 className="tutorials-title">{cat.icon} {cat.name}</h1>
      <p className="tutorials-sub">{cat.description}</p>

      <div className="question-list">
        {cat.articles.map((article) => (
          <Link
            key={article.slug}
            to={`/tutorials/${cat.id}/${article.slug}`}
            className="question-card"
          >
            <h3>{article.title}</h3>
            <p>Click to read</p>
          </Link>
        ))}
      </div>
    </div>
  );
};
