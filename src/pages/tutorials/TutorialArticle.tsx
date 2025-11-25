// src/pages/tutorials/TutorialArticle.tsx
import React from "react";
import "../tutorials.css";
import { useParams, Link } from "react-router-dom";
import { tutorialCategories } from "../../config/tutorials";

export const TutorialArticle: React.FC = () => {
  const { category, slug } = useParams<{ category: string; slug: string }>();

  // Ensure params exist before lookup
  if (!category || !slug) {
    return <div className="tutorials-container">Invalid tutorial link.</div>;
  }

  // Find correct category
  const cat = tutorialCategories.find((c) => c.id === category);

  if (!cat) {
    return <div className="tutorials-container">Category not found.</div>;
  }

  // Find article
  const article = cat.articles.find((a) => a.slug === slug);

  if (!article) {
    return <div className="tutorials-container">Tutorial not found.</div>;
  }

  return (
    <div className="tutorials-container">
      <Link to={`/tutorials/${cat.id}`} className="back-button">
        ← Back to {cat.name}
      </Link>

      <h1 className="tutorials-article-title">{article.title}</h1>

      <div className="article-content">
        {article.content.map((para, idx) => (
          <p key={idx} dangerouslySetInnerHTML={{ __html: para }} />
        ))}
      </div>
    </div>
  );
};
