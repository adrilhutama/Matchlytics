// ---- analytics.js ----
// Quantitative utility functions for Matchlytics:
// - Poisson Score Matrix (6x6) computation
// - Zero-Vig True Fair Odds (Margin Stripping & Overround)
// - Net Edge & Margin of Safety (Buffer Index)
// - Kelly Criterion & Fractional Staking
// - Client-side Monte Carlo Simulation (3,000 iterations)
// - Multi-Match Parlay Engine & Persistence
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
 * Zero-Vig True Fair Odds (Margin Stripping)
 * Strips bookmaker juice using proportional overround normalization.
 */
export function calculateZeroVigOdds(oddsHome, oddsDraw, oddsAway) {
  const oH = Number(oddsHome);
  const oD = Number(oddsDraw);
  const oA = Number(oddsAway);

  if (!oH || !oD || !oA || oH <= 1 || oD <= 1 || oA <= 1) {
    return null;
  }

  const S = (1 / oH) + (1 / oD) + (1 / oA);
  const vigPercent = (S - 1) * 100;

  const fairProbHome = (1 / oH) / S;
  const fairProbDraw = (1 / oD) / S;
  const fairProbAway = (1 / oA) / S;

  return {
    overround: Math.round(S * 1000) / 1000,
    vigPercent: Math.round(vigPercent * 100) / 100,
    fairOddsHome: Math.round((1 / fairProbHome) * 100) / 100,
    fairOddsDraw: Math.round((1 / fairProbDraw) * 100) / 100,
    fairOddsAway: Math.round((1 / fairProbAway) * 100) / 100,
    fairProbHomePct: Math.round(fairProbHome * 1000) / 10,
    fairProbDrawPct: Math.round(fairProbDraw * 1000) / 10,
    fairProbAwayPct: Math.round(fairProbAway * 1000) / 10,
  };
}

/**
 * Expected Value & Net Edge
 */
export function calculateEdgeAndEV(odds, modelProbPercent) {
  const o = Number(odds);
  const pModel = Number(modelProbPercent);
  if (!o || o <= 1 || !pModel || pModel <= 0) {
    return { impliedProb: 0, evPercent: 0, netEdge: 0 };
  }
  const impliedProb = (1 / o) * 100;
  const evPercent = ((pModel / 100) * o - 1) * 100;
  const netEdge = pModel - impliedProb;

  return {
    impliedProb: Math.round(impliedProb * 10) / 10,
    evPercent: Math.round(evPercent * 10) / 10,
    netEdge: Math.round(netEdge * 10) / 10,
  };
}

/**
 * Margin of Safety (Buffer Index)
 */
export function getMarginOfSafety(netEdge) {
  const edge = Number(netEdge) || 0;
  if (edge < 4.0) {
    return {
      tier: 'Thin Edge',
      label: 'Thin Edge',
      colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      description: 'Tight margin of safety. Susceptible to market variance and lineup shifts.',
    };
  }
  if (edge < 9.0) {
    return {
      tier: 'Solid Edge',
      label: 'Solid Edge',
      colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      description: 'Healthy statistical cushion above bookmaker juice and pricing model noise.',
    };
  }
  return {
    tier: 'Robust Edge',
    label: 'Robust Edge',
    colorClass: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
    description: 'Substantial quantitative disparity. Model projects significant positive expectation.',
  };
}

/**
 * Kelly Criterion & Fractional Staking
 */
export function calculateKelly(odds, modelProbPercent) {
  const o = Number(odds);
  const p = Number(modelProbPercent) / 100;
  if (!o || o <= 1 || !p || p <= 0) {
    return { fullKelly: 0, fullKellyPct: 0, quarterKellyPct: 0, evPercent: 0, tier: 'No Value', tierClass: 'text-slate-400' };
  }

  const b = o - 1;
  const q = 1 - p;
  const fullKelly = Math.max(0, (b * p - q) / b);
  const quarterKellyPct = Math.min(5.0, Math.max(0, fullKelly * 0.25 * 100));

  const ev = (p * o - 1) * 100;
  let tier = 'No Value';
  let tierClass = 'text-slate-400';
  if (ev >= 15.0) {
    tier = 'Prime Edge';
    tierClass = 'text-amber-300 font-bold';
  } else if (ev >= 8.0) {
    tier = 'High Value';
    tierClass = 'text-emerald-300 font-semibold';
  } else if (ev >= 2.0) {
    tier = 'Moderate Value';
    tierClass = 'text-sky-300 font-medium';
  }

  return {
    fullKelly: Math.round(fullKelly * 1000) / 1000,
    fullKellyPct: Math.round(fullKelly * 1000) / 10,
    quarterKellyPct: Math.round(quarterKellyPct * 10) / 10,
    evPercent: Math.round(ev * 10) / 10,
    tier,
    tierClass,
  };
}

