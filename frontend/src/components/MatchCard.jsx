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
} from '../utils/analytics'

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
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-pitch-900/80 hover:bg-pitch-700 text-slate-400 hover:text-amber-400 border border-pitch-700 transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
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
            <TeamLogo src={home_team_logo} name={home_team_name} />
            <span className="text-xs font-semibold text-slate-200 line-clamp-1 leading-tight">
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
            <TeamLogo src={away_team_logo} name={away_team_name} />
            <span className="text-xs font-semibold text-slate-200 line-clamp-1 leading-tight">
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

            {/* Zero-Vig Consensus Comparison & Odds */}
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
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
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

            {/* Primary Action Buttons Bar */}
            <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-xs">
              {/* Deep Dive in Quant Lab */}
              <button
                type="button"
                onClick={() => onSelectForLab && onSelectForLab(fixture)}
                className="min-h-[44px] py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-semibold flex items-center justify-center gap-1.5 transition-colors active:scale-98"
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
                  className="min-h-[44px] py-2 px-3 rounded-xl bg-pitch-950 hover:bg-pitch-800 border border-pitch-700 text-slate-200 flex items-center justify-center gap-1.5 transition-colors active:scale-98"
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
          className="w-full min-h-[44px] py-2 px-3 rounded-xl bg-pitch-950/70 hover:bg-pitch-800 text-slate-300 hover:text-amber-400 border border-pitch-800/80 text-xs font-mono transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 active:scale-98"
        >
          <span>{isExpanded ? '▲ Collapse Deep Dive' : '▼ Deep Dive & Odds Matrix'}</span>
        </button>
      </div>
    </article>
  )
}
