// @ts-nocheck
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimQuestReward = exports.mirrorDonationToUser = exports.mirrorCashoutToUser = exports.cpxPostback = exports.resetBreadgameDaily = exports.breadgameBuyPackage = exports.logUserFingerprint = exports.cleanupCompletedOffers = exports.dailyCheckIn = exports.claimShortcutBonus = exports.bitlabsReceiptCallback = exports.magicReceiptsCallback = exports.bitlabsSurveyCallback = exports.gameOfferWebhook = exports.processReferralsCallable = exports.processReferrals = exports.ayetCallback = exports.testOfferMultiEvent = exports.myleadsPostback = exports.revuPostback = exports.kiwiwallPostback = exports.adgemWebhook = exports.verifyRecaptcha = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-functions/v2/firestore");
const crypto = __importStar(require("crypto"));
const velocity_1 = require("./velocity");
const fetchFn = global.fetch;
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
/* ============================================================
   STREAK BONUS + REVENUE SHARE HELPERS
   - bonusPercent is the user's DAILY STREAK bonus (0–10%)
   - basePayout is the FULL partner payout (100%)
   - user gets (50% + bonusPercent)% of basePayout
   - owner gets (50% - bonusPercent)% of basePayout
============================================================ */
function clampBonusPercent(raw) {
    if (typeof raw !== "number" || !isFinite(raw))
        return 0;
    if (raw < 0)
        return 0;
    if (raw > 10)
        return 10; // cap streak bonus at +10%
    return raw;
}
/**
 * Unified revenue sharing:
 * - partner sends basePayout (100% of revenue)
 * - userPercent = 50% + bonusPercent
 * - ownerPercent = 50% - bonusPercent
 *
 * Returns:
 * - base: full partner payout (100%)
 * - baseUserAmount: user's baseline 50% share of partner payout
 * - final: user's actual credited amount (50%–60%)
 * - bonusAmount: extra above the baseline 50% share
 * - bonusPercent: streak bonus %
 * - userPercent: actual user % of partner payout (50–60)
 */
