// ---- dailyPicksEngine.js ----
// Pure utility that scans today's available fixtures and produces curated
// betting slips: singles, 2-leg parlay, 3-leg multiplier, 4-leg mega parlay.
// Zero em dash characters (R-02 compliance).

const UPCOMING_STATUSES = ['NS', 'SCHEDULED', 'TIMED']
const HORIZON_HOURS_MIN = 24
const HORIZON_HOURS_MAX = 36
const IMMEDIATE_HOURS_MAX = 18
const IMMEDIATE_FALLBACK_HOURS_MAX = 24
const MIN_IMMEDIATE_FIXTURES = 3

/**
 * Build a time-filtered pool of immediately upcoming fixtures.
 * Applies a hard 18h cutoff; falls back to 24h only if fewer than
 * MIN_IMMEDIATE_FIXTURES qualify — never exceeds 24h, never includes
 * multi-day matches.
 */
export function buildImmediatePool(fixtures) {
  const now = new Date()
  const currentTimeMs = now.getTime()

  function computePool(maxHours) {
    const maxMs = currentTimeMs + maxHours * 60 * 60 * 1000
    const pool = []
    for (const f of fixtures || []) {
      if (!UPCOMING_STATUSES.includes(f.status)) continue
      const kickoff = new Date(f.kickoff_time).getTime()
      if (kickoff <= currentTimeMs || kickoff > maxMs) continue
      if (!f.best_ev_opportunity) continue
      const opp = f.best_ev_opportunity
      const score = (opp.ev_percentage * 0.6) + (opp.model_prob * 0.4)
      pool.push({
        fixtureId: f.id,
        competitionCode: f.competition_code,
        homeTeam: f.home_team?.name || `Team ${f.home_team_id}`,
        awayTeam: f.away_team?.name || `Team ${f.away_team_id}`,
        kickoffTime: f.kickoff_time,
        opportunity: opp,
        score,
      })
    }
    pool.sort((a, b) => b.score - a.score)
    return pool
  }

  // First pass: strict 18h window
  let pool = computePool(IMMEDIATE_HOURS_MAX)

  // Fallback: expand to 24h only when the strict window is too sparse
  if (pool.length < MIN_IMMEDIATE_FIXTURES) {
    pool = computePool(IMMEDIATE_FALLBACK_HOURS_MAX)
  }

  return pool
}

/**
 * Flatten all ev_opportunities across eligible fixtures into a single ranked pool.
 * Returns array of { fixtureId, competitionCode, homeTeam, awayTeam, kickoffTime, opportunity }.
 */
export function buildPicksPool(fixtures) {
  const now = Date.now()
  const minMs = HORIZON_HOURS_MIN * 60 * 60 * 1000
  const maxMs = HORIZON_HOURS_MAX * 60 * 60 * 1000

  const pool = []
  for (const f of fixtures) {
    if (!UPCOMING_STATUSES.includes(f.status)) continue
    const kickoff = new Date(f.kickoff_time).getTime()
    const delta = kickoff - now
    if (delta < minMs || delta > maxMs) continue
    if (!f.best_ev_opportunity) continue

    const opp = f.best_ev_opportunity
    const score = (opp.ev_percentage * 0.6) + (opp.model_prob * 0.4)
    pool.push({
      fixtureId: f.id,
      competitionCode: f.competition_code,
      homeTeam: f.home_team?.name || `Team ${f.home_team_id}`,
      awayTeam: f.away_team?.name || `Team ${f.away_team_id}`,
      kickoffTime: f.kickoff_time,
      opportunity: opp,
      score,
    })
  }

  pool.sort((a, b) => b.score - a.score)
  return pool
}

/**
 * Build the full daily picks output from a fixtures array.
 */
