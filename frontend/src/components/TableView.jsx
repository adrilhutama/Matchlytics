// ---- TableView.jsx ----
// Institutional Table-First Presentation for Matchlytics Terminal Scanner:
// - Columns: TIME | LEAGUE | FIXTURE | PREDICTED | 1X2 FAIR vs CONSENSUS | O/U 2.5 | +EV SIGNAL | ACTIONS
// - High-contrast monospace for data numbers (font-mono tracking-tight tabular-nums)
// - Clicking anywhere on a table row toggles its expanded drawer state
// - In-Table Expandable Drawer: Multi-market grid (1X2, Totals, Asian Handicap),
//   quick +Slip parlay toggles, and "Open Full Quant Lab & Simulation ↗" deep-route CTA
// - Responsive horizontal auto-scroll container with touch manipulation
// - Zero em dash characters used (R-02 compliance)

import { useState, useMemo } from 'react'
import {
  formatLocalizedMatchDate,
  isRealMarketOdds,
  calculateZeroVigOdds,
  calculatePoissonMatrix,
  calculateTotalsFromMatrix,
  calculateSpreadsFromMatrix,
  calculateMarketEV,
  getKellyFraction,
  getMarginOfSafety,
  calculateEdgeAndEV,
} from '../utils/analytics'
import OddsComparison from './OddsComparison'
import { TotalsMarketView, SpreadsMarketView } from './MultiMarketViews'
import ValueBadge from './ValueBadge'
import FormGuide from './FormGuide'