/**
 * Fast Poisson Pseudo-random generator (Knuth's method)
 */
function samplePoisson(lambda) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1.0;
  do {
    k++;
    p *= Math.random();
  } while (p > L && k < 20);
  return Math.max(0, k - 1);
}

/**
 * Client-side Monte Carlo Match Simulation (3,000 runs)
 */
export function runMonteCarloSimulation(lambdaHome, lambdaAway, iterations = 3000) {
  const lh = Math.max(0.2, Math.min(4.5, Number(lambdaHome) || 1.35));
  const la = Math.max(0.2, Math.min(4.5, Number(lambdaAway) || 1.35));

  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;

  let homeCleanSheets = 0;
  let awayCleanSheets = 0;

  let margin1 = 0;
  let margin2 = 0;
  let margin3Plus = 0;

  let bracketLow = 0;     // 0-1 goals
  let bracketNormal = 0;  // 2-3 goals
  let bracketHigh = 0;    // 4+ goals

  for (let i = 0; i < iterations; i++) {
    const goalsH = samplePoisson(lh);
    const goalsA = samplePoisson(la);
    const totalGoals = goalsH + goalsA;
    const diff = Math.abs(goalsH - goalsA);

    if (goalsH > goalsA) homeWins++;
    else if (goalsH === goalsA) draws++;
    else awayWins++;

    if (goalsA === 0) homeCleanSheets++;
    if (goalsH === 0) awayCleanSheets++;

    if (diff === 1) margin1++;
    else if (diff === 2) margin2++;
    else if (diff >= 3) margin3Plus++;

    if (totalGoals <= 1) bracketLow++;
    else if (totalGoals <= 3) bracketNormal++;
    else bracketHigh++;
  }

  const toPct = (count) => Math.round((count / iterations) * 1000) / 10;

  return {
    iterations,
    homeWinPct: toPct(homeWins),
    drawPct: toPct(draws),
    awayWinPct: toPct(awayWins),
    homeCleanSheetPct: toPct(homeCleanSheets),
    awayCleanSheetPct: toPct(awayCleanSheets),
    margin1Pct: toPct(margin1),
    margin2Pct: toPct(margin2),
    margin3PlusPct: toPct(margin3Plus),
    bracketLowPct: toPct(bracketLow),
    bracketNormalPct: toPct(bracketNormal),
    bracketHighPct: toPct(bracketHigh),
  };
}

/**
 * Multi-Match Parlay Engine & LocalStorage
 */
export const PARLAY_STORAGE_KEY = 'matchlytics_parlay_slip';

export function getParlaySlip() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PARLAY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to load parlay slip:', err);
    return [];
  }
}

export function saveParlaySlip(slip) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PARLAY_STORAGE_KEY, JSON.stringify(slip));
  } catch (err) {
    console.error('Failed to save parlay slip:', err);
  }
}

export function calculateParlayAggregates(legs) {
  if (!legs || legs.length === 0) {
    return {
      count: 0,
      totalOdds: 1.0,
      jointProb: 0,
      combinedEv: 0,
      recommendedStakePct: 0,
      isPositiveEv: false,
    };
  }

  let totalOdds = 1.0;
  let jointProbDecimal = 1.0;

  for (const leg of legs) {
    const odds = Number(leg.odds) || 1.0;
    const prob = (Number(leg.modelProb) || 0) / 100;
    totalOdds *= odds;
    jointProbDecimal *= prob;
  }

  const jointProbPct = jointProbDecimal * 100;
  const combinedEv = (jointProbDecimal * totalOdds - 1) * 100;

  let recommendedStakePct = 0;
  if (combinedEv > 0 && totalOdds > 1) {
    const b = totalOdds - 1;
    const p = jointProbDecimal;
    const q = 1 - p;
    const fullKelly = Math.max(0, (b * p - q) / b);
    recommendedStakePct = Math.min(3.0, Math.max(0, fullKelly * 0.25 * 100));
  }

  return {
    count: legs.length,
    totalOdds: Math.round(totalOdds * 100) / 100,
    jointProb: Math.round(jointProbPct * 10) / 10,
    combinedEv: Math.round(combinedEv * 10) / 10,
    recommendedStakePct: Math.round(recommendedStakePct * 10) / 10,
    isPositiveEv: combinedEv > 0,
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
  if (fixture.value_pick) {
    return true;
  }
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
 * Check if fixture falls into specified date range
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
    const day = now.getDay();
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
