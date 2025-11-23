// src/App.tsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

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

// LEGAL
import { Privacy } from "./pages/privacy";
import { TOS } from "./pages/TOS";
import { EarningsDisclaimer } from "./pages/earningdisclaimer";

export const AppInner: React.FC = () => {
  const { user, profile, balance, loading, isAdmin } = useUser();

  const showLoader: boolean = loading || (user !== null && profile === null);

  return (
    <>
      <Loader show={showLoader} />

      <Header user={user} />

      {user && profile && <Balance balance={balance} />}

      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/login" element={<Login />} />

        <Route path="/surveys" element={<Surveys />} />

        <Route path="/games" element={<Games />} />

        <Route path="/rewards" element={<Rewards />} />

        <Route path="/receipts" element={<Receipts />} />

        <Route path="/security" element={<Security />} />

        <Route path="/misc" element={<Misc />} />

        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/earn" element={<Earn />} />
        <Route path="/affiliate" element={<Affiliate />} />


        <Route path="/privacy" element={<Privacy />} />

        <Route path="/tos" element={<TOS />} />

        <Route path="/earnings" element={<EarningsDisclaimer />} />

        <Route
          path="/admin"
          element={isAdmin ? <Admin /> : <NotFound />}
        />



        <Route path="*" element={<NotFound />} />
      </Routes>

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

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
};
