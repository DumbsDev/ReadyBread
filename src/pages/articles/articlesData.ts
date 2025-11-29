// src/pages/articles/articlesData.ts
import welcometoreadybreadMd from "./welcome-to-readybread.md?raw";
import beginnerGuideMd from "./beginners-guide.md?raw";
import bestMobileGamesToEarnMd from "./best-mobile-games-to-earn.md?raw";
import howCPEWorksMd from "./how-cpe-works.md?raw";
import campusEarningStrategiesMd from "./campus-earning-strategies.md?raw";
import surveyVsGamesMd from "./surveys-vs-games.md?raw";
import steamMachine from "./steam-machine.md?raw";
import collegeMoney from "./college-money-strategies.md?raw";
import mobileRise from "./rise-of-mobile-gaming.md?raw";

export interface Article {
  slug: string;
  title: string;
  file: string;
  description: string;
  createdAt: string;
  content: string;
}

const articles: Article[] = [
  {
    slug: "welcome-to-readybread",
    title: "Welcome to ReadyBread!! 🎉",
    file: "welcome-to-readybread.md",
    description: "Learn how ReadyBread works, who we are, and how to earn.",
    createdAt: "2025-11-27",
    content: welcometoreadybreadMd,
  },

  {
    slug: "beginner-guide",
    title: "The Beginner Guide to Earning on ReadyBread",
    file: "beginner-guide.md",
    description: "A simple walkthrough for new users on how to earn your first $5.",
    createdAt: "2025-11-28",
    content: beginnerGuideMd,
  },

  {
    slug: "best-mobile-games-to-earn",
    title: "Best Mobile Games to Earn Money in 2025",
    file: "best-mobile-games-to-earn.md",
    description: "A curated list of fun mobile games that also pay you on ReadyBread.",
    createdAt: "2025-11-28",
    content: bestMobileGamesToEarnMd,
  },

  {
    slug: "how-cpe-works",
    title: "How Cost-Per-Event (CPE) Works on ReadyBread",
    file: "how-cpe-works.md",
    description: "A simple explanation of how game levels, objectives, and payouts work.",
    createdAt: "2025-11-28",
    content: howCPEWorksMd,
  },

  {
    slug: "campus-earning-strategies",
    title: "Campus-Friendly Earning Strategies for Students",
    file: "campus-earning-strategies.md",
    description: "Realistic ways to earn between classes with minimal effort.",
    createdAt: "2025-11-28",
    content: campusEarningStrategiesMd,
  },

  {
    slug: "surveys-vs-games",
    title: "Surveys vs. Games: Which Pays Better?",
    file: "surveys-vs-games.md",
    description: "Comparing earning rates, time-to-complete, and best options.",
    createdAt: "2025-11-28",
    content: surveyVsGamesMd,
  },

  {
    slug: "rise-of-mobile-gaming",
    title: "The Rise of Mobile Gaming",
    file: "rise-of-mobile-gaming.md",
    description: "Mobile games dominate the market now, but how? And why?",
    createdAt: "2025-11-28",
    content: mobileRise,
  },

  {
    slug: "college-money-strategies",
    title: "10 Ways to Earn and Save Money as a College Student in 2025 and 2026",
    file: "college-money-strategies.md",
    description: "How to really get the most bang for your buck, as a college student.",
    createdAt: "2025-11-28",
    content: collegeMoney,
  },

  {
    slug: "steam-machine",
    title: "Valve's new \"Steam Machine\", what is it?",
    file: "steam-machine.md",
    description: "Steam just released a brand new console. Let's discuss its costs and capabilities.",
    createdAt: "2025-11-28",
    content: steamMachine,
  }
];

// newest → oldest
const sortedArticles = [...articles].sort(
  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
);

export function getArticleBySlug(slug: string): Article | undefined {
  return sortedArticles.find((a) => a.slug === slug);
}

export default sortedArticles;
