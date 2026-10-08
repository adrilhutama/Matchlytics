// ---- analytics.js ----
// Quantitative utility functions for Matchlytics:
// - Poisson Score Matrix (6x6) computation
// - Zero-Vig True Fair Odds (Margin Stripping & Overround)
// - Net Edge & Margin of Safety (Buffer Index)
// - Kelly Criterion & Fractional Staking
// - Client-side Monte Carlo Simulation (10,000 iterations)
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
  const lh = Math.max(0.6, Math.min(3.2, Number(lambdaHome) || 1.35));
  const la = Math.max(0.6, Math.min(3.2, Number(lambdaAway) || 1.35));

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
  const cellMasses = [];

  for (let away = 0; away <= maxGoals; away++) {
    const row = [];
    for (let home = 0; home <= maxGoals; home++) {
      // Raw joint mass before normalisation
      const rawCell = (probH[home] * probA[away]) || 0;
      cellMasses.push(rawCell);
      row.push({
        home,
        away,
        prob: rawCell,
      });
    }
    matrix.push(row);
  }

  // The truncated 0..5 grid loses Poisson tail mass; renormalise every
  // cell by its own total so the heatmap strictly converges to 100%
  // regardless of lambda pair (cells read as conditional probabilities).
  const totalMass = cellMasses.reduce((acc, v) => acc + v, 0);
  if (totalMass > 0) {
    for (const row of matrix) {
      for (const cell of row) {
        cell.prob = (cell.prob / totalMass) * 100;
      }
    }
  }

  for (const row of matrix) {
    for (const cell of row) {
      if (cell.prob > maxProb) {
        maxProb = cell.prob;
        mostProbable = { home: cell.home, away: cell.away, prob: cell.prob };
      }

      if (cell.home > cell.away) sumHomeWin += cell.prob;
      else if (cell.home === cell.away) sumDraw += cell.prob;
      else sumAwayWin += cell.prob;

      if (cell.home + cell.away > 2.5) sumOver25 += cell.prob;
      if (cell.home > 0 && cell.away > 0) sumBtts += cell.prob;
    }
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
  // Apply guardrails matching Python find_best_pick: odds [1.25, 12.0], prob >= 15%
  if (!o || o < 1.25 || o > 12.0 || !pModel || pModel < 15) {
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
  // Hard-cap stake at 2.5% of bankroll (quarter-kelly fraction of full
  // Kelly, floored at 0 so negative-EV scenarios allocate nothing).
  const quarterKellyPct = Math.min(2.5, Math.max(0, fullKelly * 0.25 * 100));

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
 * Raw Kelly percentage helper (returns full Kelly % 0-100)
 */
export function getKellyFraction(odds, modelProbPercent) {
  const res = calculateKelly(odds, modelProbPercent);
  return res.fullKellyPct;
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
 * Client-side Monte Carlo Match Simulation
 * Default 10,000 iterations to match QuantLab and Python evaluator.
 */
export function runMonteCarloSimulation(lambdaHome, lambdaAway, iterations = 10000) {
  const lh = Math.max(0.6, Math.min(3.2, Number(lambdaHome) || 1.35));
  const la = Math.max(0.6, Math.min(3.2, Number(lambdaAway) || 1.35));

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
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((leg) => Boolean(leg && (leg.fixtureId != null || leg.id != null))) : [];
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
    // Same 2.5% hard cap as single-bet staking
    recommendedStakePct = Math.min(2.5, Math.max(0, fullKelly * 0.25 * 100));
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
 * Determine whether odds are aggregated sharp-market consensus prices
 * or fallback model fair odds.
 */
export function isRealMarketOdds(fixture) {
  if (!fixture) return false;
  const h2h = fixture.market_odds?.h2h || {};
  const rawH = typeof h2h.home === 'number' ? h2h.home : (h2h.home?.price || h2h.consensus?.home);
  const rawD = typeof h2h.draw === 'number' ? h2h.draw : (h2h.draw?.price || h2h.consensus?.draw);
  const rawA = typeof h2h.away === 'number' ? h2h.away : (h2h.away?.price || h2h.consensus?.away);
  const oddsH = rawH || fixture.odds_home;
  const oddsD = rawD || fixture.odds_draw;
  const oddsA = rawA || fixture.odds_away;

  if (!oddsH || !oddsD || !oddsA) {
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
 * Check if fixture falls into specified date range.
 *
 * Kickoff instants arrive as ISO strings (UTC, seconds or ms). Both
 * sides parse through Date so the comparison is instant-based, not
 * calendar-string based, which keeps the feed honest across timezones
 * (a GMT+7 viewer never loses a UTC-afternoon kickoff to a midnight
 * boundary mismatch).
 */
export function isDateInRange(isoString, rangeKey) {
  if (!isoString) return false;
  const now = new Date();
  const matchDate = new Date(isoString);
  if (Number.isNaN(matchDate.getTime())) return false;

  if (rangeKey === 'today') {
    // Calendar-today in local time, widened to cover kicks that land
    // within the next 24 hours (late-evening fixtures, timezone gap).
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const isCalendarToday = matchDate >= startOfToday && matchDate <= endOfToday;
    const isNext24Hours = matchDate >= now && matchDate <= new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return isCalendarToday || isNext24Hours;
  }

  if (rangeKey === 'week' || rangeKey === 'weekly') {
    // Pro horizon: everything from now through the next 7 days.
    const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return matchDate >= now && matchDate <= endOfWeek;
  }

  if (rangeKey === 'all' || rangeKey === 'month' || rangeKey === '30days' || rangeKey === 'monthly') {
    // Season horizon: full 30 day window with a short look-back so a
    // live match that kicked off shortly before page load stays visible.
    const startOfMonth = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const endOfMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return matchDate >= startOfMonth && matchDate <= endOfMonth;
  }

  return true;
}

/**
 * Diacritic-insensitive team & league search matching
 */
export function matchesSearch(fixture, query) {
  if (!fixture) return false;
  if (!query || !query.trim()) return true;
  const q = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const home = (fixture?.home_team?.name || fixture?.home_team_name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const away = (fixture?.away_team?.name || fixture?.away_team_name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const league = (fixture?.league_name || fixture?.competition_code || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return home.includes(q) || away.includes(q) || league.includes(q);
}

/**
 * Multi-criteria sorting
 */
export function sortFixtures(fixtures, sortKey) {
  const list = (fixtures || []).filter(Boolean);
  switch (sortKey) {
    case 'kickoff_asc':
      return list.sort((a, b) => new Date(a?.kickoff_time || a?.match_date || 0) - new Date(b?.kickoff_time || b?.match_date || 0));
    case 'ev_desc':
      return list.sort((a, b) => {
        const evA = a?.ev_percentage != null ? Number(a.ev_percentage) : -999;
        const evB = b?.ev_percentage != null ? Number(b.ev_percentage) : -999;
        return evB - evA;
      });
    case 'home_prob_desc':
      return list.sort((a, b) => {
        const pA = a?.prob_home != null ? Number(a.prob_home) : -1;
        const pB = b?.prob_home != null ? Number(b.prob_home) : -1;
        return pB - pA;
      });
    case 'xg_total_desc':
      return list.sort((a, b) => {
        const xgA = (Number(a?.lambda_home) || 0) + (Number(a?.lambda_away) || 0);
        const xgB = (Number(b?.lambda_home) || 0) + (Number(b?.lambda_away) || 0);
        return xgB - xgA;
      });
    default:
      return list;
  }
}

/**
 * Multi-class Brier score for a single fixture.
 * Brier = (p_h - y_h)^2 + (p_d - y_d)^2 + (p_a - y_a)^2
 * Inputs are percentages (0-100); outputs a decimal sum of squares.
 */
export function calculateBrierScore(probHome, probDraw, probAway, actualOutcome) {
  const ph = Math.max(0, Math.min(1, Number(probHome) > 1 ? Number(probHome) / 100 : Number(probHome)))
  const pd = Math.max(0, Math.min(1, Number(probDraw) > 1 ? Number(probDraw) / 100 : Number(probDraw)))
  const pa = Math.max(0, Math.min(1, Number(probAway) > 1 ? Number(probAway) / 100 : Number(probAway)))

  const yh = actualOutcome === 'HOME' ? 1 : 0
  const yd = actualOutcome === 'DRAW' ? 1 : 0
  const ya = actualOutcome === 'AWAY' ? 1 : 0

  return (ph - yh) ** 2 + (pd - yd) ** 2 + (pa - ya) ** 2
}

/**
 * Simulate a historical bankroll from settled fixtures.
 * Returns cumulative equity series for Flat and Quarter-Kelly staking,
 * plus aggregated performance statistics.
 *
 * @param {Array<{match_date,value_pick,odds_home,odds_draw,odds_away,home_score,away_score,prob_home,prob_draw,prob_away,league_name}>} settledFixtures
 * @param {number} kellyPct  Quarter-Kelly stake percentage (default 2.5)
 * @returns {{stats,bets,flatEquity,kellyEquity,brierScore}}
 */
export function simulateBankroll(settledFixtures, kellyPct = 2.5) {
  if (!settledFixtures || settledFixtures.length === 0) {
    return { stats: null, bets: [], flatEquity: [], kellyEquity: [], brierScore: null }
  }

  const sorted = [...settledFixtures].sort((a, b) =>
    new Date(a.match_date) - new Date(b.match_date)
  )

  const bets = []
  const flatEquity = []
  const kellyEquity = []
  let flatBalance = 100
  let kellyBalance = 100
  let wins = 0
  let losses = 0
  let brierSum = 0
  let brierN = 0

  for (const f of sorted) {
    const h = Number(f.home_score)
    const a = Number(f.away_score)
    let actualOutcome
    if (h > a) actualOutcome = 'HOME'
    else if (h < a) actualOutcome = 'AWAY'
    else actualOutcome = 'DRAW'

    const pick = f.value_pick
    const oddsMap = { HOME: f.odds_home, DRAW: f.odds_draw, AWAY: f.odds_away }
    const marketOdds = Number(oddsMap[pick] ?? 0) || 1.0
    const isWin = pick === actualOutcome

    let flatProfit
    let kellyProfit
    if (isWin) {
      wins++
      flatProfit = marketOdds - 1
      kellyProfit = (kellyPct / 100) * (marketOdds - 1)
    } else {
      losses++
      flatProfit = -1
      kellyProfit = -(kellyPct / 100)
    }

    flatBalance += flatProfit
    kellyBalance += kellyProfit

    flatEquity.push({
      index: bets.length,
      match_date: f.match_date,
      matchLabel: `${f.home_team_name ?? '?'} vs ${f.away_team_name ?? '?'}`,
      league: f.league_name,
      equity: Math.round(flatBalance * 100) / 100,
      betProfit: Math.round(flatProfit * 100) / 100,
    })

    kellyEquity.push({
      index: bets.length,
      match_date: f.match_date,
      matchLabel: `${f.home_team_name ?? '?'} vs ${f.away_team_name ?? '?'}`,
      league: f.league_name,
      equity: Math.round(kellyBalance * 100) / 100,
      betProfit: Math.round(kellyProfit * 100) / 100,
    })

    bets.push({
      match_date: f.match_date,
      matchLabel: `${f.home_team_name ?? '?'} vs ${f.away_team_name ?? '?'}`,
      league: f.league_name,
      selection: pick,
      home_score: f.home_score,
      away_score: f.away_score,
      odds: marketOdds,
      outcome: actualOutcome,
      result: isWin ? 'WIN' : 'LOSS',
      flatProfit: Math.round(flatProfit * 100) / 100,
      kellyProfit: Math.round(kellyProfit * 100) / 100,
    })

    const ph = f.prob_home
    const pd = f.prob_draw
    const pa = f.prob_away
    if (ph != null && pd != null && pa != null) {
      const bs = calculateBrierScore(ph, pd, pa, actualOutcome)
      brierSum += bs
      brierN++
    }
  }

  const total = bets.length
  const winRate = total > 0 ? Math.round((wins / total) * 1000) / 10 : 0
  const netUnitsFlat = flatBalance - 100
  const roiPct = total > 0 ? Math.round((netUnitsFlat / total) * 1000) / 10 : 0
  const avgBrier = brierN > 0 ? Math.round((brierSum / brierN) * 1000) / 1000 : null

  const stats = {
    totalBets: total,
    wins,
    losses,
    winRate,
    roiPct,
    brierScore: avgBrier,
    finalFlatEquity: Math.round(flatBalance * 100) / 100,
    finalKellyEquity: Math.round(kellyBalance * 100) / 100,
  }

  return { stats, bets, flatEquity, kellyEquity, brierScore: avgBrier }
}

/**
 * Determine Brier score calibration tier badge.
 */
export function getBrierTier(brier) {
  if (brier == null) return null
  if (brier < 0.20) return { label: 'Well Calibrated', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' }
  if (brier <= 0.25) return { label: 'Moderate', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30' }
  return { label: 'Under-Calibrated', cls: 'text-rose-400 bg-rose-500/10 border-rose-500/30' }
}

/**
 * Watchlist localStorage persistence
 */
export const WATCHLIST_STORAGE_KEY = 'matchlytics_watchlist';

export function getWatchlist() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
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

/**
 * Multi-Market Totals (Over / Under) Probabilities from 6x6 Score Matrix
 */
export function calculatePoissonMatrix(lambdaHome, lambdaAway, maxGoals = 5) {
  const result = computePoissonMatrix(lambdaHome, lambdaAway, maxGoals);
  return result.matrix;
}

export function calculateTotalsFromMatrix(matrix, lines = [1.5, 2.5, 3.5]) {
  const grid = Array.isArray(matrix) ? matrix : (matrix?.matrix || []);
  if (!grid || grid.length === 0) return {};
  const res = {};
  for (const line of lines) {
    let over = 0;
    for (const row of grid) {
      for (const cell of row) {
        if (cell.home + cell.away > line) {
          over += cell.prob;
        }
      }
    }
    const under = Math.max(0, 100 - over);
    res[String(line)] = {
      over: Math.round(over * 10) / 10,
      under: Math.round(under * 10) / 10,
    };
  }
  return res;
}

/**
 * Multi-Market Asian Handicap Probabilities from 6x6 Score Matrix
 */
export function calculateSpreadsFromMatrix(matrix, lines = [-1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5]) {
  const grid = Array.isArray(matrix) ? matrix : (matrix?.matrix || []);
  if (!grid || grid.length === 0) return {};
  const res = {};
  for (const line of lines) {
    let pHome = 0;
    let pAway = 0;
    let pPush = 0;
    for (const row of grid) {
      for (const cell of row) {
        const diff = (cell.home + line) - cell.away;
        if (diff > 1e-5) pHome += cell.prob;
        else if (diff < -1e-5) pAway += cell.prob;
        else pPush += cell.prob;
      }
    }
    const lineKey = line > 0 ? `+${line}` : `${line}`;
    res[lineKey] = {
      home: Math.round(pHome * 10) / 10,
      away: Math.round(pAway * 10) / 10,
      push: Math.round(pPush * 10) / 10,
    };
  }
  return res;
}

/**
 * Calculate expected value for arbitrary market outcomes
 */
export function calculateMarketEV(modelProbPct, odds, pushProbPct = 0) {
  const o = Number(odds);
  const p = Number(modelProbPct) / 100;
  const push = Number(pushProbPct) / 100;
  if (!o || o <= 1 || !p || p <= 0) return null;
  const ev = (p * o + push * 1.0) - 1.0;
  return Math.round(ev * 1000) / 10;
}