function applyRevenueShare(basePayout, bonusPercentRaw) {
    const bonusPercent = clampBonusPercent(bonusPercentRaw); // 0–10
    const userPercentFraction = (50 + bonusPercent) / 100; // 0.5–0.6
    const finalRaw = basePayout * userPercentFraction;
    const final = Math.round(finalRaw * 100) / 100; // round to cents
    const baseUserRaw = basePayout * 0.5; // baseline 50% share
    const baseUserAmount = Math.round(baseUserRaw * 100) / 100;
    const bonusAmountRaw = final - baseUserAmount; // always >= 0
    const bonusAmount = Math.round(bonusAmountRaw * 100) / 100;
    return {
        base: basePayout, // full partner payout (100%)
        baseUserAmount,
        bonusPercent,
        userPercent: userPercentFraction * 100, // 50–60 as %
        final,
        bonusAmount,
    };
}
/* ============================================================
   SECRETS
============================================================ */
const OFFERS_SECRET = (0, params_1.defineSecret)("OFFERS_SECRET");
const OFFERS_SECRET_TEST = (0, params_1.defineSecret)("OFFERS_SECRET_TEST");
const REVU_SECRET = (0, params_1.defineSecret)("REVU_SECRET");
// KiwiWall secret key (used for MD5 verification). Can be overridden with env KIWI_SECRET.
const KIWI_SECRET_VALUE = process.env.KIWI_SECRET || "26b6e44ad5b4e320f03ed0b71b1c398c";
const TELEGRAM_BOT_TOKEN = (0, params_1.defineSecret)("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = (0, params_1.defineSecret)("TELEGRAM_CHAT_ID");
const RESEND_API_KEY = (0, params_1.defineSecret)("RESEND_API_KEY");
const RECAPTCHA_SECRET_KEY = (0, params_1.defineSecret)("RECAPTCHA_SECRET_KEY");
const DEFAULT_RECAPTCHA_SECRET = "6LdHlCMsAAAAAJTiyk7Pk1ewZgBSmN45ZoFxmFl1";
const EMAIL_FROM = process.env.NOTIFY_EMAIL_FROM || "ReadyBread Alerts <alerts@readybread.xyz>";
const EMAIL_REPLY_TO = process.env.NOTIFY_REPLY_TO || "contact@readybread.xyz";
const sendEmail = async (opts) => {
    const apiKey = RESEND_API_KEY.value();
    if (!apiKey) {
        console.log("Email not configured; skipping send for", opts.subject);
        return;
    }
    try {
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                from: EMAIL_FROM,
                reply_to: EMAIL_REPLY_TO,
                to: [opts.to],
                subject: opts.subject,
                html: opts.html,
                text: opts.text,
            }),
        });
        if (!res.ok) {
            const body = await res.text();
            console.error("Email send failed", res.status, body);
        }
    }
    catch (err) {
        console.error("Email send error", err);
    }
};
const verifyRecaptchaToken = async (token) => {
    const secrets = Array.from(new Set([
        RECAPTCHA_SECRET_KEY.value(),
        process.env.RECAPTCHA_SECRET_KEY,
        DEFAULT_RECAPTCHA_SECRET,
    ].filter(Boolean)));
    if (secrets.length === 0)
        return { ok: false, reason: "secret_missing" };
    let lastReason = null;
    let lastPayload = null;
    for (const secret of secrets) {
        const body = new URLSearchParams();
        body.append("secret", secret);
        body.append("response", token);
        try {
            const res = await fetchFn("https://www.google.com/recaptcha/api/siteverify", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body,
            });
            const json = (await res.json());
            const ok = json.success === true;
            const reason = json["error-codes"] || null;
            lastPayload = json;
            if (ok)
                return { ok: true, reason };
            lastReason = reason;
            // If the secret was invalid, try the next candidate.
            const reasonStr = Array.isArray(reason) ? reason.join(",") : reason;
            if (reasonStr && `${reasonStr}`.includes("invalid-input-secret")) {
                continue;
            }
        }
        catch (err) {
            lastReason = err instanceof Error ? err.message : "verify_error";
        }
    }
    return {
        ok: false,
        reason: lastReason || "captcha_failed",
        payload: lastPayload,
    };
};
////////////////////////////////////////////////////////////////////////////////
//  RECAPTCHA VERIFICATION (v2 checkbox)
////////////////////////////////////////////////////////////////////////////////
exports.verifyRecaptcha = (0, https_1.onCall)({ secrets: [RECAPTCHA_SECRET_KEY], region: "us-central1" }, async (request) => {
    const token = (request.data?.token || "").toString();
    if (!token) {
        throw new https_1.HttpsError("invalid-argument", "Missing token");
    }
    try {
        const result = await verifyRecaptchaToken(token);
        if (!result.ok) {
            const reason = result.reason || "captcha_failed";
            console.warn("Captcha failed", reason, result.payload || "");
            throw new https_1.HttpsError("failed-precondition", reason === "secret_missing"
                ? "Captcha secret not configured"
                : "Captcha failed", reason);
        }
        return { ok: true, reason: result.reason || null };
    }
    catch (err) {
        console.error("Captcha verify error", err);
        if (err instanceof https_1.HttpsError)
            throw err;
        throw new https_1.HttpsError("internal", "Captcha verification error");
    }
});
////////////////////////////////////////////////////////////////////////////////
//  ADGEM WEBHOOK — revenue share with streak bonus
////////////////////////////////////////////////////////////////////////////////
exports.adgemWebhook = (0, https_1.onRequest)({ secrets: [OFFERS_SECRET], region: "us-central1" }, async (req, res) => {
    try {
        if (req.method !== "GET" && req.method !== "POST") {
            res.status(405).send("Method not allowed");
            return;
        }
        const secretFromRequest = req.query.secret ?? (req.body && req.body.secret);
        const expectedSecret = OFFERS_SECRET.value();
        if (!secretFromRequest || secretFromRequest !== expectedSecret) {
            console.warn("Invalid secret on AdGem webhook:", secretFromRequest);
            res.status(403).send("Forbidden");
            return;
        }
        const uid = req.query.uid ??
            req.query.sub_id ??
            req.query.user_id ??
            (req.body && (req.body.uid || req.body.sub_id || req.body.user_id));
        const offerId = req.query.offer_id ?? (req.body && req.body.offer_id);
        const amountRaw = req.query.amount ?? (req.body && req.body.amount);
        const txId = req.query.transaction_id ??
            (req.body && req.body.transaction_id);
        if (!uid || !offerId || !amountRaw || !txId) {
            res
                .status(400)
                .send("Missing uid / offerId / amount / transaction_id");
            return;
        }
        // AdGem sends cents; convert to USD
        const basePayout = Number(amountRaw) / 100;
        if (!isFinite(basePayout) || basePayout <= 0) {
            res.status(400).send("Invalid payout");
            return;
        }
        const txRef = db.collection("completedOffers").doc(txId);
        const txSnap = await txRef.get();
        // Prevent double credit
        if (txSnap.exists) {
            res.status(200).send("OK (duplicate ignored)");
            return;
        }
        const velocity = await (0, velocity_1.checkOfferVelocity)(uid, "adgem");
        if (velocity.blocked) {
            await (0, velocity_1.logVelocityBlock)({
                uid,
                source: "adgem",
                txId,
                amount: basePayout,
                counts: velocity.counts,
                reasons: velocity.reasons,
            });
            res.status(200).send("OK (velocity block)");
            return;
        }
        await db.runTransaction(async (t) => {
            const userRef = db.collection("users").doc(uid);
            const userSnap = await t.get(userRef);
            const now = admin.firestore.Timestamp.now();
            const serverNow = admin.firestore.FieldValue.serverTimestamp();
            // Credit full partner payout plus streak bonus (no 50% cut).
            const base = Math.round(basePayout * 100) / 100;
            const bonusPercentRaw = userSnap.exists
                ? userSnap.data()?.bonusPercent
                : 0;
            const bonusPercent = clampBonusPercent(bonusPercentRaw);
            const userPercent = 100 + bonusPercent;
            const final = Math.round(base * (1 + bonusPercent / 100) * 100) / 100;
            const baseUserAmount = base; // for consistency in logs
            const bonusAmount = Math.round((final - base) * 100) / 100;
            const balanceUpdate = {
                balance: admin.firestore.FieldValue.increment(final),
                auditLog: admin.firestore.FieldValue.arrayUnion({
                    type: "adgem",
                    offerId,
                    amount: final,
                    baseAmount: base,
                    userBaseAmount: baseUserAmount,
                    bonusAmount,
                    bonusPercent,
                    userPercent,
                    txId,
                    at: now,
                }),
            };
            if (!userSnap.exists) {
                t.set(userRef, { createdAt: serverNow, ...balanceUpdate }, { merge: true });
            }
            else {
                t.update(userRef, balanceUpdate);
            }
            t.set(userRef.collection("offers").doc(), {
                offerId,
                type: "adgem",
                amount: final,
                baseAmount: base,
                userBaseAmount: baseUserAmount,
                bonusAmount,
                bonusPercent,
                userPercent,
                txId,
                createdAt: serverNow,
            }, { merge: true });
            t.set(txRef, {
                uid,
                offerId,
                payout: final,
                baseAmount: base,
                userBaseAmount: baseUserAmount,
                bonusAmount,
                bonusPercent,
                userPercent,
                source: "AdGem",
                txId,
                creditedAt: serverNow,
            });
        });
        res.status(200).send("OK");
    }
    catch (err) {
        console.error("Error in adgemWebhook:", err);
        res.status(500).send("Internal error");
    }
});
////////////////////////////////////////////////////////////////////////////////
//  KIWIWALL POSTBACK (Offerwall) with signature check + revenue share
////////////////////////////////////////////////////////////////////////////////
function getKiwiwallParam(raw) {
    if (raw === undefined || raw === null)
        return "";
    if (Array.isArray(raw)) {
        const last = raw[raw.length - 1];
        return last === undefined || last === null ? "" : String(last);
    }
    return String(raw);
}
function getKiwiwallSignatures(raw) {
    if (raw === undefined || raw === null)
        return [];
    const values = Array.isArray(raw) ? raw : [raw];
    return values
        .flatMap((entry) => String(entry).split(","))
        .map((entry) => entry.trim())
        .filter(Boolean);
}
function verifyKiwiwallSignature(params, secret) {
    const providedSignatures = getKiwiwallSignatures(params.signature);
    const subId = getKiwiwallParam(params.sub_id) ||
        getKiwiwallParam(params.uid) ||
        getKiwiwallParam(params.subid) ||
        getKiwiwallParam(params.user_id);
    const amount = getKiwiwallParam(params.amount);
    if (!subId || !amount || providedSignatures.length === 0) {
        return false;
    }
    const expectedSignature = crypto
        .createHash("md5")
        .update(`${subId}:${amount}:${secret}`)
        .digest("hex")
        .toLowerCase();
    const normalizedProvided = providedSignatures.map((sig) => sig.toLowerCase());
    return (normalizedProvided.includes(expectedSignature) ||
        normalizedProvided.includes(secret.toLowerCase()));
}
exports.kiwiwallPostback = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    try {
        if (req.method !== "GET" && req.method !== "POST") {
            res.status(405).send("Method not allowed");
            return;
        }
        const kiwiParams = req.method === "POST"
            ? { ...req.query, ...req.body }
            : { ...req.query };
        const uid = getKiwiwallParam(kiwiParams.uid) ||
            getKiwiwallParam(kiwiParams.sub_id) ||
            getKiwiwallParam(kiwiParams.subid) ||
            getKiwiwallParam(kiwiParams.user_id) ||
            "";
        const txId = getKiwiwallParam(kiwiParams.tx) ||
            getKiwiwallParam(kiwiParams.trans_id) ||
            "";
        const offerId = getKiwiwallParam(kiwiParams.offer_id) || "";
        const status = getKiwiwallParam(kiwiParams.status) || "";
        const amountRaw = getKiwiwallParam(kiwiParams.amount) || "";
        if (!uid || !txId || !offerId || !amountRaw) {
            res.status(400).send("Missing parameters");
            return;
        }
        const sigOk = verifyKiwiwallSignature(kiwiParams, KIWI_SECRET_VALUE);
        if (!sigOk) {
            console.warn("KiwiWall invalid signature", {
                params: kiwiParams,
                providedSignature: kiwiParams.signature,
            });
            res.status(403).send("Invalid signature");
            return;
        }
        // Only process completed conversions
        if (status !== "1") {
            console.log("Kiwiwall reversal or invalid status:", status);
            res.status(200).send("1"); // acknowledge non-paid to prevent retries
            return;
        }
        const basePayout = Number(amountRaw);
        if (!isFinite(basePayout) || basePayout <= 0) {
            res.status(400).send("Invalid payout");
            return;
        }
        // Prevent duplicate transactions
        const txRef = db.collection("completedOffers").doc(String(txId));
        const existingTx = await txRef.get();
        if (existingTx.exists) {
            res.status(200).send("1");
            return;
        }
        const velocity = await (0, velocity_1.checkOfferVelocity)(uid, "kiwiwall");
        if (velocity.blocked) {
            await (0, velocity_1.logVelocityBlock)({
                uid,
                source: "kiwiwall",
                txId,
                amount: basePayout,
                counts: velocity.counts,
                reasons: velocity.reasons,
            });
            res.status(200).send("1");
            return;
        }
        await db.runTransaction(async (t) => {
            const userRef = db.collection("users").doc(uid);
            const userSnap = await t.get(userRef);
            const now = admin.firestore.Timestamp.now();
            const serverNow = admin.firestore.FieldValue.serverTimestamp();
            const bonusPercentRaw = userSnap.exists
                ? userSnap.data()?.bonusPercent
                : 0;
            const bonusPercent = clampBonusPercent(bonusPercentRaw);
            // Full payout to user + streak bonus (no 50/50 split)
            const base = Math.round(basePayout * 100) / 100;
            const final = Math.round(base * (1 + bonusPercent / 100) * 100) / 100;
            const baseUserAmount = base;
            const bonusAmount = Math.round((final - base) * 100) / 100;
            const userPercent = 100 + bonusPercent;
            // Update user balance
            if (userSnap.exists) {
                t.update(userRef, {
                    balance: admin.firestore.FieldValue.increment(final),
                    auditLog: admin.firestore.FieldValue.arrayUnion({
                        type: "kiwiwall",
                        offerId,
                        amount: final,
                        baseAmount: base,
                        userBaseAmount: baseUserAmount,
                        bonusAmount,
                        bonusPercent,
                        userPercent,
                        txId,
                        at: now,
                    }),
                });
            }
            else {
                t.set(userRef, {
                    balance: final,
                    createdAt: serverNow,
                    auditLog: [
                        {
                            type: "kiwiwall",
                            offerId,
                            amount: final,
                            baseAmount: base,
                            userBaseAmount: baseUserAmount,
                            bonusAmount,
                            bonusPercent,
                            userPercent,
                            txId,
                            at: now,
                        },
                    ],
                }, { merge: true });
            }
            // Log offer
            t.set(userRef.collection("offers").doc(), {
                offerId,
                type: "kiwiwall",
                amount: final,
                baseAmount: base,
                userBaseAmount: baseUserAmount,
                bonusAmount,
                bonusPercent,
                userPercent,
                txId,
                createdAt: serverNow,
            }, { merge: true });
            // Global offer log
            t.set(txRef, {
                uid,
                offerId,
                payout: final,
                baseAmount: base,
                userBaseAmount: baseUserAmount,
                bonusAmount,
                bonusPercent,
                userPercent,
                source: "KiwiWall",
                txId,
                creditedAt: serverNow,
            }, { merge: true });
        });
        res.status(200).send("1");
    }
    catch (err) {
        console.error("KiwiWall callback error:", err);
        res.status(500).send("Internal Server Error");
    }
});
////////////////////////////////////////////////////////////////////////////////
//  REVU OFFERWALL POSTBACK — supports real + TEST FORM
////////////////////////////////////////////////////////////////////////////////
exports.revuPostback = (0, https_1.onRequest)({ secrets: [REVU_SECRET], region: "us-central1" }, async (req, res) => {
    try {
        if (req.method !== "GET" && req.method !== "POST") {
            res.status(405).send("Method not allowed");
            return;
        }
        // Merge GET + POST
        const params = req.method === "POST"
            ? { ...req.query, ...req.body }
            : { ...req.query };
        // --- Secret Validation ---
        const providedSecret = params.secret || params.key || params.token || "";
        const expectedSecret = REVU_SECRET.value();
        if (!providedSecret || providedSecret !== expectedSecret) {
            console.warn("Invalid RevU secret:", providedSecret);
            res.status(403).send("Forbidden");
            return;
        }
        // ==========================================================
        // 1. UID EXTRACTION (special fallback for RevU TEST TOOL)
        // ==========================================================
        let uid = params.uid || params.sid || params.user_id || params.sub_id || "";
        // RevU Test Form uses SID2 as UID
        if (!uid && params.sid2) {
            uid = String(params.sid2);
        }
        // ==========================================================
        // 2. PAYOUT EXTRACTION — supports test form (currency)
        // ==========================================================
        let rewardRaw = params.rate ||
            params.reward ||
            params.payout ||
            params.amount ||
            params.value ||
            params.goal_reward ||
            "";
        // Test postback uses "currency"
        if (!rewardRaw && params.currency) {
            rewardRaw = params.currency;
        }
        if (!uid || !rewardRaw) {
            console.warn("Missing uid / reward", { uid, rewardRaw, params });
            res.status(400).send("Missing uid / reward");
            return;
        }
        // Convert cents → dollars
        const cents = Number(rewardRaw);
        if (!isFinite(cents) || cents <= 0) {
            res.status(400).send("Invalid reward");
            return;
        }
        const basePayout = Math.round((cents / 100) * 100) / 100;
        // ==========================================================
        // 3. TX ID — test form sends none → generate one
        // ==========================================================
        let txId = params.actionid ||
            params.transaction_id ||
            params.tx ||
            params.trans_id ||
            params.oid ||
            null;
        if (!txId) {
            txId = "revu_test_" + Date.now();
        }
        const offerId = params.offer_id || params.campaign || "unknown";
        const sid3 = params.sid3 || params.sub3 || null;
        // ==========================================================
        // 4. Prevent double credit
        // ==========================================================
        const txRef = db.collection("completedOffers").doc(String(txId));
        const existing = await txRef.get();
        if (existing.exists) {
            res.status(200).send("OK (duplicate ignored)");
            return;
        }
        const velocity = await (0, velocity_1.checkOfferVelocity)(uid, "revu");
        if (velocity.blocked) {
            await (0, velocity_1.logVelocityBlock)({
                uid,
                source: "revu",
                txId,
                amount: basePayout,
                counts: velocity.counts,
                reasons: velocity.reasons,
            });
            res.status(200).send("OK (velocity block)");
            return;
        }
        // ==========================================================
        // 5. Revenue Share + Credit User
        // ==========================================================
        await db.runTransaction(async (t) => {
            const userRef = db.collection("users").doc(uid);
            const snap = await t.get(userRef);
            const now = admin.firestore.Timestamp.now();
            const serverNow = admin.firestore.FieldValue.serverTimestamp();
            const bonusPercentRaw = snap.exists ? snap.data()?.bonusPercent : 0;
            const bonusPercent = clampBonusPercent(bonusPercentRaw);
            const userPercent = (50 + bonusPercent) / 100;
            const final = Math.round(basePayout * userPercent * 100) / 100;
            const baseUserAmount = Math.round(basePayout * 0.5 * 100) / 100;
            const bonusAmount = Math.round((final - baseUserAmount) * 100) / 100;
            const update = {
                balance: admin.firestore.FieldValue.increment(final),
                auditLog: admin.firestore.FieldValue.arrayUnion({
                    type: "revu",
                    offerId,
                    amount: final,
                    baseAmount: basePayout,
                    userBaseAmount: baseUserAmount,
                    bonusAmount,
                    bonusPercent,
                    userPercent: userPercent * 100,
                    sid3,
                    txId,
                    at: now,
                }),
            };
            if (!snap.exists) {
                t.set(userRef, { createdAt: serverNow, ...update }, { merge: true });
            }
            else {
                t.update(userRef, update);
            }
            t.set(userRef.collection("offers").doc(), {
                offerId,
                type: "revu",
                amount: final,
                baseAmount: basePayout,
                userBaseAmount: baseUserAmount,
                bonusAmount,
                bonusPercent,
                userPercent: userPercent * 100,
                sid3,
                txId,
                createdAt: serverNow,
            }, { merge: true });
            t.set(txRef, {
                uid,
                offerId,
                payout: final,
                baseAmount: basePayout,
                userBaseAmount: baseUserAmount,
                bonusAmount,
                bonusPercent,
                userPercent: userPercent * 100,
                sid3,
                txId,
                creditedAt: serverNow,
                source: "RevU",
            }, { merge: true });
        });
        res.status(200).send("OK");
    }
    catch (err) {
        console.error("RevU postback error:", err);
        res.status(500).send("Internal error");
    }
});
////////////////////////////////////////////////////////////////////////////////
//  MYLEADS POSTBACK — revenue share with streak bonus
////////////////////////////////////////////////////////////////////////////////
exports.myleadsPostback = (0, https_1.onRequest)({ secrets: [OFFERS_SECRET], region: "us-central1" }, async (req, res) => {
    try {
        if (req.method !== "GET" && req.method !== "POST") {
            res.status(405).send("Method not allowed");
            return;
        }
        const params = req.method === "POST"
            ? { ...req.query, ...req.body }
            : { ...req.query };
        const providedSecret = params.secret ||
            params.key ||
            params.token ||
            "";
        const expectedSecret = OFFERS_SECRET.value();
        // MyLeads does not supply a secret. If you provide one, we only enforce when present.
        if (expectedSecret &&
            providedSecret &&
            providedSecret !== expectedSecret) {
            console.warn("Invalid MyLeads secret:", providedSecret);
            res.status(403).send("Forbidden");
            return;
        }
        const uid = params.player_id ||
            params.ml_sub1 ||
            params.ml_sub2 ||
            params.ml_sub3 ||
            params.ml_sub4 ||
            params.ml_sub5 ||
            params.user_id ||
            params.uid ||
            "";
        const txId = params.transaction_id || null;
        if (!uid || !txId) {
            res.status(400).send("Missing uid / transaction_id");
            return;
        }
        const programId = params.program_id || null;
        const programName = params.program_name || null;
        const programConfigId = params.program_config_id || null;
        const destProgramId = params.destination_program_id || null;
        const destProgramName = params.destination_program_name || null;
        const goalId = params.goal_id || null;
        const goalName = params.goal_name || null;
        const offerId = goalId ||
            goalName ||
            programId ||
            programName ||
            programConfigId ||
            "myleads_offer";
        const payoutCandidates = [
            params.payout_decimal,
            params.payout,
            params.virtual_amount,
            params.cart_value,
            params.cart_value_original,
        ];
        let basePayout = NaN;
        for (const val of payoutCandidates) {
            if (val === undefined || val === null || val === "")
                continue;
            const num = Number(val);
            if (isFinite(num)) {
                basePayout = num;
                break;
            }
        }
        if (!isFinite(basePayout) || basePayout <= 0) {
            res.status(400).send("Invalid payout");
            return;
        }
        const rawStatus = (params.status || "").toString().toLowerCase().trim();
        const rejectedStatuses = new Set([
            "rejected",
            "declined",
            "canceled",
            "cancelled",
            "chargeback",
            "fraud",
            "void",
            "-1",
            "0",
            "2",
        ]);
        const pendingStatuses = new Set([
            "pending",
            "hold",
            "holding",
            "waiting",
            "processing",
        ]);
        const statusNumber = Number(rawStatus);
        const statusIsNumber = rawStatus !== "" && isFinite(statusNumber);
        if (rejectedStatuses.has(rawStatus) || (statusIsNumber && statusNumber < 0)) {
            res.status(200).send("OK (rejected/void status)");
            return;
        }
        if (pendingStatuses.has(rawStatus) ||
            (statusIsNumber && statusNumber === 0)) {
            res.status(200).send("OK (pending status)");
            return;
        }
        const approvedStatuses = new Set([
            "",
            "approved",
            "confirm",
            "confirmed",
            "paid",
            "payout",
            "sale",
            "lead",
            "accepted",
            "completed",
            "success",
            "ok",
            "1",
            "3",
        ]);
        const isApproved = approvedStatuses.has(rawStatus) || (statusIsNumber && statusNumber > 0);
        if (!isApproved) {
            res.status(200).send("OK (ignored status)");
            return;
        }
        const txRef = db.collection("completedOffers").doc(String(txId));
        const existing = await txRef.get();
        if (existing.exists) {
            res.status(200).send("OK (duplicate ignored)");
            return;
        }
        const velocity = await (0, velocity_1.checkOfferVelocity)(uid, "myleads");
        if (velocity.blocked) {
            await (0, velocity_1.logVelocityBlock)({
                uid,
                source: "myleads",
                txId: String(txId),
                amount: basePayout,
                counts: velocity.counts,
                reasons: velocity.reasons,
            });
            res.status(200).send("OK (velocity block)");
            return;
        }
        await db.runTransaction(async (t) => {
            const userRef = db.collection("users").doc(uid);
            const userSnap = await t.get(userRef);
            const now = admin.firestore.Timestamp.now();
            const serverNow = admin.firestore.FieldValue.serverTimestamp();
            const bonusPercentRaw = userSnap.exists
                ? userSnap.data()?.bonusPercent
                : 0;
            const bonusPercent = clampBonusPercent(bonusPercentRaw);
            const base = Math.round(basePayout * 100) / 100;
            const final = Math.round(base * (1 + bonusPercent / 100) * 100) / 100;
            const baseUserAmount = base;
            const bonusAmount = Math.round((final - base) * 100) / 100;
            const userPercent = 100 + bonusPercent;
            const auditEntry = {
                type: "myleads",
                offerId,
                amount: final,
                baseAmount: base,
                userBaseAmount: baseUserAmount,
                bonusAmount,
                bonusPercent,
                userPercent,
                txId,
                status: rawStatus || null,
                programId,
                programName,
                programConfigId,
                destinationProgramId: destProgramId,
                destinationProgramName: destProgramName,
                goalId,
                goalName,
                playerId: params.player_id || null,
                country: params.country_code || null,
                currency: params.currency || null,
                ip: params.ip || null,
                cartValue: params.cart_value ?? null,
                cartValueOriginal: params.cart_value_original ?? null,
                at: now,
            };
            if (userSnap.exists) {
                t.update(userRef, {
                    balance: admin.firestore.FieldValue.increment(final),
                    auditLog: admin.firestore.FieldValue.arrayUnion(auditEntry),
                });
            }
            else {
                t.set(userRef, {
                    balance: final,
                    createdAt: serverNow,
                    auditLog: [auditEntry],
                }, { merge: true });
            }
            t.set(userRef.collection("offers").doc(), {
                offerId,
                type: "myleads",
                amount: final,
                baseAmount: base,
                userBaseAmount: baseUserAmount,
                bonusAmount,
                bonusPercent,
                userPercent,
                txId,
                status: rawStatus || null,
                programId,
                programName,
                programConfigId,
                destinationProgramId: destProgramId,
                destinationProgramName: destProgramName,
                goalId,
                goalName,
                playerId: params.player_id || null,
                country: params.country_code || null,
                currency: params.currency || null,
                ip: params.ip || null,
                cartValue: params.cart_value ?? null,
                cartValueOriginal: params.cart_value_original ?? null,
                createdAt: serverNow,
            }, { merge: true });
            t.set(txRef, {
                uid,
                offerId,
                payout: final,
                baseAmount: base,
                userBaseAmount: baseUserAmount,
                bonusAmount,
                bonusPercent,
                userPercent,
                source: "MyLeads",
                txId,
                rawStatus: rawStatus || null,
                programId,
                programName,
                programConfigId,
                destinationProgramId: destProgramId,
                destinationProgramName: destProgramName,
                goalId,
                goalName,
                playerId: params.player_id || null,
                country: params.country_code || null,
                currency: params.currency || null,
                ip: params.ip || null,
                cartValue: params.cart_value ?? null,
                cartValueOriginal: params.cart_value_original ?? null,
                creditedAt: serverNow,
            }, { merge: true });
        });
        res.status(200).send("OK");
    }
    catch (err) {
        console.error("MyLeads postback error:", err);
        res.status(500).send("Internal error");
    }
});
////////////////////////////////////////////////////////////////////////////////
//  AYET CALLBACK — revenue share with streak bonus
////////////////////////////////////////////////////////////////////////////////
exports.ayetCallback = (0, https_1.onRequest)({ secrets: [OFFERS_SECRET], region: "us-central1" }, async (req, res) => {
    try {
        if (req.method !== "GET" && req.method !== "POST") {
            res.status(405).send("Method not allowed");
            return;
        }
        const params = req.method === "POST"
            ? { ...req.query, ...req.body }
            : { ...req.query };
        const providedSecret = params.secret ||
            params.key ||
            params.token ||
            "";
        const expectedSecret = OFFERS_SECRET.value();
        if (!providedSecret || providedSecret !== expectedSecret) {
            console.warn("Invalid Ayet secret:", providedSecret);
            res.status(403).send("Forbidden");
            return;
        }
        const uid = params.uid ||
            params.user_id ||
            params.subid ||
            params.sub_id ||
            params.subid2 ||
            "";
        const txId = params.tx ||
            params.trans_id ||
            params.transaction_id ||
            params.clickid ||
            null;
        const offerId = params.offer_id ||
            params.campaign_id ||
            params.goal_id ||
            "ayet_offer";
        const status = params.status || "1";
        const payoutRaw = params.amount ||
            params.payout ||
            params.reward ||
            "";
        if (!uid || !payoutRaw || !txId) {
            res.status(400).send("Missing uid / payout / tx");
            return;
        }
        // process only completed conversions (status 1 or "approved")
        const normalizedStatus = status.toString().toLowerCase();
        if (normalizedStatus !== "1" &&
            normalizedStatus !== "approved" &&
            normalizedStatus !== "success") {
            res.status(200).send("Ignored (status)");
            return;
        }
        const basePayout = Number(payoutRaw);
        if (!isFinite(basePayout) || basePayout <= 0) {
            res.status(400).send("Invalid payout");
            return;
        }
        const txRef = db.collection("completedOffers").doc(String(txId));
        const existing = await txRef.get();
        if (existing.exists) {
            res.status(200).send("OK (duplicate ignored)");
            return;
        }
        const velocity = await (0, velocity_1.checkOfferVelocity)(uid, "ayet");
        if (velocity.blocked) {
            await (0, velocity_1.logVelocityBlock)({
                uid,
                source: "ayet",
                txId,
                amount: basePayout,
                counts: velocity.counts,
                reasons: velocity.reasons,
            });
            res.status(200).send("OK (velocity block)");
            return;
        }
        await db.runTransaction(async (t) => {
            const userRef = db.collection("users").doc(uid);
            const userSnap = await t.get(userRef);
            const now = admin.firestore.Timestamp.now();
            const serverNow = admin.firestore.FieldValue.serverTimestamp();
            const bonusPercentRaw = userSnap.exists
                ? userSnap.data()?.bonusPercent
                : 0;
            const { base, baseUserAmount, final, bonusAmount, bonusPercent, userPercent, } = applyRevenueShare(basePayout, bonusPercentRaw);
            const auditEntry = {
                type: "ayet",
                offerId,
                amount: final,
                baseAmount: base,
                userBaseAmount: baseUserAmount,
                bonusAmount,
                bonusPercent,
                userPercent,
                txId,
                at: now,
            };
            if (userSnap.exists) {
                t.update(userRef, {
                    balance: admin.firestore.FieldValue.increment(final),
                    auditLog: admin.firestore.FieldValue.arrayUnion(auditEntry),
                });
            }
            else {
                t.set(userRef, {
                    balance: final,
                    createdAt: serverNow,
                    auditLog: [auditEntry],
                }, { merge: true });
            }
            t.set(userRef.collection("offers").doc(), {
                offerId,
                type: "ayet",
                amount: final,
                baseAmount: base,
                userBaseAmount: baseUserAmount,
                bonusAmount,
                bonusPercent,
                userPercent,
                txId,
                createdAt: serverNow,
            }, { merge: true });
            t.set(txRef, {
                uid,
                offerId,
                payout: final,
                baseAmount: base,
                userBaseAmount: baseUserAmount,
                bonusAmount,
                bonusPercent,
                userPercent,
                source: "Ayet",
                txId,
                creditedAt: serverNow,
            }, { merge: true });
        });
        res.status(200).send("OK");
    }
    catch (err) {
        console.error("Ayet callback error:", err);
        res.status(500).send("Internal error");
    }
});
////////////////////////////////////////////////////////////////////////////////
//  REFERRALS - unchanged
////////////////////////////////////////////////////////////////////////////////
const REFERRAL_REWARD = 0.25;
const REFERRAL_CAP = 2.5;
const ADMIN_REFERRAL_CODE = "NJJK72"; // set to your admin's referralCode
const ADMIN_REFERRAL_BONUS = 1.0; // USD to new user
const processReferralCore = async (uid) => {
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
        return "User not found";
    }
    const user = userSnap.data();
    const referredBy = user.referredBy || null;
    if (!referredBy) {
        return "No referral code used";
    }
    if (!user.referralPending) {
        return "Referral already resolved";
    }
    const fbUser = await admin.auth().getUser(uid);
    if (!fbUser.emailVerified) {
        return "Email not verified — cannot process referral yet";
    }
    // Special admin/referral-code bonus: pay $1 to the new user, no referrer payout
    if (referredBy === ADMIN_REFERRAL_CODE) {
        await userRef.update({
            balance: admin.firestore.FieldValue.increment(ADMIN_REFERRAL_BONUS),
            referralPending: false,
            auditLog: admin.firestore.FieldValue.arrayUnion({
                type: "admin_referral_bonus",
                amount: ADMIN_REFERRAL_BONUS,
                code: referredBy,
                at: admin.firestore.Timestamp.now(),
            }),
        });
        return "Admin referral bonus applied";
    }
    const refQ = await db
        .collection("users")
        .where("referralCode", "==", referredBy)
        .limit(1)
        .get();
    if (refQ.empty) {
        await userRef.update({ referralPending: false });
        return "Invalid referral code";
    }
    const referrerDoc = refQ.docs[0];
    const referrerId = referrerDoc.id;
    const referrer = referrerDoc.data();
    const isAdminReferrer = referrer?.referralCode === ADMIN_REFERRAL_CODE;
    if (referrerId === uid) {
        await userRef.update({ referralPending: false });
        return "Self referral blocked";
    }
    if (referrer.referredBy === user.referralCode) {
        await userRef.update({ referralPending: false });
        return "Circular referral blocked";
    }
    const sameDevice = referrer.deviceId &&
        user.deviceId &&
        referrer.deviceId === user.deviceId;
    // ALWAYS pay referred user
    await userRef.update({
        balance: admin.firestore.FieldValue.increment(REFERRAL_REWARD),
    });
    await userRef
        .collection("referrals")
        .doc(referrerId)
        .set({
        referredUserId: uid,
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        earningsFromReferral: REFERRAL_REWARD,
    });
    if (sameDevice) {
        await userRef.update({ referralPending: false });
        return "Same-device referral — referrer not paid";
    }
    const currentEarned = referrer.totalReferralEarnings || 0;
    if (!isAdminReferrer && currentEarned >= REFERRAL_CAP) {
        await userRef.update({ referralPending: false });
        return "Referrer at cap";
    }
    await db
        .collection("users")
        .doc(referrerId)
        .update({
        balance: admin.firestore.FieldValue.increment(REFERRAL_REWARD),
        totalReferralEarnings: admin.firestore.FieldValue.increment(REFERRAL_REWARD),
    });
    await db
        .collection("users")
        .doc(referrerId)
        .collection("referrals")
        .doc(uid)
        .set({
        referredUserId: uid,
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        earningsFromReferral: REFERRAL_REWARD,
    });
    await userRef.update({ referralPending: false });
    return "Referral processed successfully";
};
exports.processReferrals = functions.https.onRequest(async (req, res) => {
    try {
        const uid = req.query.uid;
        if (!uid) {
            res.status(400).send("Missing uid");
            return;
        }
        const message = await processReferralCore(uid);
        res.send(message);
    }
    catch (err) {
        console.error("Referral processing error:", err);
        res.status(500).send("Error processing referral");
    }
});
exports.processReferralsCallable = (0, https_1.onCall)(async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Must be logged in.");
    }
    try {
        const message = await processReferralCore(request.auth.uid);
        return { message };
    }
    catch (err) {
        console.error("Referral processing error (callable):", err);
        throw new https_1.HttpsError("internal", "Referral processing failed.");
    }
});
////////////////////////////////////////////////////////////////////////////////
//  GAME OFFER WEBHOOK (BitLabs Games) — revenue share with streak bonus
////////////////////////////////////////////////////////////////////////////////
exports.gameOfferWebhook = (0, https_1.onRequest)({ secrets: [OFFERS_SECRET], region: "us-central1" }, async (req, res) => {
    try {
        if (req.method !== "GET" && req.method !== "POST") {
            res.status(405).send("Method not allowed");
            return;
        }
        const secretFromRequest = req.query.secret ?? (req.body && req.body.secret);
        const expectedSecret = OFFERS_SECRET.value();
        if (!secretFromRequest || secretFromRequest !== expectedSecret) {
            console.warn("Invalid secret on webhook:", secretFromRequest);
            res.status(403).send("Forbidden");
            return;
        }
        const uid = req.query.uid ??
            req.query.user_id ??
            (req.body && req.body.uid);
        const offerId = req.query.offer_id ?? (req.body && req.body.offer_id);
        const payoutRaw = req.query.payout ??
            req.query.reward ??
            (req.body && req.body.payout);
        if (!uid || !offerId || !payoutRaw) {
            res.status(400).send("Missing uid / offerId / payout");
            return;
        }
        const basePayout = Number(payoutRaw);
        if (!isFinite(basePayout) || basePayout <= 0) {
            res.status(400).send("Invalid payout");
            return;
        }
        const velocity = await (0, velocity_1.checkOfferVelocity)(uid, "game_offer");
        if (velocity.blocked) {
            await (0, velocity_1.logVelocityBlock)({
                uid,
                source: "game_offer",
                txId: offerId || null,
                amount: basePayout,
                counts: velocity.counts,
                reasons: velocity.reasons,
            });
            res.status(200).send("OK (velocity block)");
            return;
        }
        await db.runTransaction(async (tx) => {
            const userRef = db.collection("users").doc(uid);
            const userSnap = await tx.get(userRef);
            const now = admin.firestore.Timestamp.now();
            const serverNow = admin.firestore.FieldValue.serverTimestamp();
            const bonusPercentRaw = userSnap.exists
                ? userSnap.data()?.bonusPercent
                : 0;
            const { base, baseUserAmount, final, bonusAmount, bonusPercent, userPercent, } = applyRevenueShare(basePayout, bonusPercentRaw);
            const balanceUpdate = {
                balance: admin.firestore.FieldValue.increment(final),
                auditLog: admin.firestore.FieldValue.arrayUnion({
                    type: "game_offer",
                    offerId,
                    amount: final,
                    baseAmount: base,
                    userBaseAmount: baseUserAmount,
                    bonusAmount,
                    bonusPercent,
                    userPercent,
                    at: now,
                }),
            };
            const startedOfferRef = userRef
                .collection("startedOffers")
                .doc(offerId);
            const startedSnap = await tx.get(startedOfferRef);
            if (startedSnap.exists && startedSnap.data()?.status === "completed") {
                return;
            }
            if (!userSnap.exists) {
                tx.set(userRef, { createdAt: serverNow, ...balanceUpdate }, { merge: true });
            }
            else {
                tx.update(userRef, balanceUpdate);
            }
            tx.set(startedOfferRef, {
                status: "completed",
                completedAt: serverNow,
                lastUpdatedAt: serverNow,
                totalPayout: final,
                title: "Offer",
                type: "game",
            }, { merge: true });
            tx.set(userRef.collection("offers").doc(), {
                offerId,
                type: "game",
                amount: final,
                baseAmount: base,
                userBaseAmount: baseUserAmount,
                bonusAmount,
                bonusPercent,
                userPercent,
                createdAt: serverNow,
            }, { merge: true });
        });
        res.status(200).send("OK");
    }
    catch (err) {
        console.error("Error in gameOfferWebhook:", err);
        res.status(500).send("Internal error");
    }
});
////////////////////////////////////////////////////////////////////////////////
//  BITLABS SURVEY CALLBACK — revenue share with streak bonus
////////////////////////////////////////////////////////////////////////////////
exports.bitlabsSurveyCallback = (0, https_1.onRequest)({ secrets: [OFFERS_SECRET], region: "us-central1", maxInstances: 1 }, async (req, res) => {
    try {
        if (req.method !== "GET" && req.method !== "POST") {
            res.status(405).send("Method not allowed");
            return;
        }
        const secretFromRequest = req.query.secret ?? (req.body && req.body.secret);
        const expectedSecret = OFFERS_SECRET.value();
        if (!secretFromRequest || secretFromRequest !== expectedSecret) {
            console.warn("Invalid secret on survey callback:", secretFromRequest);
            res.status(403).send("Forbidden");
            return;
        }
        const uid = req.query.uid ??
            req.query.user_id ??
            (req.body && req.body.uid);
        const offerId = req.query.offer_id ?? (req.body && req.body.offer_id);
        const payoutRaw = req.query.payout ??
            req.query.reward ??
            (req.body && req.body.payout);
        if (!uid || !offerId || !payoutRaw) {
            res.status(400).send("Missing uid / offerId / payout");
            return;
        }
        const basePayout = Number(payoutRaw);
        if (!isFinite(basePayout) || basePayout <= 0) {
            res.status(400).send("Invalid payout");
            return;
        }
        const velocity = await (0, velocity_1.checkOfferVelocity)(uid, "bitlabs_survey");
        if (velocity.blocked) {
            await (0, velocity_1.logVelocityBlock)({
                uid,
                source: "bitlabs_survey",
                txId: offerId || null,
                amount: basePayout,
                counts: velocity.counts,
                reasons: velocity.reasons,
            });
            res.status(200).send("OK (velocity block)");
            return;
        }
        await db.runTransaction(async (tx) => {
            const userRef = db.collection("users").doc(uid);
            const userSnap = await tx.get(userRef);
            const serverNow = admin.firestore.FieldValue.serverTimestamp();
            const now = admin.firestore.Timestamp.now();
            const bonusPercentRaw = userSnap.exists
                ? userSnap.data()?.bonusPercent
                : 0;
            const { base, baseUserAmount, final, bonusAmount, bonusPercent, userPercent, } = applyRevenueShare(basePayout, bonusPercentRaw);
            const balanceUpdate = {
                balance: admin.firestore.FieldValue.increment(final),
                auditLog: admin.firestore.FieldValue.arrayUnion({
                    type: "survey",
                    offerId,
                    amount: final,
                    baseAmount: base,
                    userBaseAmount: baseUserAmount,
                    bonusAmount,
                    bonusPercent,
                    userPercent,
                    at: now,
                }),
            };
            if (!userSnap.exists) {
                tx.set(userRef, { createdAt: serverNow, ...balanceUpdate }, { merge: true });
            }
            else {
                tx.update(userRef, balanceUpdate);
            }
            tx.set(userRef.collection("offers").doc(), {
                offerId,
                type: "survey",
                amount: final,
                baseAmount: base,
                userBaseAmount: baseUserAmount,
                bonusAmount,
                bonusPercent,
                userPercent,
                createdAt: serverNow,
            }, { merge: true });
        });
        res.status(200).send("OK");
    }
    catch (err) {
        console.error("Error in bitlabsSurveyCallback:", err);
        res.status(500).send("Internal error");
    }
});
////////////////////////////////////////////////////////////////////////////////
//  MAGIC RECEIPTS CALLBACK — revenue share with streak bonus
////////////////////////////////////////////////////////////////////////////////
exports.magicReceiptsCallback = (0, https_1.onRequest)({ secrets: [OFFERS_SECRET], region: "us-central1", maxInstances: 1 }, async (req, res) => {
    try {
        if (req.method !== "GET" && req.method !== "POST") {
            res.status(405).send("Method not allowed");
            return;
        }
        const secretFromRequest = req.query.secret ?? (req.body && req.body.secret);
        const expectedSecret = OFFERS_SECRET.value();
        if (!secretFromRequest || secretFromRequest !== expectedSecret) {
            console.warn("Invalid secret on magic receipts callback:", secretFromRequest);
            res.status(403).send("Forbidden");
            return;
        }
        const uid = req.query.uid ??
            req.query.user_id ??
            (req.body && req.body.uid);
        const receiptId = req.query.receipt_id ??
            (req.body && req.body.receipt_id);
        const payoutRaw = req.query.payout ??
            req.query.reward ??
            (req.body && req.body.payout);
        const txId = req.query.tx ?? (req.body && req.body.tx);
        if (!uid || !receiptId || !payoutRaw || !txId) {
            res.status(400).send("Missing uid / receiptId / payout / tx");
            return;
        }
        const basePayout = Number(payoutRaw);
        if (!isFinite(basePayout) || basePayout <= 0) {
            res.status(400).send("Invalid payout");
            return;
        }
        const velocity = await (0, velocity_1.checkOfferVelocity)(uid, "magic_receipt");
        if (velocity.blocked) {
            await (0, velocity_1.logVelocityBlock)({
                uid,
                source: "magic_receipt",
                txId,
                amount: basePayout,
                counts: velocity.counts,
                reasons: velocity.reasons,
            });
            res.status(200).send("OK (velocity block)");
            return;
        }
        await db.runTransaction(async (tx) => {
            const userRef = db.collection("users").doc(uid);
            const userSnap = await tx.get(userRef);
            const now = admin.firestore.Timestamp.now();
            const serverNow = admin.firestore.FieldValue.serverTimestamp();
            const bonusPercentRaw = userSnap.exists
                ? userSnap.data()?.bonusPercent
                : 0;
            const { base, baseUserAmount, final, bonusAmount, bonusPercent, userPercent, } = applyRevenueShare(basePayout, bonusPercentRaw);
            const balanceUpdate = {
                balance: admin.firestore.FieldValue.increment(final),
                auditLog: admin.firestore.FieldValue.arrayUnion({
                    type: "magic_receipt",
                    receiptId,
                    amount: final,
                    baseAmount: base,
                    userBaseAmount: baseUserAmount,
                    bonusAmount,
                    bonusPercent,
                    userPercent,
                    txId,
                    at: now,
                }),
            };
            if (!userSnap.exists) {
                tx.set(userRef, { createdAt: serverNow, ...balanceUpdate }, { merge: true });
            }
            else {
                tx.update(userRef, balanceUpdate);
            }
            tx.set(userRef.collection("offers").doc(), {
                receiptId,
                type: "magic_receipt",
                amount: final,
                baseAmount: base,
                userBaseAmount: baseUserAmount,
                bonusAmount,
                bonusPercent,
                userPercent,
                txId,
                createdAt: serverNow,
            }, { merge: true });
        });
        res.status(200).send("OK");
    }
    catch (err) {
        console.error("Error in magicReceiptsCallback:", err);
        res.status(500).send("Internal error");
    }
});
////////////////////////////////////////////////////////////////////////////////
//  BITLABS RECEIPT CALLBACK — revenue share with streak bonus
////////////////////////////////////////////////////////////////////////////////
exports.bitlabsReceiptCallback = (0, https_1.onRequest)({ secrets: [OFFERS_SECRET], region: "us-central1", maxInstances: 1 }, async (req, res) => {
    try {
        if (req.method !== "GET" && req.method !== "POST") {
            res.status(405).send("Method not allowed");
            return;
        }
        const secretFromRequest = req.query.secret ?? (req.body && req.body.secret);
        const expectedSecret = OFFERS_SECRET.value();
        if (!secretFromRequest || secretFromRequest !== expectedSecret) {
            console.warn("Invalid secret on receipt callback:", secretFromRequest);
            res.status(403).send("Forbidden");
            return;
        }
        const uid = req.query.uid ??
            req.query.user_id ??
            (req.body && req.body.uid);
        const offerId = req.query.offer_id ??
            (req.body && req.body.offer_id);
        const payoutRaw = req.query.payout ??
            req.query.reward ??
            (req.body && req.body.payout);
        if (!uid || !offerId || !payoutRaw) {
            res.status(400).send("Missing uid / offerId / payout");
            return;
        }
        const basePayout = Number(payoutRaw);
        if (!isFinite(basePayout) || basePayout <= 0) {
            res.status(400).send("Invalid payout");
            return;
        }
        const velocity = await (0, velocity_1.checkOfferVelocity)(uid, "bitlabs_receipt");
        if (velocity.blocked) {
            await (0, velocity_1.logVelocityBlock)({
                uid,
                source: "bitlabs_receipt",
                txId: offerId || null,
                amount: basePayout,
                counts: velocity.counts,
                reasons: velocity.reasons,
            });
            res.status(200).send("OK (velocity block)");
            return;
        }
        await db.runTransaction(async (tx) => {
            const userRef = db.collection("users").doc(uid);
            const userSnap = await tx.get(userRef);
            const serverNow = admin.firestore.FieldValue.serverTimestamp();
            const now = admin.firestore.Timestamp.now();
            const bonusPercentRaw = userSnap.exists
                ? userSnap.data()?.bonusPercent
                : 0;
            const { base, baseUserAmount, final, bonusAmount, bonusPercent, userPercent, } = applyRevenueShare(basePayout, bonusPercentRaw);
            const balanceUpdate = {
                balance: admin.firestore.FieldValue.increment(final),
                auditLog: admin.firestore.FieldValue.arrayUnion({
                    type: "magic_receipt",
                    offerId,
                    amount: final,
                    baseAmount: base,
                    userBaseAmount: baseUserAmount,
                    bonusAmount,
                    bonusPercent,
                    userPercent,
                    at: now,
                }),
            };
            if (!userSnap.exists) {
                tx.set(userRef, { createdAt: serverNow, ...balanceUpdate }, { merge: true });
            }
            else {
                tx.update(userRef, balanceUpdate);
            }
            tx.set(userRef.collection("offers").doc(), {
                offerId,
                type: "magic_receipt",
                amount: final,
                baseAmount: base,
                userBaseAmount: baseUserAmount,
                bonusAmount,
                bonusPercent,
                userPercent,
                createdAt: serverNow,
            }, { merge: true });
        });
        res.status(200).send("OK");
    }
    catch (err) {
        console.error("Error in bitlabsReceiptCallback:", err);
        res.status(500).send("Internal error");
    }
});
////////////////////////////////////////////////////////////////////////////////
//  SHORTCUT BONUS (PWA install / standalone launch)
////////////////////////////////////////////////////////////////////////////////
const SHORTCUT_BONUS_AMOUNT = 0.05;
const SHORTCUT_BONUS_ID = "shortcut_bonus";
exports.claimShortcutBonus = functions.https.onCall(async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "You must be logged in.");
    }
    const uid = request.auth.uid;
    const userRef = db.collection("users").doc(uid);
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists) {
            throw new https_1.HttpsError("failed-precondition", "User not found.");
        }
        const data = snap.data() || {};
        const alreadyClaimed = data.shortcutBonusClaimed === true;
        if (alreadyClaimed) {
            throw new https_1.HttpsError("failed-precondition", "Shortcut bonus already claimed.");
        }
        const now = admin.firestore.Timestamp.now();
        const serverNow = admin.firestore.FieldValue.serverTimestamp();
        const startedOfferRef = userRef
            .collection("startedOffers")
            .doc(SHORTCUT_BONUS_ID);
        tx.update(userRef, {
            balance: admin.firestore.FieldValue.increment(SHORTCUT_BONUS_AMOUNT),
            shortcutBonusClaimed: true,
            shortcutBonusAt: serverNow,
            shortcutBonusToken: null,
            auditLog: admin.firestore.FieldValue.arrayUnion({
                type: "shortcut_bonus",
                amount: SHORTCUT_BONUS_AMOUNT,
                at: now,
            }),
        });
        tx.set(startedOfferRef, {
            status: "completed",
            completedAt: serverNow,
            lastUpdatedAt: serverNow,
            totalPayout: SHORTCUT_BONUS_AMOUNT,
            title: "Home screen bonus",
            type: "bonus",
            source: "pwa_shortcut",
        }, { merge: true });
        tx.set(userRef.collection("offers").doc(), {
            offerId: SHORTCUT_BONUS_ID,
            type: "bonus",
            amount: SHORTCUT_BONUS_AMOUNT,
            source: "pwa_shortcut",
            createdAt: serverNow,
        }, { merge: true });
        return { ok: true, amount: SHORTCUT_BONUS_AMOUNT };
    });
});
////////////////////////////////////////////////////////////////////////////////
//  DAILY CHECK-IN — callable function (server-only streak update)
////////////////////////////////////////////////////////////////////////////////
exports.dailyCheckIn = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be logged in to check in.");
    }
    const uid = request.auth.uid;
    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();
    const now = admin.firestore.Timestamp.now();
    const nowDate = now.toDate();
    let dailyStreak = 0;
    let bonusPercent = 0;
    let lastCheckIn = null;
    if (snap.exists) {
        const data = snap.data() || {};
        dailyStreak = typeof data.dailyStreak === "number" ? data.dailyStreak : 0;
        bonusPercent =
            typeof data.bonusPercent === "number" ? data.bonusPercent : 0;
        lastCheckIn = data.lastCheckIn || null;
    }
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    let updated = false;
    let reset = false;
    const round2 = (n) => Math.round(n * 100) / 100;
    if (!lastCheckIn) {
        // first ever check-in
        dailyStreak = 1;
        bonusPercent = 0.5;
        updated = true;
    }
    else {
        const lastDate = lastCheckIn.toDate();
        const diffMs = nowDate.getTime() - lastDate.getTime();
        const diffDays = diffMs / ONE_DAY_MS;
        if (diffDays < 0.75) {
            // already checked in "today" (within ~18h window)
            updated = false;
        }
        else if (diffDays < 1.75) {
            // next day: increment
            dailyStreak = dailyStreak + 1;
            bonusPercent = clampBonusPercent(bonusPercent + 0.5);
            updated = true;
        }
        else {
            // missed too long: reset
            dailyStreak = 1;
            bonusPercent = 0.5;
            reset = true;
            updated = true;
        }
    }
    if (updated) {
        bonusPercent = round2(bonusPercent);
        await userRef.set({
            dailyStreak,
            bonusPercent,
            lastCheckIn: now,
        }, { merge: true });
    }
    return {
        updated,
        reset,
        dailyStreak,
        bonusPercent,
        lastCheckIn: now.toMillis(),
    };
});
////////////////////////////////////////////////////////////////////////////////
//  CLEANUP — purge completed startedOffers after 3 days
////////////////////////////////////////////////////////////////////////////////
exports.cleanupCompletedOffers = (0, scheduler_1.onSchedule)("every 24 hours", async () => {
    const db = admin.firestore();
    const retentionMs = 3 * 24 * 60 * 60 * 1000; // keep completed offers for 72h
    const cutoff = admin.firestore.Timestamp.fromDate(new Date(Date.now() - retentionMs));
    console.log("Starting cleanupCompletedOffers (3d retention), cutoff:", cutoff.toDate());
    const usersSnap = await db.collection("users").get();
    const batchSize = 400;
    let batch = db.batch();
    let writeCount = 0;
    const commits = [];
    for (const userDoc of usersSnap.docs) {
        const startedRef = userDoc.ref.collection("startedOffers");
        const completedSnap = await startedRef
            .where("status", "==", "completed")
            .where("completedAt", "<", cutoff)
            .get();
        if (completedSnap.empty)
            continue;
        completedSnap.forEach((docSnap) => {
            batch.delete(docSnap.ref);
            writeCount++;
            if (writeCount >= batchSize) {
                commits.push(batch.commit());
                batch = db.batch();
                writeCount = 0;
            }
        });
    }
    if (writeCount > 0)
        commits.push(batch.commit());
    await Promise.all(commits);
    console.log("cleanupCompletedOffers finished.");
});
////////////////////////////////////////////////////////////////////////////////
//  CLIENT FINGERPRINT LOGGING (IP/device reuse telemetry)
////////////////////////////////////////////////////////////////////////////////
exports.logUserFingerprint = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "You must be logged in.");
    }
    const uid = request.auth.uid;
    const deviceIdRaw = request.data?.deviceId;
    const deviceId = typeof deviceIdRaw === "string" && deviceIdRaw.trim()
        ? deviceIdRaw.trim()
        : "unknown";
    const userAgentRaw = request.data?.userAgent;
    const userAgent = typeof userAgentRaw === "string" && userAgentRaw.trim()
        ? userAgentRaw.trim()
        : "";
    const ipFromClient = (typeof request.data?.ip === "string" && request.data.ip.trim()) || "";
    const forwarded = request.rawRequest?.headers?.["x-forwarded-for"] || "";
    const serverIp = forwarded?.split(",")[0]?.trim() ||
        request.rawRequest?.ip ||
        "";
    const ip = ipFromClient || serverIp || "";
    const ipHash = ip
        ? crypto.createHash("sha256").update(ip).digest("hex")
        : "unknown";
    const ipMasked = ip
        ? ip.replace(/(\d+)$/, "***").replace(/([a-f0-9]{1,4})$/i, "****")
        : null;
    const nowTs = admin.firestore.Timestamp.now();
    const serverNow = admin.firestore.FieldValue.serverTimestamp();
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userUpdates = {
        lastDeviceId: deviceId,
        lastUserAgent: userAgent || null,
        lastIp: ipMasked || null,
        lastIpHash: ipHash || null,
        fingerprintUpdatedAt: serverNow,
    };
    if (!userSnap.exists || !userSnap.data()?.deviceId) {
        userUpdates.deviceId = deviceId;
    }
    await userRef.set(userUpdates, { merge: true });
    await userRef
        .collection("fingerprints")
        .doc(deviceId || "unknown")
        .set({
        deviceId,
        ip: ipMasked || null,
        ipHash,
        serverIp: serverIp || null,
        userAgent: userAgent || null,
        lastSeen: serverNow,
    }, { merge: true });
    let deviceUserCount = 1;
    if (deviceId && deviceId !== "unknown") {
        await db.runTransaction(async (tx) => {
            const docRef = db.collection("deviceFingerprints").doc(deviceId);
            const snap = await tx.get(docRef);
            const existing = (snap.data()?.userIds || []).filter(Boolean);
            const set = new Set(existing);
            set.add(uid);
            const arr = Array.from(set).slice(-50);
            deviceUserCount = arr.length;
            tx.set(docRef, {
                userIds: arr,
                count: arr.length,
                lastSeen: serverNow,
                lastIp: ipMasked || null,
                lastIpHash: ipHash || null,
            }, { merge: true });
        });
    }
    let ipUserCount = 1;
    if (ipHash && ipHash !== "unknown") {
        await db.runTransaction(async (tx) => {
            const docRef = db.collection("ipClusters").doc(ipHash);
            const snap = await tx.get(docRef);
            const existing = (snap.data()?.userIds || []).filter(Boolean);
            const set = new Set(existing);
            set.add(uid);
            const arr = Array.from(set).slice(-100);
            ipUserCount = arr.length;
            tx.set(docRef, {
                userIds: arr,
                count: arr.length,
                lastIp: ipMasked || null,
                lastSeen: serverNow,
            }, { merge: true });
        });
    }
    await db.collection("fraudLogs").add({
        type: "fingerprint",
        uid,
        deviceId,
        ipMasked: ipMasked || null,
        ipHash,
        deviceUserCount,
        ipUserCount,
        userAgent: userAgent || null,
        createdAt: serverNow,
        recordedAt: nowTs,
    });
    return {
        deviceUserCount,
        ipUserCount,
        ipHash,
    };
});

