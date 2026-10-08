// ---- dailyPicksEngine.js ----
// Pure utility that scans today's available fixtures and produces curated
// betting slips: singles, 2-leg parlay, 3-leg multiplier, 4-leg mega parlay.
// Zero em dash characters (R-02 compliance).

const UPCOMING_STATUSES = ['NS', 'SCHEDULED', 'TIMED']
const HORIZON_HOURS_MIN = 24
const HORIZON_HOURS_MAX = 36

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
    // score = 0.6 * ev_pct + 0.4 * model_prob (both are already percentages)
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
  const pool = buildPicksPool(fixtures)
  const today = new Date().toISOString().split('T')[0]

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

function buildSingleCard(item, date) {
  const opp = item.opportunity
  const fixture = item
  const home = fixture.homeTeam.split(' ').pop()
  const away = fixture.awayTeam.split(' ').pop()
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
    const home = item.homeTeam.split(' ').pop()
    const away = item.awayTeam.split(' ').pop()
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
