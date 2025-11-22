// src/App.tsx
import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom"; // <-- added useLocation
import { doc, getDoc, onSnapshot } from "firebase/firestore"; // <-- added onSnapshot
import { db } from "./config/firebase";
import { useAuth } from "./hooks/useAuth";

// Components
import { Header } from "./components/Header";
import { Balance } from "./components/Balance";
import { Loader } from "./components/Loader";

// Pages
import { Dashboard } from "./pages/Dashboard";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Earn } from "./pages/Earn";
import { Surveys } from "./pages/Surveys";
import { Games } from "./pages/Games";
import { Rewards } from "./pages/Rewards";
import { Receipts } from "./pages/Receipts";
import { Misc } from "./pages/Misc";
import { Affiliate } from './pages/Affiliate';
import { NotFound } from "./pages/SimplePlaceholders";
import { Admin } from "./pages/Admin";
import { Security } from "./pages/Security";

// Legal mumbo jumbo
import { Privacy } from "./pages/privacy";
import { TOS } from "./pages/TOS";
import { EarningsDisclaimer } from "./pages/earningdisclaimer";


export const AppInner: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation(); // <-- Added
  const [balance, setBalance] = useState(0);

  const [pageLoading, setPageLoading] = useState(true); // <-- Added loader state

  /* -------------------------------------------------------
     CAPTURE REFERRAL ON URL
  ------------------------------------------------------- */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) localStorage.setItem("referralCode", ref);
  }, []);

  /* -------------------------------------------------------
     ROUTE CHANGE = SHOW LOADER
  ------------------------------------------------------- */
  useEffect(() => {
    setPageLoading(true);
    window.scrollTo(0, 0);

    // slight delay so loader is actually visible
    const t = setTimeout(() => {
      setPageLoading(false);
    }, 250);

    return () => clearTimeout(t);
  }, [location]);

  /* -------------------------------------------------------
     FUNCTION: REFRESH BALANCE FROM FIRESTORE
  ------------------------------------------------------- */
  const refreshBalance = async () => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      setBalance(snap.data().balance || 0);
    }
  };

  /* -------------------------------------------------------
     REFRESH BALANCE WHEN USER FIRST LOADS
  ------------------------------------------------------- */
  useEffect(() => {
    if (user) refreshBalance();
  }, [user]);

  /* -------------------------------------------------------
     LIVE FIRESTORE LISTENER FOR BALANCE
  ------------------------------------------------------- */
  useEffect(() => {
    if (!user) return;

    const ref = doc(db, "users", user.uid);

    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setBalance(snap.data().balance || 0);
      }
    });

    return () => unsub();
  }, [user]);

  /* -------------------------------------------------------
     REFRESH BALANCE IMMEDIATELY AFTER LOGIN
     (triggered by Login.tsx)
  ------------------------------------------------------- */
  useEffect(() => {
    if (user && localStorage.getItem("refreshBalance") === "true") {
      refreshBalance();
      localStorage.removeItem("refreshBalance");
    }
  }, [user]);

  /* -------------------------------------------------------
     GLOBAL LOADER LOGIC:
     Show loader if:
       - auth is loading
       - page is loading
       - balance not loaded yet but user logged in
  ------------------------------------------------------- */
  const showLoader = !!(
  authLoading ||
  pageLoading ||
  (user && balance === null)
);




  return (
  <>
    <Loader show={showLoader} />

    {!showLoader && (
      <>
        <Header user={user} />
        <Balance balance={balance} />

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login user={user} />} />
          <Route path="/surveys" element={<Surveys user={user} />} />
          <Route path="/games" element={<Games user={user} />} />
          <Route
            path="/rewards"
            element={<Rewards user={user} onBalanceUpdate={refreshBalance} />}
          />
          <Route path="/receipts" element={<Receipts user={user}/>} />
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
  element={
    user && user.uid === "c0WrVU0aaOSM4SGrwhWrSlNjJk72" ? (
      <Admin user={user} />
    ) : (
      <NotFound />
    )
  }
/>
          <Route path="*" element={<NotFound />} />
        </Routes>

        {/* ✅ GLOBAL FOOTER HERE */}
        <footer className="rb-header">
          <p>
            ReadyBread by DumbsDev - have an issue, recommendation, or just want to talk?  
            Reach out at <a href="mailto:contact@readybread.xyz">contact@readybread.xyz</a>
            <br /> <br />
            <div className = "footertos">
              <a href="/privacy">Privacy Policy</a> • 
              <a href="/tos">Terms of Service</a> • 
              <a href="/earnings">Earnings Disclaimer</a>
            </div>
          </p>
        </footer>
        {/* ✅ END FOOTER */}
      </>
    )}
  </>
);

};

/* -------------------------------------------------------
   WRAP APPINSIDE BROWSER ROUTER
------------------------------------------------------- */
export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
};
