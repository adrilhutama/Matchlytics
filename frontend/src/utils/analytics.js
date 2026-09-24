// ---- analytics.js ----
// Quantitative utility functions for Matchlytics:
// - Poisson Score Matrix (6x6) computation
// - Real vs Fair Odds detection
// - Localized date and relative time formatting
// - Multi-criteria search, date-range filtering, and sorting
// - LocalStorage watchlist persistence

const FACTORIALS = [1, 1, 2, 6, 24, 120];

/**
 * Compute 6x6 Poisson probability score matrix (0-5 goals each)
 * P(k; lambda) = (lambda^k * exp(-lambda)) / k!
 * P(score_x_y) = P(x; lambda_h) * P(y; lambda_a) * 100%
 */
export function computePoissonMatrix(lambdaHome, lambdaAway, maxGoals = 5) {
  const lh = Math.max(0.2, Math.min(4.5, Number(lambdaHome) || 1.35));
  const la = Math.max(0.2, Math.min(4.5, Number(lambdaAway) || 1.35));

  // Precompute single-team probabilities
  const probH = [];
  const probA = [];
  for (let k = 0; k <= maxGoals; k++) {
    const f = FACTORIALS[k] || 1;
    probH[k] = (Math.pow(lh, k) * Math.exp(-lh)) / f;
    probA[k] = (Math.pow(la, k) * Math.exp(-la)) / f;
  }

  const matrix = [];
  let maxProb = 0;
  let mostProbable = { home: 0, away: 0, prob: 0 };
  let sumHomeWin = 0;
  let sumDraw = 0;
  let sumAwayWin = 0;
  let sumOver25 = 0;
  let sumBtts = 0;

  for (let away = 0; away <= maxGoals; away++) {
    const row = [];
    for (let home = 0; home <= maxGoals; home++) {
      const cellProb = probH[home] * probA[away] * 100;
      row.push({
        home,
        away,
        prob: cellProb,
      });

      if (cellProb > maxProb) {
        maxProb = cellProb;
        mostProbable = { home, away, prob: cellProb };
      }

      if (home > away) sumHomeWin += cellProb;
      else if (home === away) sumDraw += cellProb;
      else sumAwayWin += cellProb;

      if (home + away > 2.5) sumOver25 += cellProb;
      if (home > 0 && away > 0) sumBtts += cellProb;
    }
    matrix.push(row);
  }

  return {
    matrix,
    maxProb,
    mostProbable,
    sumHomeWin: Math.round(sumHomeWin * 10) / 10,
    sumDraw: Math.round(sumDraw * 10) / 10,
    sumAwayWin: Math.round(sumAwayWin * 10) / 10,
    sumOver25: Math.round(sumOver25 * 10) / 10,
    sumBtts: Math.round(sumBtts * 10) / 10,
  };
}

/**
 * Determine whether odds are real bookmaker odds (Bet365/Pinnacle)
 * or fallback model fair odds.
 */
export function isRealMarketOdds(fixture) {
  if (!fixture || !fixture.odds_home || !fixture.odds_draw || !fixture.odds_away) {
    return false;
  }
  // If a value pick exists, it was strictly derived against real bookmaker odds
  if (fixture.value_pick) {
    return true;
  }
  // Check if odds exactly mirror 100 / prob fair odds within rounding
  if (fixture.prob_home && fixture.prob_draw) {
    const fairH = 100 / Number(fixture.prob_home);
    const fairD = 100 / Number(fixture.prob_draw);
    const diffH = Math.abs(Number(fixture.odds_home) - fairH);
    const diffD = Math.abs(Number(fixture.odds_draw) - fairD);
    if (diffH <= 0.03 && diffD <= 0.03) {
      return false;
    }
  }
  return true;
}

/**
 * Format localized kickoff date, time, and relative hint.
 */
