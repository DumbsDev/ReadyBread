import React from "react";
import { Link } from "react-router-dom";
import articles from "./articlesData";
import "./articles.css";

const ArticlesHome: React.FC = () => {
  return (
    <div className="articles-container">
      <div className="articles-header">
        <h1 className="articles-title">Articles</h1>
        <p className="articles-sub">Fresh tips, guides and insights.</p>
      </div>

      <div className="articles-grid">
        {articles.map((article) => (
          <Link
            key={article.slug}
            to={`/articles/${article.slug}`}
            className="article-card"
          >
            <div className="article-inner">
              <h2 className="article-title">{article.title}</h2>
              <p className="article-desc">{article.description}</p>
              <span className="article-read">Read Article →</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default ArticlesHome;