export function TableRow({
  fixture,
  isExpanded,
  onToggleExpand,
  isPinned,
  onToggleWatchlist,
  onSelectForLab,
  onOpenMatrix,
  onOpenQuantModal,
  onLogPosition,
  slipLegs = [],
  onToggleSlip,
  standingsMap = {},
  quantLocked = false,
  onTriggerUpgrade,
}) {
  const [activeMarketTab, setActiveMarketTab] = useState('h2h')

  if (!fixture) return null

  const {
    id,
    league_name,
    league_logo,
    prob_home,
    prob_draw,
    prob_away,
    predicted_score,
    prob_over_25,
    value_pick,
    ev_percentage,
    market_odds,
    ev_opportunities,
  } = fixture

  const h2hOdds = fixture?.market_odds?.h2h || {}
  const rawOddsHome = typeof h2hOdds.home === 'number' ? h2hOdds.home : (h2hOdds.home?.price || h2hOdds.consensus?.home)
  const rawOddsDraw = typeof h2hOdds.draw === 'number' ? h2hOdds.draw : (h2hOdds.draw?.price || h2hOdds.consensus?.draw)
  const rawOddsAway = typeof h2hOdds.away === 'number' ? h2hOdds.away : (h2hOdds.away?.price || h2hOdds.consensus?.away)

  const oddsHome = rawOddsHome || fixture?.odds_home || fixture?.fair_odds_home || null
  const oddsDraw = rawOddsDraw || fixture?.odds_draw || fixture?.fair_odds_draw || null
  const oddsAway = rawOddsAway || fixture?.odds_away || fixture?.fair_odds_away || null

  const odds_home = oddsHome
  const odds_draw = oddsDraw
  const odds_away = oddsAway

  const home_team_name = fixture?.home_team?.name || fixture?.home_team_name || 'Home'
  const away_team_name = fixture?.away_team?.name || fixture?.away_team_name || 'Away'
  const home_team_logo = fixture?.home_team?.crest_url || fixture?.home_team_logo
  const away_team_logo = fixture?.away_team?.crest_url || fixture?.away_team_logo
  const match_date = fixture?.kickoff_time || fixture?.match_date
  const lambda_home = fixture?.home_xg != null ? fixture.home_xg : fixture?.lambda_home
  const lambda_away = fixture?.away_xg != null ? fixture.away_xg : fixture?.lambda_away

  const homeLogo = home_team_logo
  const awayLogo = away_team_logo
  const homeName = home_team_name
  const awayName = away_team_name

  const hasRealOdds = isRealMarketOdds(fixture)
  const { relativeBadge, timeStr } = formatLocalizedMatchDate(match_date)

  const homeStandings =
    standingsMap[fixture?.home_team_id] ||
    standingsMap[`${fixture?.league_id}_${fixture?.home_team_id}`] ||
    null
  const awayStandings =
    standingsMap[fixture?.away_team_id] ||
    standingsMap[`${fixture?.league_id}_${fixture?.away_team_id}`] ||
    null

  // Zero-vig calculation
  const zeroVig = useMemo(() => {
    return calculateZeroVigOdds(odds_home, odds_draw, odds_away)
  }, [odds_home, odds_draw, odds_away])

  // Multi-market probabilities from 6x6 Poisson matrix
  const matrix = useMemo(() => {
    if (lambda_home != null && lambda_away != null) {
      return calculatePoissonMatrix(Number(lambda_home), Number(lambda_away))
    }
    return null
  }, [lambda_home, lambda_away])

  const totalsProbs = useMemo(() => {
    if (matrix) return calculateTotalsFromMatrix(matrix)
    return {}
  }, [matrix])

  const spreadsProbs = useMemo(() => {
    if (matrix) return calculateSpreadsFromMatrix(matrix)
    return {}
  }, [matrix])

  // Identify multi-market edges
  const totalsEdge = useMemo(() => {
    if (Array.isArray(ev_opportunities)) {
      const opp = ev_opportunities.find((o) => o.market === 'totals' && o.ev_pct >= 2.0)
      if (opp) {
        const outcome = opp.outcome || (opp.pick?.includes('OVER') ? 'Over' : 'Under')
        return {
          label: `${outcome} ${opp.line ?? '2.5'}`,
          ev: Number(opp.ev_pct).toFixed(1),
        }
      }
    }
    if (market_odds?.totals && totalsProbs) {
      for (const line of ['1.5', '2.5', '3.5']) {
        const bOver = market_odds.totals[line]?.over
        const pOver = totalsProbs[line]?.over ?? (line === '2.5' ? Number(prob_over_25) : null)
        if (bOver && pOver) {
          const ev = calculateMarketEV(pOver, bOver)
          if (ev && ev >= 2.0) return { label: `Over ${line}`, ev }
        }
        const bUnder = market_odds.totals[line]?.under
        const pUnder = totalsProbs[line]?.under ?? (line === '2.5' ? Math.max(0, 100 - Number(prob_over_25)) : null)
        if (bUnder && pUnder) {
          const ev = calculateMarketEV(pUnder, bUnder)
          if (ev && ev >= 2.0) return { label: `Under ${line}`, ev }
        }
      }
    }
    return null
  }, [ev_opportunities, market_odds, totalsProbs, prob_over_25])

  const spreadsEdge = useMemo(() => {
    if (Array.isArray(ev_opportunities)) {
      const opp = ev_opportunities.find((o) => o.market === 'spreads' && o.ev_pct >= 2.0)
      if (opp) {
        const outcome = opp.outcome || (opp.pick?.includes('HOME') ? home_team_name : away_team_name)
        const lineStr = opp.line != null ? (Number(opp.line) > 0 ? `+${opp.line}` : `${opp.line}`) : ''
        return {
          label: `${outcome} ${lineStr}`.trim(),
          ev: Number(opp.ev_pct).toFixed(1),
        }
      }
    }
    if (market_odds?.spreads && spreadsProbs) {
      for (const line of ['-0.5', '0.0', '+0.5', '-1.0', '+1.0']) {
        const bHome = market_odds.spreads[line]?.home
        const pHome = spreadsProbs[line]?.home
        if (bHome && pHome) {
          const ev = calculateMarketEV(pHome, bHome)
          if (ev && ev >= 2.0) return { label: `${home_team_name} ${line}`, ev }
        }
        const bAway = market_odds.spreads[line]?.away
        const pAway = spreadsProbs[line]?.away
        if (bAway && pAway) {
          const ev = calculateMarketEV(pAway, bAway)
          if (ev && ev >= 2.0) return { label: `${away_team_name} ${line}`, ev }
        }
      }
    }
    return null
  }, [ev_opportunities, market_odds, spreadsProbs, home_team_name, away_team_name])

  // Value pick parameters
  let valOdds = null
  let valProb = null
  let valLabel = ''
  if (value_pick === 'HOME') {
    valOdds = odds_home
    valProb = prob_home
    valLabel = `${home_team_name} Win`
  } else if (value_pick === 'DRAW') {
    valOdds = odds_draw
    valProb = prob_draw
    valLabel = 'Draw (X)'
  } else if (value_pick === 'AWAY') {
    valOdds = odds_away
    valProb = prob_away
    valLabel = `${away_team_name} Win`
  }

  const { marginSafety, recKellyPct } = useMemo(() => {
    if (!value_pick || !valOdds || !valProb) return { marginSafety: null, recKellyPct: null }
    const { netEdge } = calculateEdgeAndEV(valOdds, valProb)
    const rawKelly = getKellyFraction(valOdds, valProb)
    const quarterKelly = Math.max(0, Math.min(2.5, Number((rawKelly * 0.25).toFixed(1))))
    return {
      marginSafety: getMarginOfSafety(netEdge),
      recKellyPct: quarterKelly,
    }
  }, [value_pick, valOdds, valProb])

  const isValuePickInSlip = value_pick ? slipLegs.some((l) => l.fixtureId === id && l.pick === value_pick) : false
  const isFixtureInSlip = slipLegs.some((l) => l.fixtureId === id)

  const fixtureSlipPicks = useMemo(() => {
    return slipLegs.filter((l) => l.fixtureId === id).map((l) => l.pick)
  }, [slipLegs, id])

  return (
    <>
      {/* Primary Clickable Master Row */}
      <tr
        onClick={onToggleExpand}
        className={`group border-b border-pitch-800/80 cursor-pointer select-none transition-all duration-150 ${
          isExpanded
            ? 'bg-pitch-900/90 border-amber-500/40'
            : value_pick
            ? 'bg-amber-500/[0.03] hover:bg-pitch-800/70'
            : 'bg-pitch-950/40 hover:bg-pitch-800/50'
        }`}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggleExpand()
          }
        }}
      >
        {/* 1. TIME: Kickoff + Pin */}
        <td className="py-3 px-3 whitespace-nowrap align-middle">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggleWatchlist(id)
              }}
              aria-label={isPinned ? `Unpin ${home_team_name} vs ${away_team_name}` : `Pin ${home_team_name} vs ${away_team_name}`}
              className="p-1 min-w-[32px] min-h-[32px] flex items-center justify-center rounded text-slate-500 hover:text-amber-400 active:scale-90 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 touch-manipulation"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill={isPinned ? '#f59e0b' : 'none'}
                stroke={isPinned ? '#f59e0b' : 'currentColor'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
            <div>
              <span className="font-semibold text-slate-200 block text-xs font-mono tracking-tight leading-none">
                {relativeBadge}
              </span>
              <span className="text-[11px] text-slate-400 font-mono tabular-nums tracking-tight mt-1 block">
                {timeStr}
              </span>
            </div>
          </div>
        </td>

        {/* 2. LEAGUE */}
        <td className="py-3 px-3 whitespace-nowrap align-middle">
          <LeagueBadge name={league_name} code={fixture?.competition_code || ''} logoUrl={league_logo} />
        </td>

        {/* 3. FIXTURE (Home vs Away + Expand Chevron) */}
        <td className="py-3 px-3 align-middle min-w-[220px]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1 min-w-0">
              {/* Home */}
              <div className="flex items-center gap-2 min-w-0">
                {homeLogo && (
                  <img
                    src={homeLogo}
                    alt=""
                    width={16}
                    height={16}
                    className="w-4 h-4 object-contain flex-shrink-0"
                    loading="lazy"
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                )}
                <span
                  className={`text-xs font-semibold truncate ${
                    value_pick === 'HOME' ? 'text-amber-300 font-bold' : 'text-slate-100'
                  }`}
                >
                  {home_team_name}
                </span>
                {homeStandings?.form && <FormGuide form={homeStandings.form} size="sm" />}
              </div>

              {/* Away */}
              <div className="flex items-center gap-2 min-w-0">
                {awayLogo && (
                  <img
                    src={awayLogo}
                    alt=""
                    width={16}
                    height={16}
                    className="w-4 h-4 object-contain flex-shrink-0"
                    loading="lazy"
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                )}
                <span
                  className={`text-xs font-semibold truncate ${
                    value_pick === 'AWAY' ? 'text-amber-300 font-bold' : 'text-slate-300'
                  }`}
                >
                  {away_team_name}
                </span>
                {awayStandings?.form && <FormGuide form={awayStandings.form} size="sm" />}
              </div>
            </div>

            {/* Expand Indicator Chevron */}
            <span
              className={`text-slate-500 group-hover:text-amber-400 transition-transform duration-200 text-xs px-1 flex-shrink-0 ${
                isExpanded ? 'rotate-180 text-amber-400' : ''
              }`}
              aria-hidden="true"
            >
              ▼
            </span>
          </div>
        </td>

        {/* 4. PREDICTED (Score & Expected Goals xG) */}
        <td className="py-3 px-3 text-center whitespace-nowrap align-middle">
          {predicted_score ? (
            <div className="inline-flex flex-col items-center">
              <span className="text-sm font-bold font-mono tracking-tight tabular-nums text-slate-100 bg-pitch-900/90 px-2 py-0.5 rounded border border-pitch-800">
                {predicted_score}
              </span>
              {(lambda_home != null || lambda_away != null) && (
                <span className="text-[10px] text-slate-400 font-mono tabular-nums tracking-tight mt-0.5">
                  xG: <span className="text-sky-400 font-semibold">{lambda_home ?? '?'}</span>
                  {' v '}
                  <span className="text-rose-400 font-semibold">{lambda_away ?? '?'}</span>
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-600 font-mono">-</span>
          )}
        </td>

        {/* 5. 1X2 FAIR vs CONSENSUS (High-Contrast Monospace) */}
        <td className="py-3 px-3 text-center whitespace-nowrap align-middle">
          <div className="inline-flex items-center gap-1.5 font-mono text-[11px] tabular-nums tracking-tight">
            {/* Home */}
            <div
              className={`px-1.5 py-1 rounded border text-center min-w-[50px] ${
                value_pick === 'HOME'
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 font-bold'
                  : 'bg-pitch-900/80 border-pitch-800 text-slate-300'
              }`}
            >
              <div className="text-[9px] text-slate-500 leading-none">1 ({prob_home != null ? Math.round(prob_home) : '-'}%)</div>
              <div className="text-xs font-semibold mt-0.5">{oddsHome ? Number(oddsHome).toFixed(2) : '-'}</div>
            </div>

            {/* Draw */}
            <div
              className={`px-1.5 py-1 rounded border text-center min-w-[50px] ${
                value_pick === 'DRAW'
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 font-bold'
                  : 'bg-pitch-900/80 border-pitch-800 text-slate-300'
              }`}
            >
              <div className="text-[9px] text-slate-500 leading-none">X ({prob_draw != null ? Math.round(prob_draw) : '-'}%)</div>
              <div className="text-xs font-semibold mt-0.5">{oddsDraw ? Number(oddsDraw).toFixed(2) : '-'}</div>
            </div>

            {/* Away */}
            <div
              className={`px-1.5 py-1 rounded border text-center min-w-[50px] ${
                value_pick === 'AWAY'
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 font-bold'
                  : 'bg-pitch-900/80 border-pitch-800 text-slate-300'
              }`}
            >
              <div className="text-[9px] text-slate-500 leading-none">2 ({prob_away != null ? Math.round(prob_away) : '-'}%)</div>
              <div className="text-xs font-semibold mt-0.5">{oddsAway ? Number(oddsAway).toFixed(2) : '-'}</div>
            </div>
          </div>
          {hasRealOdds && (
            <div className="text-[9px] font-mono text-emerald-400/90 text-center mt-0.5">
              Consensus Sharp
            </div>
          )}
        </td>

        {/* 6. O/U 2.5 GOALS */}
        <td className="py-3 px-3 text-center whitespace-nowrap align-middle">
          {prob_over_25 != null ? (
            <div className="inline-flex flex-col items-center">
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold tabular-nums tracking-tight ${
                  prob_over_25 >= 55
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : prob_over_25 <= 45
                    ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                    : 'bg-pitch-900 text-slate-400 border border-pitch-800'
                }`}
              >
                {prob_over_25 >= 50 ? `O ${prob_over_25.toFixed(0)}%` : `U ${(100 - prob_over_25).toFixed(0)}%`}
              </span>
              {totalsEdge && (
                <span className="text-[9px] text-amber-400 font-mono mt-0.5 font-bold">
                  ★ {totalsEdge.label}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-600 font-mono">-</span>
          )}
        </td>

        {/* 7. +EV SIGNAL */}
        <td className="py-3 px-3 text-center whitespace-nowrap align-middle">
          {quantLocked ? (
            value_pick && ev_percentage ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (onTriggerUpgrade) onTriggerUpgrade('Unlock +EV feeds with a Pro pass')
                }}
                className="min-h-[32px] px-2 py-1 rounded-lg bg-pitch-950/70 border border-amber-500/30 text-[10px] font-mono font-bold text-amber-400 hover:border-amber-400/60 transition-colors"
              >
                🔒 Pro Edge
              </button>
            ) : (
              <span className="text-slate-600 font-mono">-</span>
            )
          ) : value_pick && ev_percentage ? (
            <div className="inline-flex flex-col items-center gap-0.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                <span>★</span>
                <span>{value_pick} (+{Number(ev_percentage).toFixed(1)}%)</span>
              </span>
              {recKellyPct != null && (
                <span className="text-[9px] font-mono text-amber-400/80">
                  Kelly: {recKellyPct}%
                </span>
              )}
            </div>
          ) : totalsEdge ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              ★ {totalsEdge.label} (+{totalsEdge.ev}%)
            </span>
          ) : spreadsEdge ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
              ★ {spreadsEdge.label} (+{spreadsEdge.ev}%)
            </span>
          ) : (
            <span className="text-slate-600 font-mono">-</span>
          )}
        </td>

        {/* 8. ACTIONS: Quick +Slip, Lab ↗ & Toggle */}
        <td className="py-3 px-3 text-center whitespace-nowrap align-middle">
          <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {/* + Slip quick toggle */}
            {!quantLocked && onToggleSlip && (valOdds || odds_home) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  const pickToUse = value_pick || 'HOME'
                  const oddsToUse = valOdds || odds_home
                  const probToUse = valProb || prob_home
                  const labelToUse = valLabel || `${home_team_name} Win`
                  onToggleSlip({
                    fixtureId: id,
                    homeTeam: home_team_name,
                    awayTeam: away_team_name,
                    pick: pickToUse,
                    pickLabel: labelToUse,
                    odds: oddsToUse,
                    modelProb: probToUse,
                    ev: ev_percentage || 0,
                    leagueName: league_name,
                    matchDate: match_date,
                  })
                }}
                className={`min-h-[38px] px-2.5 py-1.5 text-xs font-mono font-bold rounded-xl transition-all active:scale-95 touch-manipulation border ${
                  isValuePickInSlip
                    ? 'bg-amber-500 text-pitch-950 border-amber-400 font-extrabold shadow'
                    : isFixtureInSlip
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-pitch-900 hover:bg-pitch-800 text-slate-300 hover:text-amber-400 border-pitch-700'
                }`}
                title={isValuePickInSlip ? 'Remove from slip' : 'Add to parlay slip'}
              >
                {isValuePickInSlip ? '✓ Slip' : '+ Slip'}
              </button>
            )}

            {/* Deep Route to Quant Lab */}
            {onSelectForLab && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (quantLocked) {
                    if (onTriggerUpgrade) onTriggerUpgrade('Quant Lab requires a Pro pass')
                  } else {
                    onSelectForLab(fixture)
                  }
                }}
                className="min-h-[38px] px-2.5 py-1.5 text-xs font-mono font-semibold rounded-xl bg-pitch-900 hover:bg-pitch-800 text-amber-300 border border-pitch-700 hover:border-amber-500/40 transition-all active:scale-95 touch-manipulation flex items-center gap-1"
                title="Open match in dedicated Quant Lab workspace"
              >
                <span>⚅</span>
                <span>Lab ↗</span>
              </button>
            )}

            {/* Expand / Collapse Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggleExpand()
              }}
              className={`min-h-[38px] px-2 py-1.5 text-xs font-mono rounded-xl border transition-colors ${
                isExpanded
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-pitch-900 text-slate-400 border-pitch-800 hover:text-slate-200'
              }`}
              title={isExpanded ? 'Collapse row drawer' : 'Expand full multi-market drawer'}
            >
              {isExpanded ? '▲' : '▼'}
            </button>
          </div>
        </td>
      </tr>

      {/* In-Table Expandable Drawer / Full-Width Sub-Row */}
      {isExpanded && (
        <tr className="bg-pitch-950/95 border-b border-pitch-700/80 animate-fade-in">
          <td colSpan={8} className="p-3 sm:p-5">
            <div className="space-y-4 max-w-5xl mx-auto">
              {/* Drawer Header: Title & Market Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-pitch-800">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold font-mono">
                    ⚅
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-100 flex flex-wrap items-center gap-2">
                      <span>{home_team_name} vs {away_team_name}</span>
                      <span className="text-[10px] font-normal font-mono px-2 py-0.5 rounded bg-pitch-900 border border-pitch-800 text-amber-300">
                        {league_name}
                      </span>
                      <span className="text-[10px] font-normal font-mono px-2 py-0.5 rounded bg-pitch-900 border border-pitch-800 text-slate-300">
                        STADION: {fixture.venue || 'TBD'}
                      </span>
                      <span className="text-[10px] font-normal font-mono px-2 py-0.5 rounded bg-pitch-900 border border-pitch-800 text-slate-300">
                        WASIT: {fixture.referee?.name ? `${fixture.referee.name} (${fixture.referee.nationality || 'FIFA'})` : 'TBD'}
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Full multi-market odds matrix, model probabilities, and direct simulator link
                    </p>
                  </div>
                </div>

                {/* Multi-Market Secondary Tabs Selector */}
                <div className="flex items-center gap-1 p-1 bg-pitch-900 rounded-xl border border-pitch-800">
                  <button
                    type="button"
                    onClick={() => setActiveMarketTab('h2h')}
                    className={`min-h-[36px] py-1 px-3 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 touch-manipulation ${
                      activeMarketTab === 'h2h'
                        ? 'bg-pitch-800 text-amber-300 font-bold shadow-sm border border-pitch-700'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>1X2 Moneyline</span>
                    {value_pick && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMarketTab('totals')}
                    className={`min-h-[36px] py-1 px-3 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 touch-manipulation ${
                      activeMarketTab === 'totals'
                        ? 'bg-pitch-800 text-amber-300 font-bold shadow-sm border border-pitch-700'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>Totals (1.5, 2.5, 3.5)</span>
                    {totalsEdge && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMarketTab('spreads')}
                    className={`min-h-[36px] py-1 px-3 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 touch-manipulation ${
                      activeMarketTab === 'spreads'
                        ? 'bg-pitch-800 text-amber-300 font-bold shadow-sm border border-pitch-700'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>Asian Handicap</span>
                    {spreadsEdge && <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />}
                  </button>
                </div>
              </div>

              {/* Sub-Panel 1: 1X2 Moneyline */}
              {activeMarketTab === 'h2h' && (
                <div className="space-y-3">
                  {(odds_home || odds_draw || odds_away) && (
                    <OddsComparison
                      oddsHome={odds_home}
                      oddsDraw={odds_draw}
                      oddsAway={odds_away}
                      probHome={prob_home}
                      probDraw={prob_draw}
                      probAway={prob_away}
                      valuePick={value_pick}
                      slipPicks={fixtureSlipPicks}
                      onToggleSlipPick={onToggleSlip ? (pick, odds, prob, label) => {
                        onToggleSlip({
                          fixtureId: id,
                          homeTeam: home_team_name,
                          awayTeam: away_team_name,
                          pick,
                          pickLabel: label,
                          odds,
                          modelProb: prob,
                          ev: ((Number(prob) / 100) * Number(odds) - 1) * 100,
                          leagueName: league_name,
                          matchDate: match_date,
                        })
                      } : null}
                      onOpenQuant={onOpenQuantModal ? () => onOpenQuantModal(fixture) : null}
                    />
                  )}

                  {/* Value Bet Detailed Strip */}
                  {value_pick && (
                    <div className="p-3 rounded-xl bg-pitch-900 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <ValueBadge
                          pick={value_pick}
                          evPct={ev_percentage}
                          odds={valOdds}
                          modelProb={valProb}
                          onClick={onOpenQuantModal ? () => onOpenQuantModal(fixture) : null}
                        />
                        {marginSafety && (
                          <span className={`px-2 py-0.5 rounded text-[11px] font-mono border ${marginSafety.colorClass}`}>
                            {marginSafety.label}
                          </span>
                        )}
                      </div>

                      {onToggleSlip && valOdds && (
                        <button
                          type="button"
                          onClick={() => onToggleSlip({
                            fixtureId: id,
                            homeTeam: home_team_name,
                            awayTeam: away_team_name,
                            pick: value_pick,
                            pickLabel: valLabel,
                            odds: valOdds,
                            modelProb: valProb,
                            ev: ev_percentage,
                            leagueName: league_name,
                            matchDate: match_date,
                          })}
                          className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                            isValuePickInSlip
                              ? 'bg-amber-500 text-pitch-950 font-extrabold shadow'
                              : 'bg-pitch-800 hover:bg-pitch-700 text-slate-200 hover:text-amber-400 border border-pitch-700'
                          }`}
                        >
                          <span>{isValuePickInSlip ? '✓ In Slip' : '+ Slip Value Pick'}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-Panel 2: Totals (1.5, 2.5, 3.5) */}
              {activeMarketTab === 'totals' && (
                <TotalsMarketView
                  totalsProbs={totalsProbs}
                  marketTotals={market_odds?.totals || {}}
                  fallbackOver25={prob_over_25}
                  slipPicks={fixtureSlipPicks}
                  onToggleSlip={onToggleSlip}
                  homeTeam={home_team_name}
                  awayTeam={away_team_name}
                  fixtureId={id}
                  leagueName={league_name}
                  matchDate={match_date}
                />
              )}

              {/* Sub-Panel 3: Asian Handicap */}
              {activeMarketTab === 'spreads' && (
                <SpreadsMarketView
                  spreadsProbs={spreadsProbs}
                  marketSpreads={market_odds?.spreads || {}}
                  slipPicks={fixtureSlipPicks}
                  onToggleSlip={onToggleSlip}
                  homeTeam={home_team_name}
                  awayTeam={away_team_name}
                  fixtureId={id}
                  leagueName={league_name}
                  matchDate={match_date}
                />
              )}

              {/* Drawer Bottom Action Bar: Prominent CTA to Dedicated Quant Lab */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-pitch-800">
                <div className="flex flex-wrap items-center gap-2">
                  {onLogPosition && (
                    <button
                      type="button"
                      onClick={() => onLogPosition({
                        fixtureId: id,
                        fixtureName: `${home_team_name} vs ${away_team_name}`,
                        leagueName: league_name || 'League',
                        matchDate: match_date,
                        selection: value_pick || 'HOME',
                        selectionLabel: valLabel || `${home_team_name} Win`,
                        odds: valOdds || odds_home || 2.0,
                        stakePercent: recKellyPct || 1.5,
                        stakeAmount: Math.round(10000000 * ((recKellyPct || 1.5) / 100)),
                        modelProb: valProb || prob_home || 50,
                        evPercentage: ev_percentage || 0,
                      })}
                      className="min-h-[44px] py-2 px-3 rounded-xl bg-pitch-900 hover:bg-pitch-800 border border-pitch-700 text-slate-200 text-xs font-mono flex items-center gap-1.5 transition-colors active:scale-95 touch-manipulation"
                      title="Log position into Portfolio Tracker"
                    >
                      <span>⊞</span>
                      <span>Log Position</span>
                    </button>
                  )}


                </div>

                {/* Primary Action CTA Button: Routes to dedicated match analysis view */}
                {onSelectForLab && (
                  <button
                    type="button"
                    onClick={() => {
                      if (quantLocked && onTriggerUpgrade) {
                        onTriggerUpgrade('Quant Lab requires a Pro pass')
                      } else {
                        onSelectForLab(fixture)
                      }
                    }}
                    className="min-h-[44px] py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-pitch-950 font-bold font-mono text-xs flex items-center justify-center gap-2 shadow-lg hover:shadow-amber-500/20 active:scale-98 transition-all touch-manipulation"
                  >
                    <span>Open Full Quant Lab & Simulation ↗</span>
                  </button>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function TableView({
  fixtures = [],
  watchlist = [],
  onToggleWatchlist,
  onOpenMatrix,
  onOpenQuantModal,
  onSelectForLab,
  onLogPosition,
  slipLegs = [],
  onToggleSlip,
  standingsMap = {},
  quantLocked = false,
  onTriggerUpgrade,
}) {
  const [expandedIds, setExpandedIds] = useState(new Set())

  const validFixtures = (fixtures || []).filter(Boolean)

  const toggleRow = (id) => {
    if (!id) return
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // League accent border color map for core leagues (matches football-data.org crest palettes)
  const LEAGUE_ACCENT_COLOR = {
    PL:  '#38003c',
    PD:  '#ee8707',
    SA:  '#008fd7',
    BL1: '#dc052d',
    FL1: '#008491',
    CL:  '#061d3e',
    DED: '#ff8200',
    PPL: '#0066b3',
    ELC: '#000d4a',
    BSA: '#009739',
    WC:  '#ff6600',
    EC:  '#003399',
  }

  const LeagueBadge = ({ name, code, logoUrl }) => {
    const color = code ? (LEAGUE_ACCENT_COLOR[code] || '#334155') : '#334155'
    return (
      <div className="flex items-center gap-1.5 min-w-[110px] max-w-[160px]" title={name || code || ''}>
        {logoUrl && (
          <img
            src={logoUrl}
            alt=""
            width={14}
            height={14}
            className="w-3.5 h-3.5 object-contain flex-shrink-0"
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        )}
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold border truncate"
          style={{ backgroundColor: `${color}22`, color: color, borderColor: `${color}66` }}
        >
          {code || name || 'N/A'}
        </span>
      </div>
    )
  }

  return (
    <div className="w-full rounded-2xl border border-pitch-800 bg-pitch-950/60 overflow-hidden shadow-2xl">
      {/* Mobile Swipe Hint Banner */}
      <div className="md:hidden flex items-center justify-between px-3 py-2 text-[11px] font-mono text-slate-400 bg-pitch-950 border-b border-pitch-800">
        <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
          <span>&larr;&rarr;</span>
          <span>Swipe horizontally or tap any row to expand deep analysis</span>
        </span>
      </div>

      {/* Fluid container with horizontal auto-scroll */}
      <div className="w-full overflow-x-auto touch-pan-x">
        <table className="w-full min-w-[920px] text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-pitch-700/80 bg-pitch-950 text-[11px] uppercase tracking-wider text-slate-400 font-mono">
              <th scope="col" className="py-3 px-3 w-32">TIME</th>
              <th scope="col" className="py-3 px-3 w-32">LEAGUE</th>
              <th scope="col" className="py-3 px-3 min-w-[220px]">FIXTURE</th>
              <th scope="col" className="py-3 px-3 w-28 text-center">PREDICTED</th>
              <th scope="col" className="py-3 px-3 w-48 text-center">1X2 FAIR vs CONSENSUS</th>
              <th scope="col" className="py-3 px-3 w-28 text-center">O/U 2.5</th>
              <th scope="col" className="py-3 px-3 w-36 text-center">+EV SIGNAL</th>
              <th scope="col" className="py-3 px-3 w-36 text-center">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {validFixtures.map((fixture) => {
              if (!fixture?.id) return null
              const isExpanded = expandedIds.has(fixture.id)
              const isPinned = watchlist?.includes(fixture.id)

              return (
                <TableRow
                  key={fixture.id}
                  fixture={fixture}
                  isExpanded={isExpanded}
                  onToggleExpand={() => toggleRow(fixture.id)}
                  isPinned={isPinned}
                  onToggleWatchlist={onToggleWatchlist}
                  onSelectForLab={onSelectForLab}
                  onOpenMatrix={onOpenMatrix}
                  onOpenQuantModal={onOpenQuantModal}
                  onLogPosition={onLogPosition}
                  slipLegs={slipLegs}
                  onToggleSlip={onToggleSlip}
                  standingsMap={standingsMap}
                  quantLocked={quantLocked}
                  onTriggerUpgrade={onTriggerUpgrade}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export { TableView as MatchTable }