var cpxPostback_1 = require("./cpxPostback");
Object.defineProperty(exports, "cpxPostback", { enumerable: true, get: function () { return cpxPostback_1.cpxPostback; } });
////////////////////////////////////////////////////////////////////////////////
//  PAYOUT MIRRORING (cashout & donation -> user/{uid}/payouts)
////////////////////////////////////////////////////////////////////////////////
const writeUserPayout = async (userId, payoutId, data) => {
    const ref = db.collection("users").doc(userId).collection("payouts").doc(payoutId);
    await ref.set({
        ...data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
};
const sendTelegramMessage = async (text) => {
    const token = TELEGRAM_BOT_TOKEN.value() || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = TELEGRAM_CHAT_ID.value() || process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId)
        return;
    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: "Markdown",
            }),
        });
    }
    catch (err) {
        console.error("Telegram notify failed:", err);
    }
};
const notifyPayoutEmail = async (params) => {
    try {
        const resendKey = RESEND_API_KEY.value() || process.env.RESEND_API_KEY;
        if (!resendKey) {
            console.warn("Email notify skipped: RESEND_API_KEY missing");
            return;
        }
        const snap = await db.collection("users").doc(params.userId).get();
        const email = snap.data()?.email;
        const username = snap.data()?.username;
        if (!email)
            return;
        const friendlyStatus = params.status.toString().toLowerCase();
        const amount = Number(params.amount) || 0;
        const method = params.method || params.type;
        const subject = friendlyStatus === "fulfilled"
            ? "Your ReadyBread payout was sent"
            : friendlyStatus === "denied"
                ? "Update on your ReadyBread payout"
                : "We received your ReadyBread payout request";
        const textLines = [
            `Hi ${username || "there"},`,
            "",
            friendlyStatus === "fulfilled"
                ? `Great news - your $${amount.toFixed(2)} ${params.type} via ${method} was just fulfilled.`
                : friendlyStatus === "denied"
                    ? `We reviewed your $${amount.toFixed(2)} ${params.type} request and could not approve it.`
                    : `We received your $${amount.toFixed(2)} ${params.type} request via ${method}.`,
        ];
        if (params.notes) {
            textLines.push("", `Notes: ${params.notes}`);
        }
        textLines.push("", "-- ReadyBread team");
        const text = textLines.join("\n");
        await sendEmail({
            to: email,
            subject,
            text,
            html: `<p>${textLines.map((l) => l || "<br/>").join("<br/>")}</p>`,
        });
    }
    catch (err) {
        console.error("Payout email notify failed:", err);
    }
};
exports.mirrorCashoutToUser = (0, firestore_1.onDocumentWritten)({
    document: "cashout_requests/{id}",
    secrets: [TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, RESEND_API_KEY],
}, async (event) => {
    const after = event.data?.after;
    if (!after?.data())
        return;
    const data = after.data();
    const prev = event.data?.before?.data();
    const userId = data.userId;
    if (!userId)
        return;
    const payoutId = event.params.id;
    const amount = Number(data.amount) || 0;
    const status = typeof data.status === "string" ? data.status : "pending";
    const method = typeof data.method === "string" ? data.method : "cashout";
    const notes = (typeof data.denialReason === "string" && data.denialReason) ||
        (typeof data.notes === "string" && data.notes) ||
        null;
    const createdAt = data.createdAt || admin.firestore.FieldValue.serverTimestamp();
    await writeUserPayout(userId, payoutId, {
        type: "cashout",
        amount,
        status,
        method,
        notes,
        createdAt,
        decidedAt: data.decidedAt || admin.firestore.FieldValue.serverTimestamp(),
        adminUid: data.adminUid || null,
        refunded: Boolean(data.refunded),
        cryptoFee: typeof data.cryptoFee === "number" && isFinite(data.cryptoFee)
            ? data.cryptoFee
            : null,
    });
    // Notify admin channel when a new request is created
    if (!prev && status === "pending") {
        const dest = data.paypalEmail ||
            data.cashappTag ||
            data.venmoUsername ||
            data.bitcoinAddress ||
            data.litecoinAddress ||
            data.dogecoinAddress ||
            method;
        await sendTelegramMessage(`New cashout request:\n• User: ${userId}\n• Amount: $${amount.toFixed(2)}\n• Method: ${method}\n• Destination: ${dest || "N/A"}`);
    }
    // Email user on status change to fulfilled/denied
    if (!prev) {
        await notifyPayoutEmail({
            userId,
            amount,
            status,
            method,
            type: "cashout",
        });
    }
    else if (prev.status !== status) {
        await notifyPayoutEmail({
            userId,
            amount,
            status,
            method,
            type: "cashout",
            notes,
        });
    }
});
exports.mirrorDonationToUser = (0, firestore_1.onDocumentWritten)({
    document: "donation_requests/{id}",
    secrets: [RESEND_API_KEY],
}, async (event) => {
    const after = event.data?.after;
    if (!after?.data())
        return;
    const data = after.data();
    const prev = event.data?.before?.data();
    const userId = data.userId;
    if (!userId)
        return;
    const payoutId = event.params.id;
    const amount = Number(data.amount) || 0;
    const status = typeof data.status === "string" ? data.status : "pending";
    const method = (typeof data.charityName === "string" && data.charityName) || "Donation";
    const notes = (typeof data.denialReason === "string" && data.denialReason) ||
        (typeof data.notes === "string" && data.notes) ||
        null;
    const createdAt = data.createdAt || admin.firestore.FieldValue.serverTimestamp();
    await writeUserPayout(userId, payoutId, {
        type: "donation",
        amount,
        status,
        method,
        notes,
        createdAt,
        decidedAt: data.decidedAt || admin.firestore.FieldValue.serverTimestamp(),
        adminUid: data.adminUid || null,
        refunded: Boolean(data.refunded),
    });
    if (!prev) {
        await notifyPayoutEmail({
            userId,
            amount,
            status,
            method,
            type: "donation",
        });
    }
    else if (prev.status !== status) {
        await notifyPayoutEmail({
            userId,
            amount,
            status,
            method,
            type: "donation",
            notes,
        });
    }
});
const QUEST_REWARDS = {
    "daily-survey": { cash: 0.01, scope: "daily" },
    "daily-game": { cash: 0.01, scope: "daily" },
    "week-surveys": { cash: 0.05, scope: "weekly" },
    "week-games": { cash: 0.05, scope: "weekly" },
    "week-referral": { cash: 0.05, scope: "weekly" },
    "home-screen": { cash: 0.05, scope: "general" }, // aligns with shortcut bonus
    "email-verified": { cash: 0.01, scope: "general" },
    "first-offer": { cash: 0.02, scope: "general" },
    "first-survey": { cash: 0.01, scope: "general" },
};
const QUEST_TITLES = {
    "daily-survey": "Daily survey quest reward",
    "daily-game": "Daily game quest reward",
    "week-surveys": "Weekly surveys quest reward",
    "week-games": "Weekly games quest reward",
    "week-referral": "Weekly referral quest reward",
    "home-screen": "Home screen quest reward",
    "email-verified": "Email verification quest reward",
    "first-offer": "First offer quest reward",
    "first-survey": "First survey quest reward",
};
const getEasternOffsetMinutes = () => {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "longOffset",
        hour12: false,
    }).formatToParts(new Date());
    const tz = parts.find((p) => p.type === "timeZoneName")?.value || "GMT-05:00";
    const match = tz.match(/GMT([+-])(\d{2}):?(\d{2})?/);
    if (!match)
        return -300;
    const sign = match[1] === "-" ? -1 : 1;
    const hours = parseInt(match[2], 10);
    const minutes = parseInt(match[3] || "0", 10);
    return sign * (hours * 60 + minutes);
};
const getQuestWindowStart = (scope) => {
    if (scope === "general")
        return 0;
    const offsetMinutes = getEasternOffsetMinutes();
    const offsetMs = offsetMinutes * 60 * 1000;
    const now = Date.now();
    const estNow = new Date(now + offsetMs);
    const startOfDayEst = new Date(estNow);
    startOfDayEst.setHours(0, 0, 0, 0);
    if (scope === "daily") {
        return startOfDayEst.getTime() - offsetMs;
    }
    // weekly (Monday start)
    const startOfWeekEst = new Date(startOfDayEst);
    const day = startOfDayEst.getDay(); // 0 = Sun, 1 = Mon
    const daysSinceMonday = (day + 6) % 7;
    startOfWeekEst.setDate(startOfWeekEst.getDate() - daysSinceMonday);
    return startOfWeekEst.getTime() - offsetMs;
};
exports.claimQuestReward = functions.https.onCall(async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "You must be logged in.");
    }
    const uid = request.auth.uid;
    const questId = (request.data?.questId || "").toString();
    const quest = QUEST_REWARDS[questId];
    if (!quest) {
        throw new https_1.HttpsError("invalid-argument", "Unknown quest.");
    }
    const windowStart = getQuestWindowStart(quest.scope);
    const claimKey = `${questId}-${windowStart}`;
    const now = admin.firestore.Timestamp.now();
    const serverNow = admin.firestore.FieldValue.serverTimestamp();
    const userRef = db.collection("users").doc(uid);
    const claimRef = userRef.collection("questClaims").doc(claimKey);
    const offerRef = userRef.collection("offers").doc();
    const startedOfferRef = userRef.collection("startedOffers").doc(claimKey);
    const questTitle = QUEST_TITLES[questId] || "Quest reward";
    return db.runTransaction(async (tx) => {
        const [userSnap, claimSnap] = await Promise.all([
            tx.get(userRef),
            tx.get(claimRef),
        ]);
        if (!userSnap.exists) {
            throw new https_1.HttpsError("failed-precondition", "User not found.");
        }
        if (claimSnap.exists) {
            return { ok: true, alreadyClaimed: true, cash: quest.cash };
        }
        if (quest.cash > 0) {
            tx.update(userRef, {
                balance: admin.firestore.FieldValue.increment(quest.cash),
                auditLog: admin.firestore.FieldValue.arrayUnion({
                    type: "quest",
                    questId,
                    amount: quest.cash,
                    at: now,
                }),
            });
        }
        tx.set(claimRef, {
            questId,
            scope: quest.scope,
            windowStart,
            cash: quest.cash,
            createdAt: serverNow,
        }, { merge: true });
        if (quest.cash > 0) {
            tx.set(startedOfferRef, {
                status: "completed",
                startedAt: serverNow,
                completedAt: serverNow,
                lastUpdatedAt: serverNow,
                totalPayout: quest.cash,
                title: questTitle,
                type: "quest",
                source: "Readybread Quests",
                questId,
                questScope: quest.scope,
                claimKey,
            }, { merge: true });
        }
        tx.set(offerRef, {
            offerId: questId,
            type: "quest",
            source: "Readybread Quests",
            amount: quest.cash,
            createdAt: serverNow,
        }, { merge: true });
        return { ok: true, cash: quest.cash };
    });
});

