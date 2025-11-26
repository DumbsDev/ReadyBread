// src/App.tsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// GLOBAL USER CONTEXT
import { useUser } from "./contexts/UserContext";

// COMPONENTS
import { Header } from "./components/Header";
import { Balance } from "./components/Balance";
import { Loader } from "./components/Loader";

// PAGES
import { Dashboard } from "./pages/Dashboard";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Earn } from "./pages/Earn";
import { Surveys } from "./pages/Surveys";
import { Games } from "./pages/Games";
import { OfferWalls } from "./pages/OfferWalls";
import { Rewards } from "./pages/Rewards";
import { Receipts } from "./pages/Receipts";
import { Misc } from "./pages/Misc";
import { Affiliate } from "./pages/Affiliate";
import { NotFound } from "./pages/SimplePlaceholders";
import { Admin } from "./pages/Admin";
import { Security } from "./pages/Security";
import { Landing } from "./pages/landing";
import { Quests } from "./pages/Quests";

import { TutorialsHome } from "./pages/tutorials/TutorialsHome";
import { TutorialCategory } from "./pages/tutorials/TutorialCategory";
import { TutorialArticle } from "./pages/tutorials/TutorialArticle";

import BreadGame from "./breadgame/breadGame";

// LEGAL
import { Privacy } from "./pages/privacy";
import { TOS } from "./pages/TOS";
import { EarningsDisclaimer } from "./pages/earningdisclaimer";
import { Proof } from "./pages/Proof";
import { AntiFraud } from "./pages/AntiFraud";
import { Advertise } from "./pages/Advertise";
import { useShortcutBonus } from "./hooks/useShortcutBonus";

// -----------------------------------------------------
// LANDING GATE ? Handles "/" logic
// -----------------------------------------------------
const LandingGate: React.FC = () => {
  const { user, authUser } = useUser();

  // If any authenticated user exists, go straight to home
  if (authUser || user) return <Navigate to="/home" replace />;

  return <Landing />;
};

// -----------------------------------------------------
// MAIN APP INNER
// -----------------------------------------------------
export const AppInner: React.FC = () => {
  const { user, profile, balance, loading, admin } = useUser();
  useShortcutBonus();

  const showLoader: boolean = loading || (user !== null && profile === null);

  return (
    <>
      <Loader show={showLoader} />

      {/* Header always visible (landing, login, everything) */}
      <Header user={user} />

      {/* Balance shows only when logged in + profile loaded */}
      {user && profile && <Balance balance={balance} user={user} />}

      <Routes>
        {/* Public landing page */}
        <Route path="/" element={<LandingGate />} />

        {/* Authenticated home/dashboard */}
        <Route path="/home" element={<Home />} />
        <Route path="/pages/home" element={<Home />} />

        {/* Auth pages */}
        <Route path="/login" element={<Login />} />

        {/* Earn pages */}
        <Route path="/surveys" element={<Surveys />} />
        <Route path="/games" element={<Games />} />
        <Route path="/rewards" element={<Rewards />} />
        <Route path="/receipts" element={<Receipts />} />
        <Route path="/security" element={<Security />} />
        <Route path="/misc" element={<Misc />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/quests" element={<Quests />} />
        <Route path="/earn" element={<Earn />} />
        <Route path="/offerwalls" element={<OfferWalls />} />
        <Route path="/affiliate" element={<Affiliate />} />

        <Route path="/breadgame" element={<BreadGame user={user} />} />

        {/* Legal pages */}
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/tos" element={<TOS />} />
        <Route path="/earnings" element={<EarningsDisclaimer />} />
        <Route path="/proof" element={<Proof />} />
        <Route path="/anti-fraud" element={<AntiFraud />} />
        <Route path="/advertise" element={<Advertise />} />

        {/* Admin protected route */}
        <Route path="/admin" element={admin ? <Admin /> : <NotFound />} />
        {/* tutorials*/ }
        <Route path="/tutorials" element={<TutorialsHome />} />
        <Route path="/tutorials/:category" element={<TutorialCategory />} />
        <Route path="/tutorials/:category/:slug" element={<TutorialArticle />} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>

      {/* Footer */}
      <footer className="rb-footer">
        <div className="footer-columns">
          <div className="footer-col">
            <h4>Trust &amp; Safety</h4>
            <a href="/#proof">Proof of Payout</a>
            <a href="/anti-fraud">Anti-Fraud Policy</a>
            <a href="/privacy">Privacy Policy</a>
            <a href="/tos">Terms of Service</a>
            <a href="/earnings">Earnings Disclaimer</a>
          </div>
          <div className="footer-col">
            <h4>Earning</h4>
            <a href="/offerwalls">Offer Wall Hub</a>
            <a href="/surveys">Surveys</a>
            <a href="/games">Games</a>
            <a href="/receipts">Magic Receipts</a>
          </div>
          <div className="footer-col">
            <h4>Company</h4>
            <a href="/advertise">Advertise with us</a>
            <a href="mailto:contact@readybread.xyz">contact@readybread.xyz</a>
            <a href="https://x.com/@Ready_Bread" target="_blank" rel="noreferrer">X</a>
            <a href="https://tiktok.com/@ready_bread" target="_blank" rel="noreferrer">TikTok</a>
            <a href="https://instagram.com/@ready_bread" target="_blank" rel="noreferrer">Instagram</a>
          </div>
        </div>
        <p className="footer-note">
          ReadyBread by DumbsDev - Ready to earn some Bread?
        </p>
      </footer>
    </>
  );
};

// -----------------------------------------------------
// Browser Router Wrapper
// -----------------------------------------------------
export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
};
