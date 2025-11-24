// src/data/tutorials.ts

export interface TutorialArticle {
  slug: string;
  title: string;
  content: string[]; // paragraphs or blocks
}

export interface TutorialCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  articles: TutorialArticle[];
}

export const tutorialCategories: TutorialCategory[] = [
  {
    id: "gaming",
    name: "Gaming",
    icon: "🎮",
    description: "Install, play, complete objectives, earn cash.",
    articles: [
      {
        slug: "how-gaming-offers-work",
        title: "How Gaming Offers Work",
        content: [
          "Gaming offers allow you to earn money by installing and playing mobile or desktop games through partners like BitLabs and AdGem.",
          "Always install from the ReadyBread link—this ensures the offer tracks properly.",
          "Offers usually require you to reach a certain level, unlock features, or complete milestones.",
          "Progress may update instantly or within 1–24 hours, depending on the partner.",
          "Never uninstall the game before the reward is credited to your ReadyBread balance."
        ]
      }
    ]
  },

  {
    id: "surveys",
    name: "Surveys",
    icon: "📋",
    description: "Answer honestly & earn fast.",
    articles: [
      {
        slug: "survey-basics",
        title: "Survey Basics & Best Practices",
        content: [
          "Surveys are quick, consistent ways to earn daily rewards.",
          "Disqualifications are normal—partners use matching to find the perfect fit.",
          "Answer consistently across similar questions; contradictions cause disqualifications.",
          "Check back multiple times per day—surveys refresh constantly."
        ]
      }
    ]
  },

  {
    id: "receipts",
    name: "Receipts",
    icon: "🧾",
    description: "Earn by uploading store receipts.",
    articles: [
      {
        slug: "how-magic-receipts-work",
        title: "How Magic Receipts Work",
        content: [
          "Magic Receipts lets you upload grocery store receipts to earn money when your items match live offers.",
          "Ensure the receipt is readable and shows store, date, and items clearly.",
          "Upload receipts within 7 days of purchase for best results.",
          "This works at most grocery stores, markets, and major chains."
        ]
      }
    ]
  },

  {
    id: "referrals",
    name: "Referrals",
    icon: "🤝",
    description: "Invite friends, earn bonuses.",
    articles: [
      {
        slug: "referral-system-explained",
        title: "How the Referral System Works",
        content: [
          "Invite friends using your unique referral code to earn bonus cash.",
          "You earn $0.05 per referral, up to a total of $1.00.",
          "They must verify email and complete a task for the reward to apply.",
          "Same-device or repeated signups are blocked by security checks."
        ]
      }
    ]
  },

  {
    id: "cashouts",
    name: "Cashouts",
    icon: "💸",
    description: "Withdraw earnings to PayPal, CashApp, or crypto.",
    articles: [
      {
        slug: "cashout-guide",
        title: "ReadyBread Cashout Guide",
        content: [
          "Cash out your earnings through PayPal, Cash App, Bitcoin, or charity donations.",
          "Minimums are low, and there are zero withdrawal fees.",
          "Most cashouts are processed same day, depending on volume."
        ]
      }
    ]
  },

  {
    id: "security",
    name: "Security",
    icon: "🔐",
    description: "Account protection & anti-cheat information.",
    articles: [
      {
        slug: "security-overview",
        title: "Security & Fairness Overview",
        content: [
          "ReadyBread uses Firebase Auth and strict Firestore rules to ensure fairness and prevent exploits.",
          "Device checks prevent multiple fake accounts created from the same phone or computer.",
          "All earnings are logged with timestamps to prevent manipulation."
        ]
      }
    ]
  },

  {
    id: "offerwalls",
    name: "Offerwalls",
    icon: "📦",
    description: "BitLabs, AdGem, AyeT & how they track.",
    articles: [
      {
        slug: "offerwalls-explained",
        title: "How Offerwalls Work",
        content: [
          "Offerwalls are external partners that provide tasks, surveys, and games.",
          "ReadyBread currently supports BitLabs (surveys + games), AdGem (game wall), and AyeT (coming soon).",
          "Your progress is tracked by the partner and reported to ReadyBread upon completion."
        ]
      }
    ]
  }
];
