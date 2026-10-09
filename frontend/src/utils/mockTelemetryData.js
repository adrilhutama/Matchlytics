// ---- mockTelemetryData.js ----
// Institutional mock telemetry fallback for offline/development mode and testing.
// Ensures zero runtime disruption when Supabase is in placeholder mode.
// Zero em dash characters used (R-02 compliance).

import { computePoissonMatrix } from './analytics'

const COMPETITIONS = [
  { code: 'PL', label: 'Premier League', id: 2021 },
  { code: 'PD', label: 'La Liga', id: 2014 },
  { code: 'SA', label: 'Serie A', id: 2019 },
  { code: 'BL1', label: 'Bundesliga', id: 2002 },
  { code: 'FL1', label: 'Ligue 1', id: 2015 },
  { code: 'CL', label: 'Champions League', id: 2001 },
]

const TEAMS_BY_LEAGUE = {
  PL: [
    { name: 'Arsenal FC', short: 'Arsenal', att: 1.45, def: 0.82 },
    { name: 'Manchester City FC', short: 'Man City', att: 1.62, def: 0.78 },
    { name: 'Liverpool FC', short: 'Liverpool', att: 1.55, def: 0.85 },
    { name: 'Chelsea FC', short: 'Chelsea', att: 1.25, def: 1.05 },
    { name: 'Aston Villa FC', short: 'Aston Villa', att: 1.28, def: 1.10 },
    { name: 'Tottenham Hotspur FC', short: 'Tottenham', att: 1.30, def: 1.15 },
    { name: 'Newcastle United FC', short: 'Newcastle', att: 1.22, def: 1.08 },
    { name: 'Manchester United FC', short: 'Man United', att: 1.18, def: 1.18 },
  ],
  PD: [
    { name: 'Real Madrid CF', short: 'Real Madrid', att: 1.58, def: 0.80 },
    { name: 'FC Barcelona', short: 'Barcelona', att: 1.60, def: 0.84 },
    { name: 'Atletico de Madrid', short: 'Atlético', att: 1.25, def: 0.88 },
    { name: 'Real Sociedad', short: 'Sociedad', att: 1.12, def: 0.95 },
    { name: 'Athletic Club', short: 'Athletic', att: 1.18, def: 0.98 },
    { name: 'Villarreal CF', short: 'Villarreal', att: 1.24, def: 1.15 },
  ],
  SA: [
    { name: 'FC Internazionale Milano', short: 'Inter', att: 1.52, def: 0.76 },
    { name: 'Juventus FC', short: 'Juventus', att: 1.22, def: 0.75 },
    { name: 'AC Milan', short: 'Milan', att: 1.32, def: 1.02 },
    { name: 'SSC Napoli', short: 'Napoli', att: 1.35, def: 0.90 },
    { name: 'Atalanta BC', short: 'Atalanta', att: 1.48, def: 1.12 },
    { name: 'AS Roma', short: 'Roma', att: 1.20, def: 1.05 },
  ],
  BL1: [
    { name: 'FC Bayern München', short: 'Bayern', att: 1.70, def: 0.85 },
    { name: 'Bayer 04 Leverkusen', short: 'Leverkusen', att: 1.55, def: 0.88 },
    { name: 'Borussia Dortmund', short: 'Dortmund', att: 1.40, def: 1.15 },
    { name: 'RB Leipzig', short: 'Leipzig', att: 1.35, def: 1.05 },
    { name: 'Eintracht Frankfurt', short: 'Frankfurt', att: 1.28, def: 1.20 },
    { name: 'VfB Stuttgart', short: 'Stuttgart', att: 1.32, def: 1.12 },
  ],
  FL1: [
    { name: 'Paris Saint-Germain FC', short: 'PSG', att: 1.65, def: 0.82 },
    { name: 'AS Monaco FC', short: 'Monaco', att: 1.38, def: 1.10 },
    { name: 'Olympique de Marseille', short: 'Marseille', att: 1.30, def: 1.05 },
    { name: 'Lille OSC', short: 'Lille', att: 1.20, def: 0.92 },
  ],
  CL: [
    { name: 'Real Madrid CF', short: 'Real Madrid', att: 1.58, def: 0.80 },
    { name: 'Manchester City FC', short: 'Man City', att: 1.62, def: 0.78 },
    { name: 'FC Bayern München', short: 'Bayern', att: 1.70, def: 0.85 },
    { name: 'FC Internazionale Milano', short: 'Inter', att: 1.52, def: 0.76 },
    { name: 'Paris Saint-Germain FC', short: 'PSG', att: 1.65, def: 0.82 },
    { name: 'Arsenal FC', short: 'Arsenal', att: 1.45, def: 0.82 },
  ],
}