////////////////////////////////////////////////////////////////////////////////
//  TEST MULTI-EVENT OFFER WEBHOOK (internal testing)
////////////////////////////////////////////////////////////////////////////////
exports.testOfferMultiEvent = (0, https_1.onRequest)({ secrets: [OFFERS_SECRET_TEST], region: "us-central1" }, async (req, res) => {
    try {
        if (req.method !== "GET" && req.method !== "POST") {
            res.status(405).send("Method not allowed");
            return;
        }
        const params = req.method === "POST"
            ? { ...req.query, ...req.body }
            : { ...req.query };
        const providedSecret = params.secret || "";
        const expectedSecret = OFFERS_SECRET_TEST.value();
        if (!providedSecret || providedSecret !== expectedSecret) {
            res.status(403).send("Forbidden");
            return;
        }
        const uid = params.uid ||
            params.user_id ||
            params.sub_id ||
            params.player_id ||
            "";
        const offerId = params.offer_id ||
            params.offerId ||
            "test-ios-multi";
        const goalIndexRaw = params.goal ??
            params.goal_index ??
            params.goalIdx ??
            params.event_number ??
            params.step ??
            params.index;
        const goalIndex = Number(goalIndexRaw);
        if (!uid || goalIndexRaw === undefined || goalIndexRaw === null) {
            res.status(400).send("Missing uid / goal index");
            return;
        }
        if (!Number.isInteger(goalIndex) || goalIndex < 0) {
            res.status(400).send("Invalid goal index");
            return;
        }
        const txId = params.tx_id ||
            params.tx ||
            params.transaction_id ||
            params.trans_id ||
            `${offerId}_goal${goalIndex}`;
        const txRef = db.collection("completedOffers").doc(String(txId));
        const existing = await txRef.get();
        if (existing.exists) {
            res.status(200).send("OK (duplicate ignored)");
            return;
        }
        let alreadyCompleted = false;
        await db.runTransaction(async (t) => {
            const userRef = db.collection("users").doc(uid);
            const userSnap = await t.get(userRef);
            const now = admin.firestore.Timestamp.now();
            const serverNow = admin.firestore.FieldValue.serverTimestamp();
            const bonusPercentRaw = userSnap.exists
                ? userSnap.data()?.bonusPercent
                : 0;
            const bonusPercent = clampBonusPercent(bonusPercentRaw);
            const startedOfferRef = userRef.collection("startedOffers").doc(offerId);
            const startedSnap = await t.get(startedOfferRef);
            const startedData = startedSnap.exists ? startedSnap.data() || {} : {};
            const objectivesRaw = Array.isArray(startedData.objectives)
                ? startedData.objectives
                : [];
            const objectives = objectivesRaw
                .map((o) => {
                const baseReward = Number(o?.reward ?? o?.amount ?? o?.value ?? o?.payout ?? 0);
                const rewardWithBonus = Number(o?.rewardWithBonus ?? o?.rewardFinal);
                const computedWithBonus = Math.round(baseReward * (1 + bonusPercent / 100) * 100) / 100;
                return {
                    label: o?.label || "",
                    reward: baseReward,
                    baseReward,
                    rewardWithBonus: isFinite(rewardWithBonus)
                        ? rewardWithBonus
                        : computedWithBonus,
                    isCompleted: o?.isCompleted === true,
                    completedTxId: o?.completedTxId,
                };
            })
                .filter((o) => Boolean(o.label));
            if (objectives.length === 0) {
                throw new https_1.HttpsError("failed-precondition", "Objectives not found on offer. Start the offer from the feed first.");
            }
            if (goalIndex >= objectives.length) {
                throw new https_1.HttpsError("invalid-argument", "Goal index out of range for this offer");
            }
            const objective = objectives[goalIndex];
            if (objective.isCompleted) {
                alreadyCompleted = true;
                return;
            }
            if (!isFinite(objective.reward) || objective.reward <= 0) {
                throw new https_1.HttpsError("failed-precondition", "Objective reward is missing or invalid");
            }
            const baseAmount = Math.round(objective.reward * 100) / 100;
            const rewardWithBonus = Math.round(baseAmount * (1 + bonusPercent / 100) * 100) / 100;
            const bonusAmount = Math.round((rewardWithBonus - baseAmount) * 100) / 100;
            const userPercent = 100 + bonusPercent;
            objectives[goalIndex] = {
                ...objective,
                isCompleted: true,
                rewardWithBonus,
                rewardFinal: rewardWithBonus,
                baseReward: baseAmount,
                completedAt: serverNow,
                completedTxId: txId,
            };
            const totalObjectives = Number.isFinite(startedData.totalObjectives)
                ? Number(startedData.totalObjectives)
                : objectives.length;
            const completedObjectives = Math.min(objectives.filter((o) => o.isCompleted).length, totalObjectives);
            const isCompleted = completedObjectives >= totalObjectives;
            const totalPayout = objectives.reduce((sum, o) => {
                const value = isFinite(o.rewardWithBonus)
                    ? Number(o.rewardWithBonus)
                    : Number(o.reward) || 0;
                return sum + value;
            }, 0);
            const completedPayout = objectives.reduce((sum, o) => {
                if (!o.isCompleted)
                    return sum;
                const value = isFinite(o.rewardWithBonus)
                    ? Number(o.rewardWithBonus)
                    : Number(o.reward) || 0;
                return sum + value;
            }, 0);
            t.set(startedOfferRef, {
                title: startedData.title || "Test iOS Multi-Event Offer",
                totalPayout: Math.round(totalPayout * 100) / 100,
                completedPayout: Math.round(completedPayout * 100) / 100,
                estMinutes: startedData.estMinutes ?? null,
                imageUrl: startedData.imageUrl ||
                    "https://dummyimage.com/512x512/90e0ef/1f1a0a&text=TEST",
                clickUrl: startedData.clickUrl || null,
                source: startedData.source || "test-multi-webhook",
                type: startedData.type || "game",
                status: isCompleted ? "completed" : "in_progress",
                startedAt: startedData.startedAt || serverNow,
                completedAt: isCompleted ? serverNow : startedData.completedAt || null,
                lastUpdatedAt: serverNow,
                totalObjectives,
                completedObjectives,
                objectives,
            }, { merge: true });
            if (userSnap.exists) {
                t.update(userRef, {
                    balance: admin.firestore.FieldValue.increment(rewardWithBonus),
                    auditLog: admin.firestore.FieldValue.arrayUnion({
                        type: "test-offer",
                        offerId,
                        goalIndex,
                        label: objective.label || `Goal ${goalIndex + 1}`,
                        amount: rewardWithBonus,
                        baseAmount,
                        userBaseAmount: baseAmount,
                        bonusAmount,
                        bonusPercent,
                        userPercent,
                        txId,
                        at: now,
                    }),
                });
            }
            else {
                t.set(userRef, {
                    balance: rewardWithBonus,
                    createdAt: serverNow,
                    auditLog: [
                        {
                            type: "test-offer",
                            offerId,
                            goalIndex,
                            label: objective.label || `Goal ${goalIndex + 1}`,
                            amount: rewardWithBonus,
                            baseAmount,
                            userBaseAmount: baseAmount,
                            bonusAmount,
                            bonusPercent,
                            userPercent,
                            txId,
                            at: now,
                        },
                    ],
                }, { merge: true });
            }
            t.set(userRef.collection("offers").doc(), {
                offerId,
                type: "test-offer",
                source: "test-multi-webhook",
                amount: rewardWithBonus,
                baseAmount,
                userBaseAmount: baseAmount,
                bonusAmount,
                bonusPercent,
                userPercent,
                goalIndex,
                goalLabel: objective.label || `Goal ${goalIndex + 1}`,
                txId,
                createdAt: serverNow,
            }, { merge: true });
            t.set(txRef, {
                uid,
                offerId,
                goalIndex,
                goalLabel: objective.label || `Goal ${goalIndex + 1}`,
                payout: rewardWithBonus,
                baseAmount,
                userBaseAmount: baseAmount,
                bonusAmount,
                bonusPercent,
                userPercent,
                source: "TestMultiOffer",
                txId,
                creditedAt: serverNow,
            }, { merge: true });
        });
        if (alreadyCompleted) {
            res.status(200).json({
                ok: true,
                offerId,
                goalIndex,
                txId,
                alreadyCompleted: true,
            });
            return;
        }
        res.status(200).json({ ok: true, offerId, goalIndex, txId });
    }
    catch (err) {
        console.error("Test multi-offer webhook error:", err);
        res.status(500).send("Internal error");
    }
});
