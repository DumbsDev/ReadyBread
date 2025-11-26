// Utility helpers for XP -> level math shared between Dashboard and Quests.
// Levels scale exponentially so each tier takes meaningfully more XP.

export interface LevelProgress {
  level: number;
  totalXp: number;
  currentXp: number;
  nextLevelXp: number;
  progressPct: number;
}

const BASE_XP = 120;
const GROWTH_RATE = 1.35;

export const xpForLevel = (level: number): number => {
  if (level <= 1) return BASE_XP;
  return Math.round(BASE_XP * Math.pow(GROWTH_RATE, level - 1));
};

export const computeLevelProgress = (totalXp: number): LevelProgress => {
  let xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  let requirement = xpForLevel(level);

  while (xp >= requirement) {
    xp -= requirement;
    level += 1;
    requirement = xpForLevel(level);
  }

  const progressPct = requirement === 0 ? 0 : Math.min(100, (xp / requirement) * 100);

  return {
    level,
    totalXp: Math.max(0, Math.floor(totalXp)),
    currentXp: Math.floor(xp),
    nextLevelXp: requirement,
    progressPct: Math.round(progressPct * 10) / 10,
  };
};

// Lightweight heuristic to keep level movement visible using existing user data.
// This is not a rewards system; it just feeds the on-screen level visual.
export const estimateBaseXp = (opts: {
  balance?: number;
  dailyStreak?: number;
  totalReferrals?: number;
  totalOfferEvents?: number;
} = {}): number => {
  const balanceXp = Math.max(0, (opts.balance ?? 0) * 120); // $1 ~= 120 XP
  const streakXp = Math.max(0, (opts.dailyStreak ?? 0) * 2);
  const referralXp = Math.max(0, (opts.totalReferrals ?? 0) * 8);
  const activityXp = Math.max(0, (opts.totalOfferEvents ?? 0) * 0.5);

  return Math.round(balanceXp + streakXp + referralXp + activityXp);
};