export function generateMockFixtures(count = 72) {
  const now = Date.now()
  const fixtures = []
  let idCounter = 1000

  const timeOffsets = [
    2 * 3600 * 1000,
    4.5 * 3600 * 1000,
    7 * 3600 * 1000,
    11 * 3600 * 1000,
    15 * 3600 * 1000,
    22 * 3600 * 1000,
    30 * 3600 * 1000,
    48 * 3600 * 1000,
    72 * 3600 * 1000,
    96 * 3600 * 1000,
    120 * 3600 * 1000,
    168 * 3600 * 1000,
  ]

  let currentOffsetIdx = 0

  for (const comp of COMPETITIONS) {
    const teams = TEAMS_BY_LEAGUE[comp.code] || []
    for (let i = 0; i < teams.length; i += 2) {
      if (fixtures.length >= count) break
      const home = teams[i]
      const away = teams[(i + 1) % teams.length]
      if (!home || !away) continue

      const kickoffTime = new Date(now + timeOffsets[currentOffsetIdx % timeOffsets.length] + (i * 900000)).toISOString()
      currentOffsetIdx++

      // Mathematical expected goals
      const lambdaHome = Math.min(3.2, Math.max(0.6, home.att * away.def * 1.10))
      const lambdaAway = Math.min(3.2, Math.max(0.6, away.att * home.def))

      const poisson = computePoissonMatrix(lambdaHome, lambdaAway)
      const matrix = poisson.matrix
      const pHome = Math.max(0.05, poisson.sumHomeWin / 100)
      const pDraw = Math.max(0.05, poisson.sumDraw / 100)
      const pAway = Math.max(0.05, poisson.sumAwayWin / 100)
      const pOver25 = Math.max(0.05, poisson.sumOver25 / 100)

      const fairH = Number((1 / pHome).toFixed(2))
      const fairD = Number((1 / pDraw).toFixed(2))
      const fairA = Number((1 / pAway).toFixed(2))

      // Simulate market odds
      const isHomeValue = (idCounter % 3 === 0)
      const isAwayValue = (idCounter % 5 === 0 && !isHomeValue)
      const isOverValue = (idCounter % 4 === 0)

      const mH = isHomeValue ? Number((fairH * 1.14).toFixed(2)) : Number((fairH * 0.94).toFixed(2))
      const mD = Number((fairD * 0.95).toFixed(2))
      const mA = isAwayValue ? Number((fairA * 1.18).toFixed(2)) : Number((fairA * 0.93).toFixed(2))

      let valuePick = null
      let evPct = null
      let bestEvOpp = null
      const evOpps = []

      if (isHomeValue) {
        valuePick = 'HOME'
        evPct = Number(((pHome * mH - 1) * 100).toFixed(1))
        bestEvOpp = {
          market: 'h2h',
          selection: 'HOME',
          fair_odds: fairH,
          market_odds: mH,
          ev_percentage: evPct,
          model_prob: Number(pHome.toFixed(3)),
          edge: Number((mH - fairH).toFixed(2)),
          kelly_stake: 0.024,
        }
        evOpps.push(bestEvOpp)
      } else if (isAwayValue) {
        valuePick = 'AWAY'
        evPct = Number(((pAway * mA - 1) * 100).toFixed(1))
        bestEvOpp = {
          market: 'h2h',
          selection: 'AWAY',
          fair_odds: fairA,
          market_odds: mA,
          ev_percentage: evPct,
          model_prob: Number(pAway.toFixed(3)),
          edge: Number((mA - fairA).toFixed(2)),
          kelly_stake: 0.021,
        }
        evOpps.push(bestEvOpp)
      }

      const marketOver = isOverValue ? Number(((1 / pOver25) * 1.12).toFixed(2)) : Number(((1 / pOver25) * 0.95).toFixed(2))
      const marketUnder = Number(((1 / (1 - pOver25)) * 0.95).toFixed(2))

      if (isOverValue && !bestEvOpp) {
        const oEv = Number(((pOver25 * marketOver - 1) * 100).toFixed(1))
        bestEvOpp = {
          market: 'totals',
          selection: 'OVER 2.5',
          fair_odds: Number((1 / pOver25).toFixed(2)),
          market_odds: marketOver,
          ev_percentage: oEv,
          model_prob: Number(pOver25.toFixed(3)),
          edge: Number((marketOver - (1 / pOver25)).toFixed(2)),
          kelly_stake: 0.020,
        }
        evOpps.push(bestEvOpp)
      }

      fixtures.push({
        id: idCounter,
        competition_code: comp.code,
        status: 'TIMED',
        kickoff_time: kickoffTime,
        venue: `${home.short} Stadium`,
        referee: 'Official Telemetry Lead',
        home_team_id: idCounter * 2,
        away_team_id: idCounter * 2 + 1,
        home_team: {
          id: idCounter * 2,
          name: home.name,
          short_name: home.short,
          crest_url: `https://crests.football-data.org/${comp.id}_${i}.png`,
          home_attack: home.att,
          home_defense: home.def,
          away_attack: home.att * 0.9,
          away_defense: home.def * 1.1,
        },
        away_team: {
          id: idCounter * 2 + 1,
          name: away.name,
          short_name: away.short,
          crest_url: `https://crests.football-data.org/${comp.id}_${i+1}.png`,
          home_attack: away.att,
          home_defense: away.def,
          away_attack: away.att * 0.9,
          away_defense: away.def * 1.1,
        },
        home_xg: Number(lambdaHome.toFixed(2)),
        away_xg: Number(lambdaAway.toFixed(2)),
        prob_home: Number((pHome * 100).toFixed(1)),
        prob_draw: Number((pDraw * 100).toFixed(1)),
        prob_away: Number((pAway * 100).toFixed(1)),
        fair_odds_home: fairH,
        fair_odds_draw: fairD,
        fair_odds_away: fairA,
        odds_home: mH,
        odds_draw: mD,
        odds_away: mA,
        value_pick: valuePick,
        ev_percentage: evPct,
        prob_over_25: Number((pOver25 * 100).toFixed(1)),
        prob_under_25: Number(((1 - pOver25) * 100).toFixed(1)),
        predicted_score: `${Math.round(lambdaHome)}-${Math.round(lambdaAway)}`,
        score_matrix: matrix,
        market_odds: {
          h2h: { home: mH, draw: mD, away: mA },
          totals: { '2.5': { over: marketOver, under: marketUnder } },
          spreads: { '-0.5': { home: mH, away: mA } },
        },
        ev_opportunities: evOpps,
        best_ev_opportunity: bestEvOpp,
      })

      idCounter++
    }
  }

  return fixtures
}

