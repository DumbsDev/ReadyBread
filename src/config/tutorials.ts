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
          "Always install from the ReadyBread link. This ensures the offer tracks properly.",
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
      },
      {
        slug: "why-surveys-disqualify",
        title: "Why Surveys Disqualify You",
        content: [
          "Survey disqualifications are completely normal. They do NOT mean anything is wrong with your account.",
          "Companies conducting surveys need users that fit very specific demographics. If your answers do not match the target group, you may be disqualified instantly.",
          "Most platforms have internal consistency checks. Answering inconsistently (e.g., different ages, incomes, or household info) can cause automatic removal.",
          "Speeding through surveys, skipping questions, or giving random answers can cause quality flags on partner platforms.",
          "To reduce disqualifications, answer honestly, consistently, and in detail when open-text elements appear.",
          "Checking surveys multiple times per day increases availability, as new opportunities appear frequently."
        ]
      },
      {
        slug: "survey-tips",
        title: "Tips to Earn More From Surveys",
        content: [
          "Fill out your profile surveys completely. This helps partner routers better match you and reduces disqualification rates.",
          "Try surveys early morning and late evening. These are peak refresh times for most research companies.",
          "Avoid using VPNs, hotel Wi-Fi, or work networks. They cause mismatch between your IP location and your demographic answers, and VPN's are directly prohibited.",
          "Take your time and answer thoughtfully. Long-term quality scores improve greatly with consistent answering.",
          "If a survey freezes or errors, try refreshing the page once. If still stuck, you can safely close the survey and try another."
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
          "You earn $0.25 per referral, up to a total of $1.00.",
          "They must verify email for the reward to apply.",
          "Same-device or repeated signups are blocked by security checks. If this is attempted too many times, we will restrict your account."
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
          "Minimums are low, and there are zero withdrawal fees, except for bitcoin. If you mess up your payout (wrong credentials), contact us immediately wiht your User ID and we will refund your request. Crypto withdrawals are not elligible for this.",
        ]
      },
      {
        slug: "cashout-times",
        title: "How Long Do Cashouts Take?",
        content: [
          "Most cashouts are reviewed and completed within the day, but during periods of high volume it may take a few days, up to 72 hours.",
          "PayPal and Cash App payouts are usually the fastest, however speed still depends on when you request, how, and the day of the month.",
          "Crypto payouts depend on network congestion. Bitcoin and e-transfer payouts may take a bit longer to confirm.",
          "If 72 hours pass and you still have not received your payout, contact support at contact@readybread.xyz and include your User ID."
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
    icon: "🧱",
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
      },
      {
        slug: "offerwall-delays",
        title: "Why Offerwall Rewards Take Time",
        content: [
          "Offerwall tasks are processed by the partner, not by ReadyBread directly.",
          "Some tasks credit instantly, while others require up to 24–72 hours to confirm depending on the network.",
          "Partners need to verify your installation, app usage, or completion proof before sending us the reward.",
          "If a long-running offer does not credit, take screenshots of your progress and email us for help."
        ]
      },
      {
        slug: "vpn-warning",
        title: "Offerwalls & VPN's",
        content: [
          "Using a VPN, Proxy, or mobile hotspot can cause instant disqualification from our offerwalls",
          "Offerwalls check your IP, device type, and region. If they do not match, the task will not track.",
          "If you see a warning from BitLabs, OfferToro, or Lootably, switch to normal Wi-Fi or cellular data.",
          "Repeated VPN usage can lead to account restrictions or blocked offerwall access.",
          "Please note that our partners check VPN status, but so do we. Please disable your VPN while using ReadyBread and it's partnered offerwalls and sites."
        ]
      }
    ]
  },

  {
    id: "account",
    name: "Account",
    icon: "👤",
    description: "Your ReadyBread profile, login info, and account settings.",
    articles: [
      {
        slug: "account-basics",
        title: "Account Basics",
        content: [
          "You only need an email and password to create a ReadyBread account.",
          "We recommend verifying your email immediately so you can cash out and keep your account safe.",
          "You may only have ONE ReadyBread account per person and per device.",
          "If you lose access to your account, contact support and provide details so we can try to recover it."
        ]
      },
      {
        slug: "multiple-devices",
        title: "Using ReadyBread on Multiple Devices",
        content: [
          "You may use ReadyBread on different devices as long as they belong to YOU.",
          "However, multiple accounts from the same device are not allowed and will be automatically flagged.",
          "Using public Wi-Fi, school Wi-Fi, or work networks may cause issues because many users share the same IP.",
          "Avoid logging in from VPNs while using ReadyBread as you will be disqualified from surveys, and barred from earning."
        ]
      }
    ]
  },
  {
    id: "support",
    name: "Support",
    icon: "🛟",
    description: "Help, troubleshooting, and contacting ReadyBread support.",
    articles: [
      {
        slug: "when-to-contact-support",
        title: "When to Contact Support",
        content: [
          "You can contact support anytime something feels wrong with tracking, offers, surveys, or payouts.",
          "Before emailing, double-check that your internet connection is stable and you did not use a VPN.",
          "We respond fastest to issues involving payments, account access, or missing rewards.",
          "Our support email is: <strong>contact@readybread.xyz</strong>.",
          "We will do our best to help. Please note: ReadyBread is operated by only 2 employees. It may take up to 3 business days for us to get back to you, and up to 10 business days to completely solve your issue."
        ]
      },
      {
        slug: "fix-most-issues",
        title: "Fix 90% of Issues Yourself",
        content: [
          "Try refreshing the page or restarting your device. Stuck offers often track correctly afterward, as the cache needs to be cleared.",
          "Ensure your device’s time & date are correct; surveys and offers break when clocks are off.",
          "If a survey freezes, close it and open a new one. Do NOT refresh during an active survey unless it breaks.",
          "Make sure you have not blocked cookies or turned off tracking in your browser settings."
        ]
      }
    ]
  }


];
