export interface QuestHistoryItem {
  id?: string;
  type?: string | null;
  source?: string | null;
  createdAt?: any;
  amount?: number | null;
}

export interface QuestReferralDoc {
  joinedAt?: any;
}

export interface QuestWindows {
  dailyStart: number;
  weeklyStart: number;
  nextDailyReset: number;
  nextWeeklyReset: number;
}

export interface QuestStats {
  surveysToday: number;
  surveysWeek: number;
  gamesToday: number;
  gamesWeek: number;
  totalSurveys: number;
  totalGames: number;
  totalOfferEvents: number;
  totalReferrals: number;
  referralsThisWeek: number;
}

const parseEasternOffsetMinutes = (): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "longOffset",
    hour12: false,
  }).formatToParts(new Date());

  const tz = parts.find((p) => p.type === "timeZoneName")?.value || "GMT-05:00";
  const match = tz.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!match) return -300;

  const sign = match[1] === "-" ? -1 : 1;
  const hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3] || "0", 10);

  return sign * (hours * 60 + minutes);
};

export const getQuestWindows = (): QuestWindows => {
  const offsetMinutes = parseEasternOffsetMinutes();
  const offsetMs = offsetMinutes * 60 * 1000;
  const now = Date.now();
  const estNow = now + offsetMs;
  const estDate = new Date(estNow);

  const startOfDayEst = new Date(estDate);
  startOfDayEst.setHours(0, 0, 0, 0);

  const startOfWeekEst = new Date(startOfDayEst);
  const day = startOfDayEst.getDay(); // 0 = Sun, 1 = Mon
  const daysSinceMonday = (day + 6) % 7;
  startOfWeekEst.setDate(startOfWeekEst.getDate() - daysSinceMonday);

  const nextDayEst = new Date(startOfDayEst);
  nextDayEst.setDate(startOfDayEst.getDate() + 1);

  const nextWeekEst = new Date(startOfWeekEst);
  nextWeekEst.setDate(startOfWeekEst.getDate() + 7);

  const toUtcMs = (date: Date) => date.getTime() - offsetMs;

  return {
    dailyStart: toUtcMs(startOfDayEst),
    weeklyStart: toUtcMs(startOfWeekEst),
    nextDailyReset: toUtcMs(nextDayEst),
    nextWeeklyReset: toUtcMs(nextWeekEst),
  };
};

export const timestampToMs = (value: any): number | null => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return null;
};

export const isSurveyEvent = (item: QuestHistoryItem): boolean => {
  const type = `${item.type || item.source || ""}`.toLowerCase();
  return (
    type.includes("survey") ||
    type.includes("bitlabs") ||
    type.includes("cpx")
  );
};

export const isGameEvent = (item: QuestHistoryItem): boolean => {
  const type = `${item.type || item.source || ""}`.toLowerCase();
  return type.includes("game") || type.includes("app");
};

export const computeQuestStats = (
  offers: QuestHistoryItem[],
  referrals: QuestReferralDoc[],
  windows: QuestWindows,
  extraEvents: QuestHistoryItem[] = []
): QuestStats => {
  const dailyStart = windows.dailyStart;
  const dailyEnd = windows.nextDailyReset;
  const weeklyStart = windows.weeklyStart;
  const weeklyEnd = windows.nextWeeklyReset;

  const events = [...offers, ...extraEvents];

  let surveysToday = 0;
  let surveysWeek = 0;
  let gamesToday = 0;
  let gamesWeek = 0;
  let totalSurveys = 0;
  let totalGames = 0;

  events.forEach((item) => {
    const ms = timestampToMs(item.createdAt);
    if (ms == null) return;

    if (isSurveyEvent(item)) {
      totalSurveys += 1;
      if (ms >= dailyStart && ms < dailyEnd) surveysToday += 1;
      if (ms >= weeklyStart && ms < weeklyEnd) surveysWeek += 1;
    }

    if (isGameEvent(item)) {
      totalGames += 1;
      if (ms >= dailyStart && ms < dailyEnd) gamesToday += 1;
      if (ms >= weeklyStart && ms < weeklyEnd) gamesWeek += 1;
    }
  });

  const referralsThisWeek = referrals.filter((r) => {
    const ms = timestampToMs(r.joinedAt);
    if (ms == null) return false;
    return ms >= weeklyStart && ms < weeklyEnd;
  }).length;

  return {
    surveysToday,
    surveysWeek,
    gamesToday,
    gamesWeek,
    totalSurveys,
    totalGames,
    totalOfferEvents: events.length,
    totalReferrals: referrals.length,
    referralsThisWeek,
  };
};
