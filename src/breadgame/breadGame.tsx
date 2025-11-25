// src/breadgame/BreadGame.tsx
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../config/firebase";
import { type User } from "../types";
import RotatingAd from "./rotatingAd";
import "./breadGame.css";

const CRUMBS_PER_PACKAGE = 50_000;
const PACKAGE_REWARD_CENTS = 1; // 1 cent
const DAILY_CAP_CENTS = 10;
const MAX_PACKAGES_PER_DAY = DAILY_CAP_CENTS / PACKAGE_REWARD_CENTS;
const PACKAGE_COOLDOWN_SECONDS = 60 * 60;
const rotateTime = 30000;

interface BreadGameProps {
  user: User | null;
}

type GameState = {
  crumbs: number;
  clickPowerLevel: number;
  autoClickLevel: number;
  packagesBoughtToday: number;
  todayCents: number;
  lastPackageAt: number | null; // millis
  cosmetics?: Record<string, unknown>;
};

type CrumbPopup = {
  id: number;
  xPercent: number;
  yPercent: number;
  value: number;
};

const defaultState: GameState = {
  crumbs: 0,
  clickPowerLevel: 0,
  autoClickLevel: 0,
  packagesBoughtToday: 0,
  todayCents: 0,
  lastPackageAt: null,
  cosmetics: {},
};

// Ad slots (you’ll swap these keys to AdSense later)
const TOP_BOTTOM_ADS = [
  { key: "b2d7581bf907b49adbf2cbd9d5f23bb2", width: 728, height: 90 },
];

const SIDE_ADS = [
  { key: "2bf0a3e261aa12154f8421f7701033e0", width: 160, height: 600 },
];

