// src/data/tutorials.ts

export interface TutorialArticle {
  slug: string;
  title: string;
  content: string[]; // paragraphs or blocks (basic HTML like <em>...</em> is allowed)
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
        title: "How gaming offers work",
        content: [
          "Gaming offers allow you to earn money by installing and playing mobile or desktop games through partners like BitLabs and AdGem.",
          "Always install from the ReadyBread link—this ensures the offer tracks properly.",
          "Offers usually require you to reach a certain level, unlock features, or complete milestones.",
          "Progress may take up to 48 hours, depending on the partner.",
          "Never uninstall the game before the reward is credited to your ReadyBread balance.",
          "We try to vet what we can, but fake offers might appear. If you are not credited and are sure you did the offer correctly, send us an email at contact@readybread.xyz."
        ]
      },
      {
        slug: "how-to-track-offers",
        title: "How to properly track offers",
        content: [
          "Offers only pay when your phone lets partners see that you played. Turn tracking on so they can verify you.",
          "<strong>iPhone/iPad</strong>: Settings > Privacy & Security > Tracking > turn on \"Allow Apps to Request to Track.\" When the game asks, tap Allow. Otherwise you will not be credited, and we cannot help you.",
          "<strong>Android</strong>: Settings > Google > Ads (or Settings > Privacy > Ads). Turn off \"Opt out of Ads Personalization.\" Do not delete your Advertising ID while an offer is running. If this is not done, we cannot help you and you will not be credited.",
          "Install from the ReadyBread link, open the game right away, and keep it installed until you get paid.",
          "Use normal Wi-Fi or mobile data. Avoid VPNs, hotel/work Wi-Fi, or weak signal while you play.",
          "Turn off battery saver or data saver for the game so it can report progress.",
          "You MUST be a new user for the app.",
          "If you still do not see credit after 48 hours, take screenshots of your progress and email contact@readybread.xyz so we can check it."
        ]
      },
      {
      slug: "why-is-my-offer-not-tracking",
      title: "Why is my offer not tracking?",
      content: [
        "Goals in offers can take up to 48 hours to process and track. If 48 hours have passed and it still hasn't tracked, there might be another issue.",
        "1. For IOS users, you must enable \"App Tracking\" in your settings, if you haven't already. You can do so by following this flow: Settings -> Privacy & Security -> Tracking -> Allow Apps to Request to Track. If this is not enabled, please do so now to use our offerwall.",
        "2. You may have enabled this, but pressed \"Ask app not to track\" on the popup. This will not allow objectives to track properly. You can toggle tracking for your apps in the app's designated settings.",
        "3. You may have used a VPN. If you complete a task while using a VPN, or VPN insured wifi, it will not track. It is safest to use regular home wifi, or cellular data.",
        "4. If your phone is on low-power mode, or at less than 10%, it may not always track properly.",
        "5. If you have already installed the app before, it will not count and you are inelligible for the offer",
        "5. If you know for a fact none of these are the issue, please contact us at contact@readybread.xyz and we will do our best to fix the issue, or find a proper cause."
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
          "Disqualifications are normal, partners use matching to find the perfect fit.",
          "Answer consistently across similar questions; contradictions cause disqualifications and possibly bans.",
          "Feel free to check back multiple times per day. Surveys refresh constantly, and we run \"Earn Events\" for surveys sometimes."
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
