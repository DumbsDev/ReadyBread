// src/App.tsx
import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// GLOBAL USER CONTEXT
import { useUser } from "./contexts/UserContext";

// COMPONENTS
import { Header } from "./components/Header";
// import { Balance } from "./components/Balance";
import { Loader } from "./components/Loader";
import { VerificationBanner } from "./components/VerificationBanner";

// Articles
import ArticlePage from "./pages/articles/ArticlePage";
import ArticlesHome from "./pages/articles/articlesHome";

import { useShortcutBonus } from "./hooks/useShortcutBonus";
import { useFingerprintLogger } from "./hooks/useFingerprintLogger";

const lazyPage = (
  loader: () => Promise<Record<string, unknown>>,
  exportName: string
): React.LazyExoticComponent<React.ComponentType<any>> =>
  React.lazy(async () => {
    const mod = await loader();
    const component = mod[exportName] as React.ComponentType<any> | undefined;

    if (!component) {
      throw new Error(`Lazy load failed: export "${exportName}" missing.`);
    }

    return { default: component };
  });

// PAGES (lazy for smaller bundles/faster minify)
const Dashboard = lazyPage(() => import("./pages/Dashboard"), "Dashboard");
const Home = lazyPage(() => import("./pages/Home"), "Home");
const Login = lazyPage(() => import("./pages/Login"), "Login");
const Earn = lazyPage(() => import("./pages/Earn"), "Earn");
const Surveys = lazyPage(() => import("./pages/Surveys"), "Surveys");
const Games = lazyPage(() => import("./pages/Games"), "Games");
const OfferWalls = lazyPage(() => import("./pages/OfferWalls"), "OfferWalls");
const KiwiWall = lazyPage(() => import("./pages/KiwiWall"), "KiwiWall");
const CPXWall = lazyPage(() => import("./pages/cpx"), "CPXWall");
const Rewards = lazyPage(() => import("./pages/Rewards"), "Rewards");
const Receipts = lazyPage(() => import("./pages/Receipts"), "Receipts");
const Misc = lazyPage(() => import("./pages/Misc"), "Misc");
const Affiliate = lazyPage(() => import("./pages/Affiliate"), "Affiliate");
const OfferHistoryPage = lazyPage(
  () => import("./pages/OfferHistory"),
  "OfferHistoryPage"
);
const NotFound = lazyPage(
  () => import("./pages/SimplePlaceholders"),
  "NotFound"
);
const Admin = lazyPage(() => import("./pages/Admin"), "Admin");
const Security = lazyPage(() => import("./pages/Security"), "Security");
const Landing = lazyPage(() => import("./pages/landing"), "Landing");
const Quests = lazyPage(() => import("./pages/Quests"), "Quests");

const TutorialsHome = lazyPage(
  () => import("./pages/tutorials/TutorialsHome"),
  "TutorialsHome"
);
const TutorialCategory = lazyPage(
  () => import("./pages/tutorials/TutorialCategory"),
  "TutorialCategory"
);
const TutorialArticle = lazyPage(
  () => import("./pages/tutorials/TutorialArticle"),
  "TutorialArticle"
);

const RevUWall = lazyPage(() => import("./pages/RevU"), "RevUWall");
const PartnerDashboard = lazyPage(
  () => import("./pages/PartnerDashboard"),
  "PartnerDashboard"
);

const BreadGame = React.lazy(() => import("./breadgame/breadGame"));

// LEGAL
const Privacy = lazyPage(() => import("./pages/privacy"), "Privacy");
const TOS = lazyPage(() => import("./pages/TOS"), "TOS");
const EarningsDisclaimer = lazyPage(
  () => import("./pages/earningdisclaimer"),
  "EarningsDisclaimer"
);
const Proof = lazyPage(() => import("./pages/Proof"), "Proof");
const AntiFraud = lazyPage(() => import("./pages/AntiFraud"), "AntiFraud");
const Advertise = lazyPage(() => import("./pages/Advertise"), "Advertise");
const Confirmation = lazyPage(
  () => import("./pages/Confirmation"),
  "Confirmation"
);

const RouteLoader: React.FC = () => (
  <div className="rb-route-fallback">
    <img
      src="/assets/emoji/icon.webp"
      alt="Loading Bread"
      className="loader-bread-img"
    />
  </div>
);

// -----------------------------------------------------
// LANDING GATE ? Handles "/" logic
// -----------------------------------------------------
const LandingGate: React.FC = () => {
  const { user, authUser, profile } = useUser();
  const homeOffersEnabled =
    profile?.homeOffersEnabled === true ||
    user?.profile?.homeOffersEnabled === true ||
    user?.homeOffersEnabled === true;

  // Wait for profile to load when authenticated so we can honor the preference
  if (authUser && !user) {
    return <RouteLoader />;
  }

  // If authenticated and prefers earn-first, go there
  if (user && homeOffersEnabled) return <Navigate to="/earn" replace />;

  // Otherwise default to home when signed in
  if (authUser || user) return <Navigate to="/home" replace />;

  return <Landing />;
};

// -----------------------------------------------------
// MAIN APP INNER
// -----------------------------------------------------
export const AppInner: React.FC = () => {
  const { user, profile, /*balance,*/ loading, admin } = useUser();
  useShortcutBonus();
  useFingerprintLogger();

  const showLoader: boolean = loading || (user !== null && profile === null);

  return (
    <>
      <Loader show={showLoader} />

      {/* Header always visible (landing, login, everything) */}
      <Header user={user} />

      <VerificationBanner />

      {/* Balance shows only when logged in + profile loaded */}
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          {/* Public landing page */}
          <Route path="/" element={<LandingGate />} />

          {/* Authenticated home/dashboard */}
          <Route path="/home" element={<Home />} />
          <Route path="/pages/home" element={<Home />} />

          {/* Auth pages */}
          <Route path="/login" element={<Login />} />
          <Route path="/confirmation" element={<Confirmation />} />

          {/* Earn pages */}
          <Route path="/surveys" element={<Surveys />} />
          <Route path="/games" element={<Games />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/receipts" element={<Receipts />} />
          <Route path="/security" element={<Security />} />
          <Route path="/misc" element={<Misc />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/offer-history" element={<OfferHistoryPage />} />
          <Route path="/quests" element={<Quests />} />
          <Route path="/earn" element={<Earn />} />
          <Route path="/offerwalls" element={<OfferWalls />} />
          <Route path="/kiwiwall" element={<KiwiWall />} />
          <Route path="/cpx" element={<CPXWall />} />
          <Route path="/revu" element={<RevUWall />} />
          <Route path="/RevU" element={<RevUWall />} />
          <Route path="/affiliate" element={<Affiliate />} />
          <Route path="/partner" element={<PartnerDashboard />} />

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
          <Route
            path="/tutorials/:category/:slug"
            element={<TutorialArticle />}
          />
          {/* Articles */}
          <Route path="/articles" element={<ArticlesHome />} />
          <Route path="/articles/:slug" element={<ArticlePage />} />


          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>

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
         © ReadyBread by DumbsDev - Ready to earn some Bread?
         <br />
         <br />
         <br />
        </p>
        <p>
         <br />
         <br />
         <br />
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