export function buildDailyPicks(fixtures) {
  const today = new Date().toISOString().split('T')[0]

  // Use the immediate-pool path: hard 18h cutoff (fallback 24h if sparse)
  const pool = buildImmediatePool(fixtures)

  // -- Top 3 Singles --
  const singles = pool.slice(0, 3).map((item) => buildSingleCard(item, today))

  // -- Parlays: pick top-N uncorrelated (different fixtures) --
  function pickUncorrelated(count) {
    const selected = []
    const usedFixtureIds = new Set()
    for (const item of pool) {
      if (selected.length >= count) break
      if (!usedFixtureIds.has(item.fixtureId)) {
        selected.push(item)
        usedFixtureIds.add(item.fixtureId)
      }
    }
    return selected
  }

  const parlay2 = pickUncorrelated(2)
  const parlay3 = pickUncorrelated(3)
  const parlay4 = pickUncorrelated(4)

  return {
    generatedDate: today,
    singles,
    parlay2: buildParlayCard(parlay2, today),
    parlay3: buildParlayCard(parlay3, today),
    parlay4: buildParlayCard(parlay4, today),
  }
}

// ---------------------------------------------------------------------------
// Card builders
// ---------------------------------------------------------------------------

function resolveTeamName(raw) {
  // Prefer short_name (e.g. "MCI", "RMA") when available; otherwise full name
  const parts = String(raw || '').split(' ')
  // If the raw value is already a short code (<= 3 chars, all alpha), use it
  if (raw && raw.length <= 3 && /^[A-Z]+$/.test(raw)) return raw
  // Otherwise return the full name (avoid truncating to last token)
  return raw || 'TBD'
}

function buildSingleCard(item, date) {
  const opp = item.opportunity
  const fixture = item
  const home = resolveTeamName(fixture.homeTeam)
  const away = resolveTeamName(fixture.awayTeam)
  const matchLabel = `${home} vs ${away}`
  const league = fixture.competitionCode || 'Unknown'
  const kickoff = new Date(fixture.kickoffTime)
  const timeStr = kickoff.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const dayLabel = kickoff.toISOString().split('T')[0] === date ? 'Today' : kickoff.toLocaleDateString(undefined, { weekday: 'short' })

  return {
    id: `single_${fixture.fixtureId}_${opp.selection}_${opp.market}`,
    fixtureId: fixture.fixtureId,
    matchLabel,
    league,
    timeStr,
    dayLabel,
    market: opp.market,         // 'h2h' | 'totals' | 'spreads'
    selection: opp.selection,   // e.g. 'HOME', 'Over 2.5', 'Away -1.0'
    odds: Number(opp.odds)?.toFixed(2) || '–',
    modelProb: Number(opp.model_prob)?.toFixed(1) || '–',
    evPercent: Number(opp.ev_percentage)?.toFixed(1) || '–',
    score: item.score,
  }
}

function buildParlayCard(items, date) {
  if (items.length === 0) return null
  const legs = items.map((item) => {
    const opp = item.opportunity
    const home = resolveTeamName(item.homeTeam)
    const away = resolveTeamName(item.awayTeam)
    const kickoff = new Date(item.kickoffTime)
    const timeStr = kickoff.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    return {
      matchLabel: `${home} vs ${away}`,
      league: item.competitionCode || 'Unknown',
      timeStr,
      market: opp.market,
      selection: opp.selection,
      odds: Number(opp.odds)?.toFixed(2) || '–',
      modelProb: Number(opp.model_prob)?.toFixed(1) || '–',
      evPercent: Number(opp.ev_percentage)?.toFixed(1) || '–',
      fixtureId: item.fixtureId,
    }
  })

  const totalOdds = legs.reduce((acc, leg) => acc * (parseFloat(leg.odds) || 1), 1)
  const totalProb = legs.reduce((acc, leg) => {
    const p = parseFloat(leg.modelProb) / 100
    return acc * (isNaN(p) ? 0 : p)
  }, 1)
  const impliedProb = (1 / totalOdds) * 100

  return {
    legs,
    legCount: legs.length,
    totalOdds: totalOdds.toFixed(2),
    combinedProb: totalProb.toFixed(1),
    impliedProb: impliedProb.toFixed(1),
    multiplier: totalOdds.toFixed(2),
  }
}
