// ---- MatchCard.jsx ----
// Sports analytics card with Progressive Disclosure:
// - Default compact state: Teams, Form Guide, Kickoff, Predicted Score, xG, 1X2 Probabilities, and +EV Badge
// - Expandable deep-dive: O/U 2.5 vs BTTS, Zero-Vig consensus comparison, Quant Lab deep-dive, and Position Logger
// - Institutional sanitation: Zero third-party vendor names or scraping references

import { useState, useMemo } from 'react'
import ProbabilityBar from './ProbabilityBar'
import OddsComparison from './OddsComparison'
import ValueBadge from './ValueBadge'
import DualGauge from './DualGauge'
import FormGuide from './FormGuide'
import {
  formatLocalizedMatchDate,
  isRealMarketOdds,
  calculateEdgeAndEV,
  getMarginOfSafety,
  getKellyFraction,
  calculatePoissonMatrix,
  calculateTotalsFromMatrix,
  calculateSpreadsFromMatrix,
  calculateMarketEV,
} from '../utils/analytics'
import { TotalsMarketView, SpreadsMarketView } from './MultiMarketViews'

function TeamLogo({ src, name }) {
  return (
    <div className="w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0 flex items-center justify-center">
      {src ? (
        <img
          src={src}
          alt={`${name} crest`}
          width={32}
          height={32}
          className="w-full h-full object-contain drop-shadow"
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      ) : (
        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-pitch-700 flex items-center justify-center text-xs font-bold text-slate-300">
          {name?.[0] ?? '?'}
        </div>
      )}
    </div>
  )
}

function LambdaRow({ lambdaHome, lambdaAway }) {
  if (!lambdaHome && !lambdaAway) return null
  return (
    <p className="text-[11px] text-slate-500 tabular-nums font-mono">
      xG:{' '}
      <span className="text-sky-400 font-semibold">{lambdaHome ?? '?'}</span>
      {' '}v{' '}
      <span className="text-rose-400 font-semibold">{lambdaAway ?? '?'}</span>
    </p>
  )
}