export function generateMockSettledFixtures(count = 30) {
  const now = Date.now()
  const settled = []
  const baseFixtures = generateMockFixtures(count)

  baseFixtures.forEach((f, idx) => {
    const pastTime = new Date(now - (idx + 1) * 24 * 3600 * 1000).toISOString()
    const homeScore = Math.floor(Math.random() * 3) + (f.prob_home > 50 ? 1 : 0)
    const awayScore = Math.floor(Math.random() * 2)

    settled.push({
      ...f,
      id: 9000 + idx,
      status: 'FT',
      kickoff_time: pastTime,
      home_score: homeScore,
      away_score: awayScore,
      full_time_score: `${homeScore}-${awayScore}`,
    })
  })

  return settled
}

export const MOCK_ADMIN_COMPETITIONS = [
  { code: 'PL', name: 'Premier League', emblem_url: '', updated_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(), status: 'active' },
  { code: 'PD', name: 'La Liga', emblem_url: '', updated_at: new Date(Date.now() - 50 * 60 * 1000).toISOString(), status: 'active' },
  { code: 'SA', name: 'Serie A', emblem_url: '', updated_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), status: 'active' },
  { code: 'BL1', name: 'Bundesliga', emblem_url: '', updated_at: new Date(Date.now() - 65 * 60 * 1000).toISOString(), status: 'active' },
  { code: 'FL1', name: 'Ligue 1', emblem_url: '', updated_at: new Date(Date.now() - 70 * 60 * 1000).toISOString(), status: 'active' },
  { code: 'CL', name: 'Champions League', emblem_url: '', updated_at: new Date(Date.now() - 80 * 60 * 1000).toISOString(), status: 'active' },
  { code: 'DED', name: 'Eredivisie', emblem_url: '', updated_at: new Date(Date.now() - 110 * 60 * 1000).toISOString(), status: 'idle' },
  { code: 'PPL', name: 'Liga Portugal', emblem_url: '', updated_at: new Date(Date.now() - 120 * 60 * 1000).toISOString(), status: 'idle' },
  { code: 'ELC', name: 'Championship', emblem_url: '', updated_at: new Date(Date.now() - 130 * 60 * 1000).toISOString(), status: 'idle' },
  { code: 'BSA', name: 'Brasileirao', emblem_url: '', updated_at: new Date(Date.now() - 180 * 60 * 1000).toISOString(), status: 'idle' },
]

