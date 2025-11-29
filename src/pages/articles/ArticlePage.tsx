import React from "react";
import { useParams } from "react-router-dom";
import sortedArticles from "../articles/articlesData";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import "./articleStyles.css"; // <-- new stylesheet

const ArticlePage: React.FC = () => {
  const { slug } = useParams();
  const article = sortedArticles.find((a) => a.slug === slug);

  if (!article) {
    return <div className="article-container">Article not found.</div>;
  }

  return (
    <div className="article-wrapper">
      <div className="article-header">
        <h1>{article.title}</h1>
        <p>{article.description}</p>
      </div>

      <article className="article-content">
        <ReactMarkdown
          children={article.content}
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
        />
      </article>
    </div>
  );
};

export default ArticlePage;
