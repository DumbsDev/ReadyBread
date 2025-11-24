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
import { Rewards } from "./pages/Rewards";
import { Receipts } from "./pages/Receipts";
import { Misc } from "./pages/Misc";
import { Affiliate } from "./pages/Affiliate";
import { NotFound } from "./pages/SimplePlaceholders";
import { Admin } from "./pages/Admin";
import { Security } from "./pages/Security";
import { Landing } from "./pages/landing";
import { TutorialsHome } from "./pages/tutorials/TutorialsHome";
import { TutorialCategory } from "./pages/tutorials/TutorialCategory";
import { TutorialArticle } from "./pages/tutorials/TutorialArticle";

// LEGAL
import { Privacy } from "./pages/privacy";
import { TOS } from "./pages/TOS";
import { EarningsDisclaimer } from "./pages/earningdisclaimer";

// -----------------------------------------------------
// LANDING GATE — Handles "/" logic
// -----------------------------------------------------
const LandingGate: React.FC = () => {
  const { user, loading } = useUser();

  // Show loader while Firebase auth state is unknown
  if (loading) {
    return (
      <main className="rb-content theme-games">
        <section className="earn-shell">
          <p className="rb-section-sub">Checking your account…</p>
        </section>
      </main>
    );
  }

  // Logged in → skip landing, go home
  if (user) {
    return <Navigate to="/home" replace />;
  }

  return <Landing />;
};

// -----------------------------------------------------
// MAIN APP INNER
// -----------------------------------------------------
export const AppInner: React.FC = () => {
  const { user, profile, balance, loading, admin } = useUser();

  const showLoader: boolean = loading || (user !== null && profile === null);

  return (
    <>
      <Loader show={showLoader} />

      {/* Header always visible (landing, login, everything) */}
      <Header user={user} />

      {/* Balance shows only when logged in + profile loaded */}
      {user && profile && <Balance balance={balance} />}

      <Routes>
        {/* Public landing page */}
        <Route path="/" element={<LandingGate />} />

        {/* Authenticated home/dashboard */}
        <Route path="/home" element={<Home />} />

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
        <Route path="/earn" element={<Earn />} />
        <Route path="/affiliate" element={<Affiliate />} />

        {/* Legal pages */}
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/tos" element={<TOS />} />
        <Route path="/earnings" element={<EarningsDisclaimer />} />

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
      <footer className="rb-header">
        <p>
          ReadyBread by DumbsDev — have an issue or recommendation?
          Contact: <a href="mailto:contact@readybread.xyz">contact@readybread.xyz</a>
          <br /><br />
          <div className="footertos">
            <a href="/privacy">Privacy Policy</a> •
            <a href="/tos">Terms of Service</a> •
            <a href="/earnings">Earnings Disclaimer</a>
          </div>
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