export function formatLocalizedMatchDate(isoString) {
  if (!isoString) {
    return {
      dateStr: 'TBD',
      timeStr: '',
      relativeBadge: 'TBD',
      fullFormatted: 'TBD',
      isToday: false,
    };
  }

  const d = new Date(isoString);
  const now = new Date();

  const timeStr = d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const dateStr = d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  let relativeBadge = dateStr;
  const diffHours = (d.getTime() - now.getTime()) / (3600 * 1000);

  if (isToday) {
    if (diffHours > 0 && diffHours <= 3) {
      const diffMins = Math.max(1, Math.round((d.getTime() - now.getTime()) / (60 * 1000)));
      relativeBadge = "In " + diffMins + "m";
    } else {
      relativeBadge = "Today " + timeStr;
    }
  } else if (isTomorrow) {
    relativeBadge = "Tomorrow " + timeStr;
  } else if (diffHours > 0 && diffHours <= 72) {
    const days = Math.ceil(diffHours / 24);
    relativeBadge = "In " + days + " days";
  }

  return {
    dateStr,
    timeStr,
    relativeBadge,
    fullFormatted: dateStr + " · " + timeStr,
    isToday,
    isTomorrow,
  };
}

/**
 * Check if fixture falls into specified date range:
 * - 'all': all fixtures within the loaded window
 * - 'today': match occurs on today's local calendar date
 * - 'next3days': match occurs within the next 72 hours
 * - 'weekend': upcoming Friday 12:00 through Sunday 23:59
 */
export function isDateInRange(isoString, rangeKey) {
  if (!isoString || rangeKey === 'all') return true;
  const d = new Date(isoString);
  const now = new Date();

  if (rangeKey === 'today') {
    return d.toDateString() === now.toDateString();
  }

  if (rangeKey === 'next3days') {
    const diffMs = d.getTime() - now.getTime();
    return diffMs >= -3600 * 1000 * 3 && diffMs <= 72 * 3600 * 1000;
  }

  if (rangeKey === 'weekend') {
    const day = now.getDay(); // 0 = Sun, 5 = Fri, 6 = Sat
    const fri = new Date(now);

    if (day === 5 || day === 6 || day === 0) {
      const daysSinceFri = day === 0 ? 2 : day === 6 ? 1 : 0;
      fri.setDate(now.getDate() - daysSinceFri);
    } else {
      const daysUntilFri = 5 - day;
      fri.setDate(now.getDate() + daysUntilFri);
    }
    fri.setHours(12, 0, 0, 0);

    const sun = new Date(fri);
    sun.setDate(fri.getDate() + 2);
    sun.setHours(23, 59, 59, 999);

    const matchTime = d.getTime();
    return matchTime >= fri.getTime() && matchTime <= sun.getTime();
  }

  return true;
}

/**
 * Diacritic-insensitive team & league search matching
 */
export function matchesSearch(fixture, query) {
  if (!query || !query.trim()) return true;
  const q = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const home = (fixture.home_team_name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const away = (fixture.away_team_name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const league = (fixture.league_name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return home.includes(q) || away.includes(q) || league.includes(q);
}

/**
 * Multi-criteria sorting
 */
export function sortFixtures(fixtures, sortKey) {
  const list = [...fixtures];
  switch (sortKey) {
    case 'kickoff_asc':
      return list.sort((a, b) => new Date(a.match_date || 0) - new Date(b.match_date || 0));
    case 'ev_desc':
      return list.sort((a, b) => {
        const evA = a.ev_percentage != null ? Number(a.ev_percentage) : -999;
        const evB = b.ev_percentage != null ? Number(b.ev_percentage) : -999;
        return evB - evA;
      });
    case 'home_prob_desc':
      return list.sort((a, b) => {
        const pA = a.prob_home != null ? Number(a.prob_home) : -1;
        const pB = b.prob_home != null ? Number(b.prob_home) : -1;
        return pB - pA;
      });
    case 'xg_total_desc':
      return list.sort((a, b) => {
        const xgA = (Number(a.lambda_home) || 0) + (Number(a.lambda_away) || 0);
        const xgB = (Number(b.lambda_home) || 0) + (Number(b.lambda_away) || 0);
        return xgB - xgA;
      });
    default:
      return list;
  }
}

/**
 * Watchlist localStorage persistence
 */
export const WATCHLIST_STORAGE_KEY = 'matchlytics_watchlist';

export function getWatchlist() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to load watchlist:', err);
    return [];
  }
}

export function saveWatchlist(watchlist) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
  } catch (err) {
    console.error('Failed to save watchlist:', err);
  }
}

export function toggleWatchlistItem(watchlist, fixtureId) {
  const exists = watchlist.includes(fixtureId);
  const next = exists
    ? watchlist.filter(id => id !== fixtureId)
    : [...watchlist, fixtureId];
  saveWatchlist(next);
  return next;
}