const BreadGame: React.FC<BreadGameProps> = ({ user }) => {
  const [state, setState] = useState<GameState>(defaultState);
  const [loading, setLoading] = useState(true);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);

  const [popups, setPopups] = useState<CrumbPopup[]>([]);
  const popupIdRef = useRef(0);

  const uid = user?.uid ?? null;

  const clickPower = useMemo(
    () => 1 + state.clickPowerLevel,
    [state.clickPowerLevel]
  );
  const autoCrumbsPerSec = useMemo(
    () => state.autoClickLevel,
    [state.autoClickLevel]
  );

  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    const handler = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);


  // Keep screen awake while game is visible
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Keep the window device on when focused.
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;

    const requestLock = async () => {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
      } catch (err) {
        console.warn("WakeLock error:", err);
      }
    };

    requestLock();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        requestLock();
      } else {
        // Release when hidden
        wakeLockRef.current?.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      wakeLockRef.current?.release().catch(() => {});
    };
  }, []);


  // Orbit dots: one per auto toaster level, at random-ish angles
  const orbitDots = useMemo(() => {
    return Array.from({ length: state.autoClickLevel }, (_, i) => {
      const angle = (360 / state.autoClickLevel) * i + (Math.random() * 12 - 6);
      return { id: i, angleDeg: angle };
    });
  }, [state.autoClickLevel]);


  // -----------------------------
  // Subscribe to breadgame state
  // -----------------------------
  useEffect(() => {
    if (!uid) {
      setState(defaultState);
      setLoading(false);
      return;
    }

    const stateRef = doc(db, "users", uid, "breadgame", "state");

    const unsub = onSnapshot(
      stateRef,
      async (snap) => {
        if (!snap.exists()) {
          // Create default state once
          await setDoc(
            stateRef,
            {
              ...defaultState,
            },
            { merge: true }
          );
          setState(defaultState);
          setLoading(false);
          return;
        }

        const data = snap.data() || {};
        setState({
          crumbs: typeof data.crumbs === "number" ? data.crumbs : 0,
          clickPowerLevel:
            typeof data.clickPowerLevel === "number"
              ? data.clickPowerLevel
              : 0,
          autoClickLevel:
            typeof data.autoClickLevel === "number"
              ? data.autoClickLevel
              : 0,
          packagesBoughtToday:
            typeof data.packagesBoughtToday === "number"
              ? data.packagesBoughtToday
              : 0,
          todayCents:
            typeof data.todayCents === "number" ? data.todayCents : 0,
          lastPackageAt:
            typeof data.lastPackageAt === "object" &&
            data.lastPackageAt?.toMillis
              ? data.lastPackageAt.toMillis()
              : typeof data.lastPackageAt === "number"
              ? data.lastPackageAt
              : null,
          cosmetics: data.cosmetics ?? {},
        });
        setLoading(false);
      },
      (err) => {
        console.error("Error subscribing to breadgame state:", err);
        setErrorMsg("Could not load game state.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uid]);

  // -----------------------------
  // Cooldown timer from lastPackageAt
  // -----------------------------
  useEffect(() => {
    const lastPackageAt = state.lastPackageAt;
    if (lastPackageAt == null) {
      setCooldownSeconds(0);
      return;
    }

    const update = () => {
      const now = Date.now();
      const nextAllowed =
        lastPackageAt + PACKAGE_COOLDOWN_SECONDS * 1000;
      const diff = nextAllowed - now;
      if (diff <= 0) {
        setCooldownSeconds(0);
      } else {
        setCooldownSeconds(Math.ceil(diff / 1000));
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [state.lastPackageAt]);

  // -----------------------------
  // Crumb popups (Cookie Clicker style)
  // -----------------------------
  const spawnPopup = useCallback((value: number) => {
    const id = popupIdRef.current++;
    // position popups roughly around the bread center (50%, 45%) with small jitter
    const xPercent = 50 + (Math.random() - 0.5) * 24; // +/- 12%
    const yPercent = 45 + (Math.random() - 0.5) * 16; // +/- 8%

    const popup: CrumbPopup = {
      id,
      xPercent,
      yPercent,
      value,
    };

    setPopups((prev) => [...prev, popup]);

    setTimeout(() => {
      setPopups((prev) => prev.filter((p) => p.id !== id));
    }, 700);
  }, []);

  // -----------------------------
  // Crumb updates
  // -----------------------------
  const incrementCrumbs = useCallback(
    async (amount: number, spawnVisual = false) => {
      if (!uid || amount <= 0) return;

      if (spawnVisual) {
        spawnPopup(amount);
      }

      // Optimistic local update
      setState((prev) => ({
        ...prev,
        crumbs: prev.crumbs + amount,
      }));

      try {
        const stateRef = doc(db, "users", uid, "breadgame", "state");
        await updateDoc(stateRef, {
          crumbs: increment(amount),
        });
      } catch (err) {
        console.error("Failed to update crumbs:", err);
      }
    },
    [uid, spawnPopup]
  );

  const handleBreadClick = () => {
    if (!uid || !tabVisible) return;
    incrementCrumbs(clickPower, true);
  };


  useEffect(() => {
    if (!uid || autoCrumbsPerSec <= 0 || !tabVisible) return;

    const interval = setInterval(() => {
      incrementCrumbs(autoCrumbsPerSec, false);
    }, 1000);

    return () => clearInterval(interval);
  }, [uid, autoCrumbsPerSec, tabVisible, incrementCrumbs]);


  // -----------------------------
  // Upgrades
  // -----------------------------
  const upgradeClickPower = async () => {
    if (!uid) return;

    const level = state.clickPowerLevel;
    const cost = 100 * Math.pow(2, level);
    if (state.crumbs < cost) return;

    const stateRef = doc(db, "users", uid, "breadgame", "state");

    // Optimistic local update
    setState((prev) => ({
      ...prev,
      crumbs: prev.crumbs - cost,
      clickPowerLevel: prev.clickPowerLevel + 1,
    }));

    try {
      await updateDoc(stateRef, {
        crumbs: increment(-cost),
        clickPowerLevel: increment(1),
      });
    } catch (err) {
      console.error("Failed to upgrade click power:", err);
    }
  };

  const upgradeAutoToaster = async () => {
    if (!uid) return;

    const level = state.autoClickLevel;
    const cost = 500 * Math.pow(2, level);
    if (state.crumbs < cost) return;

    const stateRef = doc(db, "users", uid, "breadgame", "state");

    setState((prev) => ({
      ...prev,
      crumbs: prev.crumbs - cost,
      autoClickLevel: prev.autoClickLevel + 1,
    }));

    try {
      await updateDoc(stateRef, {
        crumbs: increment(-cost),
        autoClickLevel: increment(1),
      });
    } catch (err) {
      console.error("Failed to upgrade auto toaster:", err);
    }
  };

  // -----------------------------
  // Package purchase (server-side)
  // -----------------------------
  const canBuyPackage = useMemo(() => {
    if (!uid) return false;
    if (state.crumbs < CRUMBS_PER_PACKAGE) return false;
    if (state.packagesBoughtToday >= MAX_PACKAGES_PER_DAY) return false;
    if (state.todayCents >= DAILY_CAP_CENTS) return false;
    if (cooldownSeconds > 0) return false;
    return true;
  }, [uid, state, cooldownSeconds]);

  const cooldownLabel = useMemo(() => {
    if (cooldownSeconds <= 0) return "Ready now";
    const h = Math.floor(cooldownSeconds / 3600);
    const m = Math.floor((cooldownSeconds % 3600) / 60);
    const s = cooldownSeconds % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
    return `${m}:${s.toString().padStart(2, "0")} remaining`;
  }, [cooldownSeconds]);

  const handleBuyPackage = async () => {
    if (!uid || !canBuyPackage || buying) return;
    setErrorMsg(null);
    setBuying(true);

    try {
      const callable = httpsCallable(functions, "breadgameBuyPackage");
      await callable({});
    } catch (err: any) {
      console.error("breadgameBuyPackage error:", err);
      const message =
        err?.message ||
        err?.details ||
        "Could not buy package right now.";
      setErrorMsg(message);
    } finally {
      setBuying(false);
    }
  };

  // -----------------------------
  // Derived progress percent for crumbs
  // -----------------------------
  const crumbsProgressPercent = Math.min(
    100,
    (state.crumbs / CRUMBS_PER_PACKAGE) * 100
  );

  if (!uid) {
    return (
      <div className="breadgame-shell">
        <div
          className="bg-center"
          style={{ alignItems: "center", justifyContent: "center" }}
        >
          <p>You need to be signed in to play the Bread Game.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="breadgame-shell">
        <div
          className="bg-center"
          style={{ alignItems: "center", justifyContent: "center" }}
        >
          <p>Loading your bread…</p>
        </div>
      </div>
    );
  }

  const rewardDollarsDisplay = (PACKAGE_REWARD_CENTS / 100).toFixed(2);

  return (
    <div className="breadgame-shell">
      {/* TOP AD */}
      <header className="bg-top-ad">
        <RotatingAd
          ads={TOP_BOTTOM_ADS}
          rotateMs={rotateTime}
          className="ad-slot ad-slot-top"
        />
      </header>

      {/* MAIN */}
      <div className="bg-main-row">
        {/* LEFT AD */}
        <aside className="bg-left-ad">
          <RotatingAd
            ads={SIDE_ADS}
            rotateMs={rotateTime}
            className="ad-slot ad-slot-side"
          />
        </aside>

        {/* CENTER GAME */}
        <main className="bg-center">
          <div className="bg-progress-wrapper">
            <div className="bg-progress-labels">
              <span>Crumbs toward next package</span>
              <span>
                Packages: {state.packagesBoughtToday}/{MAX_PACKAGES_PER_DAY} ·{" "}
                {state.todayCents}¢ / {DAILY_CAP_CENTS}¢ today
              </span>
            </div>

            <div className="bg-progress-bar">
              <div
                className="bg-progress-fill"
                style={{ width: `${crumbsProgressPercent}%` }}
              />
            </div>

            <div className="bg-progress-footer">
              <small className="bg-progress-caption">
                Each package costs {CRUMBS_PER_PACKAGE.toLocaleString()} crumbs
                and adds ${rewardDollarsDisplay} to your ReadyBread balance.
                You can earn up to {DAILY_CAP_CENTS}¢ per day from this game.
              </small>
              <small className="bg-progress-caption">
                Next package: {cooldownLabel} · Game earnings reset daily at
                midnight EST. Final payouts and limits are enforced on the
                server.
              </small>
            </div>
          </div>

          <div className="bg-center-content">
            <div className="bg-stats">
              <div>Crumbs: {state.crumbs.toLocaleString()}</div>
              <div>Click power: {clickPower} / click</div>
              <div>Auto toaster: {autoCrumbsPerSec} / sec</div>
            </div>

            <div className="bg-bread-wrap">
              {/* Orbiting auto-toaster dots */}
              {orbitDots.map((dot) => (
                <div
                  key={dot.id}
                  className="bg-orbit-dot"
                  style={{
                    transform: `translate(-50%, -50%) rotate(${dot.angleDeg}deg) translate(90px, 0)`,
                  }}
                />
              ))}

              {/* Main bread button */}
              <button
                type="button"
                className="bg-bread-button"
                onClick={handleBreadClick}
              >
                🥖
              </button>

              {/* Floating +crumb popups */}
              {popups.map((popup) => (
                <div
                  key={popup.id}
                  className="bg-crumb-popup"
                  style={{
                    left: `${popup.xPercent}%`,
                    top: `${popup.yPercent}%`,
                  }}
                >
                  +{popup.value}
                </div>
              ))}
            </div>
          </div>

          {errorMsg && (
            <p style={{ color: "#ff9999", fontSize: 12, marginTop: 8 }}>
              {errorMsg}
            </p>
          )}
        </main>

        {/* RIGHT: Upgrades + Package Store */}
        <aside className="bg-upgrades">
          <h3>Upgrades</h3>
          <p className="bg-upgrades-note">
            Bread Clicker is a tiny daily bonus. Most of your earnings still come
            from surveys and offers, this page just makes it more fun to hang
            out and click bread :)
          </p>

          <div className="bg-upgrade-list">
            {/* Click Power */}
            <button
              type="button"
              className="bg-upgrade-btn"
              onClick={upgradeClickPower}
            >
              <div className="bg-upgrade-title">
                Stronger Clicks (Lv. {state.clickPowerLevel})
              </div>
              <div className="bg-upgrade-desc">
                +1 crumb per click each level.
              </div>
              <div className="bg-upgrade-cost">
                Cost:{" "}
                {(100 * Math.pow(2, state.clickPowerLevel)).toLocaleString()}{" "}
                crumbs
              </div>
            </button>

            {/* Auto Toaster */}
            <button
              type="button"
              className="bg-upgrade-btn"
              onClick={upgradeAutoToaster}
            >
              <div className="bg-upgrade-title">
                Auto Toaster (Lv. {state.autoClickLevel})
              </div>
              <div className="bg-upgrade-desc">
                +1 crumb per second each level. Each level also adds an orbiting
                crumb dot around your bread.
              </div>
              <div className="bg-upgrade-cost">
                Cost:{" "}
                {(500 * Math.pow(2, state.autoClickLevel)).toLocaleString()}{" "}
                crumbs
              </div>
            </button>
          </div>

          {/* PACKAGE STORE */}
          <div style={{ marginTop: 18 }}>
            <h3>Package Store</h3>
            <p className="bg-upgrades-note">
              Trade crumbs for ${rewardDollarsDisplay} bread packages. You can
              buy one package per hour, up to {MAX_PACKAGES_PER_DAY} packages (
              {DAILY_CAP_CENTS}¢) per day. Limits and payouts are enforced on
              the server.
            </p>

            <div className="bg-upgrade-list">
              <button
                type="button"
                className="bg-upgrade-btn"
                disabled={!canBuyPackage || buying}
                onClick={handleBuyPackage}
              >
                <div className="bg-upgrade-title">
                  Buy ${rewardDollarsDisplay} Bread Package
                </div>
                <div className="bg-upgrade-desc">
                  Costs {CRUMBS_PER_PACKAGE.toLocaleString()} crumbs.
                </div>
                <div className="bg-upgrade-cost">
                  {state.packagesBoughtToday >= MAX_PACKAGES_PER_DAY
                    ? "Daily package limit reached"
                    : state.todayCents >= DAILY_CAP_CENTS
                    ? "Daily cent cap reached"
                    : state.crumbs < CRUMBS_PER_PACKAGE
                    ? "Not enough crumbs"
                    : cooldownSeconds > 0
                    ? `Next package: ${cooldownLabel}`
                    : buying
                    ? "Buying…"
                    : "Tap to buy"}
                </div>
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* BOTTOM AD */}
      <footer className="bg-bottom-ad">
        <RotatingAd
          ads={TOP_BOTTOM_ADS}
          rotateMs={rotateTime}
          className="ad-slot ad-slot-bottom"
        />
      </footer>
    </div>
  );
};

export default BreadGame;
