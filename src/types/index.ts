// src/types/index.ts
// This file defines the "shape" of our data using TypeScript interfaces
// These interfaces describe what properties exist on objects stored
// in Firestore or used throughout the application.

// ------------------------------------------------------------
// READYBREAD USER TYPE (Firestore Profile)
// ------------------------------------------------------------
export interface RBUser {
  uid: string;

  // Core identity fields
  username: string;
  email: string;
  emailVerified: boolean;

  // Balance in USD
  balance: number;

  // Moderation / admin flags
  warnings?: number;
  banned?: boolean;
  isBanned?: boolean; // Some components use banned, others use isBanned
  admin?: boolean;

  // Timestamps
  createdAt?: any;

  // Device fingerprinting for fraud prevention
  deviceId?: string;

  // Referral System
  referralCode?: string;          // user's code that others can use
  referredBy?: string | null;     // referralCode of the referrer
  referralPending?: boolean;      // awaiting first verified login
  totalReferralEarnings?: number; // total earned from referring others

  // Dashboard + Account features
  shortcutBonusClaimed?: boolean;
  shortcutBonusAt?: any;

  // 🔥 Daily streak bonus (server-managed)
  dailyStreak?: number;   // 1, 2, 3... etc.
  bonusPercent?: number;  // e.g. 0, 0.5, 1.0 ... capped at 10
  lastCheckIn?: any;      // Firestore Timestamp

  // Audit trail (admin only)
  auditLog?: any[];
}


// ------------------------------------------------------------
// SURVEY TYPE (BitLabs)
// ------------------------------------------------------------
export interface Survey {
  id: string;
  category?: { name: string };
  loi?: number;
  cpi?: number;
  value?: string;
  country?: string;
  click_url: string;
}


// ------------------------------------------------------------
// GAME / APP OFFER TYPE
// ------------------------------------------------------------
export interface GameOffer {
  id: string;
  title: string;
  type: "game" | "app";
  totalPayout: number;
  estMinutes: number;
  imageUrl?: string;

  objectives: Array<{
    name: string;
    reward: number;
  }>;

  externalUrl: string;
}


// ------------------------------------------------------------
// CASHOUT REQUEST TYPE
// ------------------------------------------------------------
export interface CashoutRequest {
  userId: string;
  amount: number;
  paypalEmail?: string;
  status: "pending" | "completed" | "rejected";
  createdAt: any;
}

// TEMP PATCH: Legacy compatibility for pages expecting "User"
export type User = RBUser;
