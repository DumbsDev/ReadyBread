// src/pages/Home.tsx
import React from "react";
import { Link } from "react-router-dom";
import { ChangelogCard } from "../components/ChangelogCard";

export const Home: React.FC = () => {
  return (
    <main className="rb-content theme-games home-wrapper">

      {/* ---------------------- */}
      {/* TITLE + SLOGAN SECTION */}
      {/* ---------------------- */}
      <section className="home-hero rb-card">
        <h1 className="home-title">
          Welcome to <span className="accent-wheated">ReadyBread</span>
        </h1>
        <p className="home-slogan">Ready to earn some Bread?</p>

        <p className="home-sub">
          Fast, fun, and rewarding. We're your one way ticket to your fun-money ;)
        </p>
      </section>


      {/* ---------------------- */}
      {/* EARNING OPTIONS GRID   */}
      {/* ---------------------- */}
      <section className="home-section rb-card home-earn-grid">
        <h2 className="section-heading">Ready to earn?</h2>

        <div className="modern-grid">
          
          {/* GAMES (always first) */}
          <Link to="/games" className="modern-card games-card">
            <div className="modern-icon"><span className="emoji">🎮</span></div>
            <div className="modern-title-sm">Games</div>
            <div className="modern-desc">
              Play games, hit goals, and cash out <i>real money</i>, no strings attached.
            </div>
          </Link>

          {/* SURVEYS */}
          <Link to="/surveys" className="modern-card surveys-card">
            <div className="modern-icon"><span className="emoji">📋</span></div>
            <div className="modern-title-sm">Surveys</div>
            <div className="modern-desc">
              Answer questions and surveys to make some dough from our verified partners.
            </div>
          </Link>

          {/* CASHOUT */}
          <Link to="/rewards" className="modern-card receipts-card">
            <div className="modern-icon"><span className="emoji">💰</span></div>
            <div className="modern-title-sm">Cash Out</div>
            <div className="modern-desc">
              Withdraw earnings with as little as $3. Not points, and no withdraw fees.
            </div>
          </Link>

          {/* DASHBOARD */}
          <Link to="/affiliate" className="modern-card gold-card">
            <div className="modern-icon"><span className="emoji">🤝</span></div>
            <div className="modern-title-sm">Affiliates</div>
            <div className="modern-desc">
              Get discounts on game servers, steamkeys, and more!
            </div>
          </Link>

          {/* DASHBOARD */}
          <Link to="/dashboard" className="modern-card misc-card">
            <div className="modern-icon"><span className="emoji">📈</span></div>
            <div className="modern-title-sm">Dashboard</div>
            <div className="modern-desc">
              Track your earnings, history, progress, and more, all in one place.
            </div>
          </Link>

        </div>
      </section>


      {/* ---------------------- */}
      {/* MISSION STATEMENT      */}
      {/* ---------------------- */}
      <section className="home-section rb-card mission-card">
        <h2 className="section-heading">Our Mission</h2>
        <p className="mission-text">
          ReadyBread is a <b>user-first</b> earning platform built to be simple, fair,
          and transparent. Unlike our competitors, we don’t use confusing point systems
          or pass lame fees at checkout onto you. What you see at the top of the screen is what you get.
          <br /><br />
          We’re committed to offering <b>reliable cashouts</b>,
          and <b>zero withdrawal fees.</b> All platform costs are handled upfront so you
          never earn less than promised.
          <br /><br />
          Our goal? To be the most trusted place for the modern generation to earn cash doing surveys, games, tasks, and future
          earn-opportunities. We seek to be a platform that respects users.
        </p>
      </section>


    {/* ---------------------- */}
    {/* CHANGELOG / LATEST NEWS */}
    {/* ---------------------- */}
      <ChangelogCard />

      <div className="changelog-link-wrapper">
        <a 
          href="https://github.com/DumbsDev/ReadyBread-Changelog"
          target="_blank"
          rel="noopener noreferrer"
          className="rb-btn-small"
        >
          🔗 View on GitHub
        </a>
      </div>


    {/* ---------------------- */}
      {/* FOOTER (Simple for now) */}
      {/* ---------------------- */}
      <footer className="home-footer">
        <p>© {new Date().getFullYear()} ReadyBread - Ready to earn some Bread?</p>
      </footer>

    </main>
  );
};