export const MOCK_ADMIN_USERS = [
  { id: 'usr-1', email: 'admin@imortifex.me', full_name: 'Principal Quant', subscription_tier: 'institutional', subscription_status: 'active', is_admin: true, current_period_end: '2028-12-31T23:59:59Z', created_at: '2026-01-01T00:00:00Z' },
  { id: 'usr-2', email: 'marcus.vance@hedgefund.ch', full_name: 'Marcus Vance', subscription_tier: 'institutional', subscription_status: 'active', is_admin: false, current_period_end: '2027-06-30T00:00:00Z', created_at: '2026-03-15T12:00:00Z' },
  { id: 'usr-3', email: 'elena.rostova@alphaquant.uk', full_name: 'Elena Rostova', subscription_tier: 'annual', subscription_status: 'active', is_admin: false, current_period_end: '2027-02-14T00:00:00Z', created_at: '2026-04-10T14:30:00Z' },
  { id: 'usr-4', email: 'david.chen@syndicate.sg', full_name: 'David Chen', subscription_tier: 'pro', subscription_status: 'active', is_admin: false, current_period_end: '2026-11-20T00:00:00Z', created_at: '2026-05-01T09:15:00Z' },
  { id: 'usr-5', email: 'sarah.connor@trader.com', full_name: 'Sarah Connor', subscription_tier: 'free', subscription_status: 'inactive', is_admin: false, current_period_end: null, created_at: '2026-07-22T18:45:00Z' },
]

export const MOCK_ADMIN_AUDIT = [
  { id: 'aud-1', action: 'SUBSCRIPTION_UPGRADE', actor_email: 'admin@imortifex.me', target_user: 'marcus.vance@hedgefund.ch', details: 'Upgraded to Institutional pass (2-year enterprise)', created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString() },
  { id: 'aud-2', action: 'INGESTION_SYNC', actor_email: 'system@cron', target_user: 'PIPELINE_ENGINE', details: 'Full daily odds ingestion completed: 72 fixtures parsed, 18 +EV edges detected', created_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString() },
  { id: 'aud-3', action: 'TELEGRAM_SITREP_DISPATCH', actor_email: 'system@cron', target_user: '@MatchlyticsSitrep', details: 'Institutional morning briefing broadcast: 4 value picks dispatched', created_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString() },
  { id: 'aud-4', action: 'SETTLEMENT_CYCLE', actor_email: 'system@cron', target_user: 'SETTLEMENT_LEDGER', details: 'Settled 14 weekend fixtures. Brier accuracy score: 0.182 (verified)', created_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString() },
]