export default function MatchCard({
  fixture,
  isPinned,
  onToggleWatchlist,
  onOpenMatrix,
  onOpenQuantModal,
  onSelectForLab,
  onLogPosition,
  slipPicks = [],
  onToggleSlip,
  standingsMap = {},
  style,
  quantLocked = false,
  onTriggerUpgrade,
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeMarketTab, setActiveMarketTab] = useState('h2h')
  const triggerUpgrade = quantLocked ? onTriggerUpgrade : null

  const {
    home_team_name, home_team_logo,
    away_team_name, away_team_logo,
    league_name,    league_logo,
    match_date,
    prob_home, prob_draw, prob_away,
    predicted_score,
    prob_over_25,  prob_btts,
    odds_home, odds_draw, odds_away,
    value_pick, ev_percentage,
    lambda_home, lambda_away,
  } = fixture

  const homeLogo = fixture.home_team?.crest_url || home_team_logo
  const awayLogo = fixture.away_team?.crest_url || away_team_logo
  const homeName = fixture.home_team?.name || home_team_name
  const awayName = fixture.away_team?.name || away_team_name

  const homeStandings = standingsMap[fixture.home_team_id] || standingsMap[`${fixture.league_id}_${fixture.home_team_id}`] || null
  const awayStandings = standingsMap[fixture.away_team_id] || standingsMap[`${fixture.league_id}_${fixture.away_team_id}`] || null

  const isValue = Boolean(value_pick)
  const hasRealOdds = isRealMarketOdds(fixture)
  const { relativeBadge, timeStr, dateStr } = formatLocalizedMatchDate(match_date)

  // Determine active odds and model prob for value pick
  const { valueOdds, valueProb, valueLabel } = useMemo(() => {
    if (!value_pick) return { valueOdds: null, valueProb: null, valueLabel: '' }
    if (value_pick === 'HOME') return { valueOdds: odds_home, valueProb: prob_home, valueLabel: `${home_team_name} Win` }
    if (value_pick === 'DRAW') return { valueOdds: odds_draw, valueProb: prob_draw, valueLabel: 'Draw (X)' }
    return { valueOdds: odds_away, valueProb: prob_away, valueLabel: `${away_team_name} Win` }
  }, [value_pick, odds_home, odds_draw, odds_away, prob_home, prob_draw, prob_away, home_team_name, away_team_name])

  // Compute Poisson matrix & multi-market probability distribution
  const matrix = useMemo(() => {
    if (lambda_home != null && lambda_away != null) {
      return calculatePoissonMatrix(Number(lambda_home), Number(lambda_away))
    }
    return null
  }, [lambda_home, lambda_away])

  const totalsProbs = useMemo(() => {
    if (matrix) {
      return calculateTotalsFromMatrix(matrix)
    }
    return {}
  }, [matrix])

  const spreadsProbs = useMemo(() => {
    if (matrix) {
      return calculateSpreadsFromMatrix(matrix)
    }
    return {}
  }, [matrix])

  // Multi-market EV detection for header badges
  const totalsEdge = useMemo(() => {
    if (Array.isArray(fixture.ev_opportunities)) {
      const opp = fixture.ev_opportunities.find((o) => o.market === 'totals' && o.ev_pct >= 2.0)
      if (opp) {
        const outcome = opp.outcome || (opp.pick?.includes('OVER') ? 'Over' : 'Under')
        return {
          label: `${outcome} ${opp.line ?? '2.5'}`,
          ev: Number(opp.ev_pct).toFixed(1),
        }
      }
    }
    if (fixture.market_odds?.totals && totalsProbs) {
      for (const line of ['1.5', '2.5', '3.5']) {
        const bOver = fixture.market_odds.totals[line]?.over
        const pOver = totalsProbs[line]?.over ?? (line === '2.5' ? Number(prob_over_25) : null)
        if (bOver && pOver) {
          const ev = calculateMarketEV(pOver, bOver)
          if (ev && ev >= 2.0) {
            return { label: `Over ${line}`, ev }
          }
        }
        const bUnder = fixture.market_odds.totals[line]?.under
        const pUnder = totalsProbs[line]?.under ?? (line === '2.5' ? Math.max(0, 100 - Number(prob_over_25)) : null)
        if (bUnder && pUnder) {
          const ev = calculateMarketEV(pUnder, bUnder)
          if (ev && ev >= 2.0) {
            return { label: `Under ${line}`, ev }
          }
        }
      }
    }
    return null
  }, [fixture.ev_opportunities, fixture.market_odds, totalsProbs, prob_over_25])

  const spreadsEdge = useMemo(() => {
    if (Array.isArray(fixture.ev_opportunities)) {
      const opp = fixture.ev_opportunities.find((o) => o.market === 'spreads' && o.ev_pct >= 2.0)
      if (opp) {
        const outcome = opp.outcome || (opp.pick?.includes('HOME') ? home_team_name : away_team_name)
        const lineStr = opp.line != null ? (Number(opp.line) > 0 ? `+${opp.line}` : `${opp.line}`) : ''
        return {
          label: `${outcome} ${lineStr}`.trim(),
          ev: Number(opp.ev_pct).toFixed(1),
        }
      }
    }
    if (fixture.market_odds?.spreads && spreadsProbs) {
      for (const line of ['-0.5', '0.0', '+0.5', '-1.0', '+1.0']) {
        const bHome = fixture.market_odds.spreads[line]?.home
        const pHome = spreadsProbs[line]?.home
        if (bHome && pHome) {
          const ev = calculateMarketEV(pHome, bHome)
          if (ev && ev >= 2.0) {
            return { label: `${home_team_name} ${line}`, ev }
          }
        }
        const bAway = fixture.market_odds.spreads[line]?.away
        const pAway = spreadsProbs[line]?.away
        if (bAway && pAway) {
          const ev = calculateMarketEV(pAway, bAway)
          if (ev && ev >= 2.0) {
            return { label: `${away_team_name} ${line}`, ev }
          }
        }
      }
    }
    return null
  }, [fixture.ev_opportunities, fixture.market_odds, spreadsProbs, home_team_name, away_team_name])

  // Margin of safety and Quarter-Kelly stake recommendation
  const { marginSafety, recKellyPct } = useMemo(() => {
    if (!isValue || !valueOdds || !valueProb) return { marginSafety: null, recKellyPct: null }
    const { netEdge } = calculateEdgeAndEV(valueOdds, valueProb)
    const rawKelly = getKellyFraction(valueOdds, valueProb)
    const quarterKelly = Math.max(0, Math.min(2.5, Number((rawKelly * 0.25).toFixed(1))))
    return {
      marginSafety: getMarginOfSafety(netEdge),
      recKellyPct: quarterKelly,
    }
  }, [isValue, valueOdds, valueProb])

  const isValuePickInSlip = value_pick ? slipPicks.includes(value_pick) : false

  return (
    <article
      className={`match-card ${isValue ? 'match-card--value' : ''} p-3.5 sm:p-4 animate-slide-up flex flex-col justify-between transition-all`}
      style={style}
      aria-label={`${home_team_name} vs ${away_team_name}, ${dateStr}`}
    >
      <div>
        {/* ---- Header: League, Kickoff Time, Odds Source & Watchlist Star ---- */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              {league_logo && (
                <img
                  src={league_logo}
                  alt=""
                  width={16}
                  height={16}
                  className="w-4 h-4 object-contain flex-shrink-0"
                  loading="lazy"
                  aria-hidden="true"
                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
              )}
              <span className="text-xs text-slate-400 font-semibold truncate" title={league_name}>
                {league_name}
              </span>
            </div>

            {/* Market feed indicator */}
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono ${
                  hasRealOdds
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-pitch-900 text-slate-400 border border-pitch-700'
                }`}
              >
                <span>{hasRealOdds ? '●' : '○'}</span>
                <span>{hasRealOdds ? 'Consensus Sharp Feed' : 'Model Fair Only'}</span>
              </span>
            </div>

            {/* Multi-Market EV Badges in Header */}
            {(totalsEdge || spreadsEdge) && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {totalsEdge && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30"
                    title="Identified +EV Edge in Totals market"
                  >
                    <span>★</span>
                    <span>+EV Totals: {totalsEdge.label} (+{totalsEdge.ev}%)</span>
                  </span>
                )}
                {spreadsEdge && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30"
                    title="Identified +EV Edge in Asian Handicap market"
                  >
                    <span>★</span>
                    <span>+EV Spread: {spreadsEdge.label} (+{spreadsEdge.ev}%)</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right Header: Timing & Pin Button */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="text-right">
              <span className="inline-block px-2 py-0.5 rounded bg-pitch-900 border border-pitch-700 text-[11px] font-medium text-amber-400 tabular-nums">
                {relativeBadge}
              </span>
              {timeStr && (
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">{timeStr}</p>
              )}
            </div>

            {/* Star Watchlist Toggle */}
            <button
              type="button"
              onClick={() => onToggleWatchlist(fixture.id)}
              aria-label={isPinned ? `Unpin ${home_team_name} vs ${away_team_name} from watchlist` : `Pin ${home_team_name} vs ${away_team_name} to watchlist`}
              className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-pitch-900/80 hover:bg-pitch-700 text-slate-400 hover:text-amber-400 border border-pitch-700 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 active:scale-95 touch-manipulation"
            >
              <svg
                width="15"
                height="15"
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
          </div>
        </div>

        {/* ---- Teams & Predicted Score ---- */}
        <div className="flex items-center justify-between gap-2.5 mb-3">
          {/* Home */}
          <div className="flex flex-col items-center gap-1 flex-1 text-center min-w-0">
            <TeamLogo src={homeLogo} name={homeName} />
            <span className="text-xs font-semibold text-slate-200 line-clamp-2 leading-tight min-h-[2.4em] flex items-center justify-center">
              {home_team_name}
            </span>
            {homeStandings?.form && (
              <FormGuide form={homeStandings.form} size="sm" />
            )}
            {homeStandings?.home_played > 0 && (
              <span className="text-[10px] text-slate-500 font-mono">
                H: {homeStandings.home_goals_for}:{homeStandings.home_goals_against} ({homeStandings.home_played}H)
              </span>
            )}
          </div>

          {/* Centre: predicted score + metadata */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0 px-1">
            {predicted_score ? (
              <div className="text-center">
                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                  Predicted
                </p>
                <p className="text-xl sm:text-2xl font-bold text-slate-100 tabular-nums tracking-tight leading-none">
                  {predicted_score}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 font-semibold font-mono">vs</p>
            )}
            <LambdaRow lambdaHome={lambda_home} lambdaAway={lambda_away} />
          </div>

          {/* Away */}
          <div className="flex flex-col items-center gap-1 flex-1 text-center min-w-0">
            <TeamLogo src={awayLogo} name={awayName} />
            <span className="text-xs font-semibold text-slate-200 line-clamp-2 leading-tight min-h-[2.4em] flex items-center justify-center">
              {away_team_name}
            </span>
            {awayStandings?.form && (
              <FormGuide form={awayStandings.form} size="sm" />
            )}
            {awayStandings?.away_played > 0 && (
              <span className="text-[10px] text-slate-500 font-mono">
                A: {awayStandings.away_goals_for}:{awayStandings.away_goals_against} ({awayStandings.away_played}A)
              </span>
            )}
          </div>
        </div>

        {/* ---- 1X2 Probabilities (Compact) ---- */}
        {(prob_home != null || prob_draw != null || prob_away != null) && (
          <div className="mb-3">
            <ProbabilityBar
              probHome={prob_home}
              probDraw={prob_draw}
              probAway={prob_away}
            />
          </div>
        )}

        {/* ---- Compact +EV Highlight Bar (Visible in Default State) ---- */}
        {isValue && (
          <div className="mb-3 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
              <span className="text-xs font-bold text-amber-300 truncate">
                +EV Edge: {value_pick} ({ev_percentage > 0 ? `+${ev_percentage}%` : `${ev_percentage}%`})
              </span>
            </div>
            {recKellyPct != null && (
              <span className="text-[10px] font-mono text-amber-400/90 whitespace-nowrap">
                Rec: {recKellyPct}% Stake
              </span>
            )}
          </div>
        )}

        {/* ---- Expandable Deep-Dive Section (Progressive Disclosure) ---- */}
        {isExpanded && (
          <div className="pt-2 border-t border-pitch-800/80 space-y-3 animate-fade-in">
            {/* Dual Gauge O/U 2.5 and BTTS */}
            {(prob_over_25 != null || prob_btts != null) && (
              <div>
                <DualGauge probOver25={prob_over_25} probBtts={prob_btts} />
              </div>
            )}

            {/* Multi-Market Secondary Tabs Selector */}
            <div className="flex items-center gap-1 p-1 bg-pitch-900/90 rounded-xl border border-pitch-800">
              <button
                type="button"
                onClick={() => setActiveMarketTab('h2h')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 touch-manipulation min-h-[36px] ${
                  activeMarketTab === 'h2h'
                    ? 'bg-pitch-800 text-amber-400 font-bold shadow-sm border border-pitch-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>1X2 Moneyline</span>
                {isValue && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveMarketTab('totals')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 touch-manipulation min-h-[36px] ${
                  activeMarketTab === 'totals'
                    ? 'bg-pitch-800 text-amber-400 font-bold shadow-sm border border-pitch-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Totals (O/U)</span>
                {totalsEdge && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveMarketTab('spreads')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 touch-manipulation min-h-[36px] ${
                  activeMarketTab === 'spreads'
                    ? 'bg-pitch-800 text-amber-400 font-bold shadow-sm border border-pitch-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Asian Handicap</span>
                {spreadsEdge && (
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                )}
              </button>
            </div>

            {/* Tab Panel 1: 1X2 Moneyline & Value Strip */}
            {activeMarketTab === 'h2h' && (
              <div className="space-y-3">
                {(odds_home || odds_draw || odds_away) && (
                  <div>
                    <OddsComparison
                      oddsHome={odds_home}
                      oddsDraw={odds_draw}
                      oddsAway={odds_away}
                      probHome={prob_home}
                      probDraw={prob_draw}
                      probAway={prob_away}
                      valuePick={value_pick}
                      slipPicks={slipPicks}
                      onToggleSlipPick={onToggleSlip ? (pick, odds, prob, label) => {
                        onToggleSlip({
                          fixtureId: fixture.id,
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
                  </div>
                )}

                {/* Value Bet Detailed Strip */}
                {isValue && (
                  <div className="p-2.5 rounded-xl bg-pitch-950/70 border border-amber-500/20 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <ValueBadge
                        pick={value_pick}
                        evPct={ev_percentage}
                        odds={valueOdds}
                        modelProb={valueProb}
                        onClick={onOpenQuantModal ? () => onOpenQuantModal(fixture) : null}
                      />

                      {/* Add to Parlay Slip Button */}
                      {onToggleSlip && valueOdds && (
                        <button
                          type="button"
                          onClick={() => onToggleSlip({
                            fixtureId: fixture.id,
                            homeTeam: home_team_name,
                            awayTeam: away_team_name,
                            pick: value_pick,
                            pickLabel: valueLabel,
                            odds: valueOdds,
                            modelProb: valueProb,
                            ev: ev_percentage,
                            leagueName: league_name,
                            matchDate: match_date,
                          })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 min-h-[36px] ${
                            isValuePickInSlip
                              ? 'bg-amber-500 text-pitch-950'
                              : 'bg-pitch-900 border border-pitch-700 text-slate-300 hover:text-amber-400'
                          }`}
                        >
                          <span>{isValuePickInSlip ? '✓ In Slip' : '+ Slip'}</span>
                        </button>
                      )}
                    </div>

                    {marginSafety && (
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span className={`px-1.5 py-0.5 rounded border ${marginSafety.colorClass}`}>
                          {marginSafety.label}
                        </span>
                        <span>Target: {value_pick} @ {valueOdds ? Number(valueOdds).toFixed(2) : '-'}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab Panel 2: Totals (Over / Under) */}
            {activeMarketTab === 'totals' && (
              <TotalsMarketView
                totalsProbs={totalsProbs}
                marketTotals={fixture.market_odds?.totals || {}}
                fallbackOver25={prob_over_25}
                slipPicks={slipPicks}
                onToggleSlip={onToggleSlip}
                homeTeam={home_team_name}
                awayTeam={away_team_name}
                fixtureId={fixture.id}
                leagueName={league_name}
                matchDate={match_date}
              />
            )}

            {/* Tab Panel 3: Asian Handicap (Spreads) */}
            {activeMarketTab === 'spreads' && (
              <SpreadsMarketView
                spreadsProbs={spreadsProbs}
                marketSpreads={fixture.market_odds?.spreads || {}}
                slipPicks={slipPicks}
                onToggleSlip={onToggleSlip}
                homeTeam={home_team_name}
                awayTeam={away_team_name}
                fixtureId={fixture.id}
                leagueName={league_name}
                matchDate={match_date}
              />
            )}

            {/* Primary Action Buttons Bar */}
            <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-xs">
              {/* Deep Dive in Quant Lab */}
              <button
                type="button"
                onClick={() => onSelectForLab && onSelectForLab(fixture)}
                className="min-h-[44px] py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-semibold flex items-center justify-center gap-1.5 transition-colors active:scale-98 touch-manipulation"
                title="Open fixture in Quant Lab"
              >
                <span>⚅</span>
                <span>Quant Lab</span>
              </button>

              {/* Log Position to Portfolio */}
              {onLogPosition && (
                <button
                  type="button"
                  onClick={() => onLogPosition({
                    fixtureId: fixture.id,
                    fixtureName: `${home_team_name} vs ${away_team_name}`,
                    leagueName: league_name || 'League',
                    matchDate: match_date,
                    selection: value_pick || 'HOME',
                    selectionLabel: valueLabel || `${home_team_name} Win`,
                    odds: valueOdds || odds_home || 2.0,
                    stakePercent: recKellyPct || 1.5,
                    stakeAmount: Math.round(10000000 * ((recKellyPct || 1.5) / 100)),
                    modelProb: valueProb || prob_home || 50,
                    evPercentage: ev_percentage || 0,
                  })}
                  className="min-h-[44px] py-2 px-3 rounded-xl bg-pitch-950 hover:bg-pitch-800 border border-pitch-700 text-slate-200 flex items-center justify-center gap-1.5 transition-colors active:scale-98 touch-manipulation"
                  title="Log position into Portfolio Tracker"
                >
                  <span>⊞</span>
                  <span>Log Position</span>
                </button>
              )}
            </div>

            {/* Secondary Modal Triggers */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <button
                type="button"
                onClick={() => triggerUpgrade ? triggerUpgrade('Score Matrix requires a Pro pass') : onOpenMatrix(fixture)}
                className="min-h-[44px] py-2 px-2.5 rounded-xl bg-pitch-950 hover:bg-pitch-800 border border-pitch-800 text-slate-400 hover:text-slate-200 text-center transition-colors"
              >
                Matrix Modal
              </button>
              <button
                type="button"
                onClick={() => triggerUpgrade ? triggerUpgrade('Quant and Kelly require a Pro pass') : onOpenQuantModal && onOpenQuantModal(fixture)}
                className="min-h-[44px] py-2 px-2.5 rounded-xl bg-pitch-950 hover:bg-pitch-800 border border-pitch-800 text-slate-400 hover:text-slate-200 text-center transition-colors"
              >
                Kelly Modal
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ---- Progressive Disclosure Toggle Footer ---- */}
      <div className="pt-2 mt-2 border-t border-pitch-800/60">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="w-full min-h-[44px] py-2 px-3 rounded-xl bg-pitch-950/70 hover:bg-pitch-800 text-slate-300 hover:text-amber-400 border border-pitch-800/80 text-xs font-mono transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 active:scale-98 touch-manipulation"
        >
          <span>{isExpanded ? '▲ Collapse Deep Dive' : '▼ Deep Dive & Odds Matrix'}</span>
        </button>
      </div>
    </article>
  )
}
