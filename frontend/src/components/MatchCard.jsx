// ---- MatchCard.jsx ----
// Sports analytics card for a single match fixture:
// - Kickoff & relative timing hints
// - Real vs Fair Odds source badges
// - Dual-color O/U 2.5 and BTTS progress gauges
// - 1X2 probabilities with No-Vig consensus odds
// - Tiered +EV badge & Margin of Safety indicator
// - One-click "+ Slip" parlay accumulator builder
// - Triggers for Score Matrix and Kelly Risk modals

import { useMemo } from 'react'
import ProbabilityBar from './ProbabilityBar'
import OddsComparison from './OddsComparison'
import ValueBadge from './ValueBadge'
import DualGauge from './DualGauge'
import {
  formatLocalizedMatchDate,
  isRealMarketOdds,
  calculateEdgeAndEV,
  getMarginOfSafety,
} from '../utils/analytics'

function TeamLogo({ src, name }) {
  return (
    <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center">
      {src ? (
        <img
          src={src}
          alt={`${name} crest`}
          width={48}
          height={48}
          className="w-full h-full object-contain drop-shadow"
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-pitch-700 flex items-center justify-center text-sm font-bold text-slate-300">
          {name?.[0] ?? '?'}
        </div>
      )}
    </div>
  )
}

function LambdaRow({ lambdaHome, lambdaAway }) {
  if (!lambdaHome && !lambdaAway) return null
  return (
    <p className="text-xs text-slate-500 tabular-nums">
      xG λ:{' '}
      <span className="text-sky-400 font-mono font-semibold">{lambdaHome ?? '?'}</span>
      {' '}vs{' '}
      <span className="text-rose-400 font-mono font-semibold">{lambdaAway ?? '?'}</span>
    </p>
  )
}

export default function MatchCard({
  fixture,
  isPinned,
  onToggleWatchlist,
  onOpenMatrix,
  onOpenQuantModal,
  slipPicks = [],
  onToggleSlip,
  style,
}) {
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

  // Margin of safety calculation for value pick
  const marginSafety = useMemo(() => {
    if (!isValue || !valueOdds || !valueProb) return null
    const { netEdge } = calculateEdgeAndEV(valueOdds, valueProb)
    return getMarginOfSafety(netEdge)
  }, [isValue, valueOdds, valueProb])

  const isValuePickInSlip = value_pick ? slipPicks.includes(value_pick) : false

  return (
    <article
      className={`match-card ${isValue ? 'match-card--value' : ''} p-5 animate-slide-up flex flex-col justify-between`}
      style={style}
      aria-label={`${home_team_name} vs ${away_team_name}, ${dateStr}`}
    >
      <div>
        {/* ---- Header: League, Kickoff Time, Odds Source & Watchlist Star ---- */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              {league_logo && (
                <img
                  src={league_logo}
                  alt=""
                  width={18}
                  height={18}
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

            {/* Odds source badge */}
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${
                  hasRealOdds
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-pitch-900 text-slate-400 border border-pitch-700'
                }`}
              >
                <span>{hasRealOdds ? '●' : '○'}</span>
                <span>{hasRealOdds ? 'Real Odds (Bet365)' : 'Fair Odds (Model)'}</span>
              </span>
            </div>
          </div>

          {/* Right Header: Timing & Pin Button */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-right">
              <span className="inline-block px-2 py-0.5 rounded bg-pitch-900 border border-pitch-700 text-xs font-medium text-amber-400 tabular-nums">
                {relativeBadge}
              </span>
              {timeStr && (
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">{timeStr}</p>
              )}
            </div>

            {/* Star Watchlist Toggle */}
            <button
              type="button"
              onClick={() => onToggleWatchlist(fixture.id)}
              aria-label={isPinned ? `Unpin ${home_team_name} vs ${away_team_name} from watchlist` : `Pin ${home_team_name} vs ${away_team_name} to watchlist`}
              className="w-11 h-11 flex items-center justify-center rounded-lg bg-pitch-900/80 hover:bg-pitch-700 text-slate-400 hover:text-amber-400 border border-pitch-700 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <svg
                width="18"
                height="18"
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
        <div className="flex items-center justify-between gap-3 mb-5">
          {/* Home */}
          <div className="flex flex-col items-center gap-2 flex-1 text-center min-w-0">
            <TeamLogo src={home_team_logo} name={home_team_name} />
            <span className="text-sm font-semibold text-slate-200 line-clamp-2 leading-tight">
              {home_team_name}
            </span>
          </div>

          {/* Centre: predicted score + metadata */}
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0 px-2">
            {predicted_score ? (
              <div className="text-center">
                <p className="text-[11px] text-slate-500 mb-0.5 font-medium uppercase tracking-wider">
                  Predicted
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-100 tabular-nums tracking-tight leading-none">
                  {predicted_score}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500 font-semibold">vs</p>
            )}
            <LambdaRow lambdaHome={lambda_home} lambdaAway={lambda_away} />
          </div>

          {/* Away */}
          <div className="flex flex-col items-center gap-2 flex-1 text-center min-w-0">
            <TeamLogo src={away_team_logo} name={away_team_name} />
            <span className="text-sm font-semibold text-slate-200 line-clamp-2 leading-tight">
              {away_team_name}
            </span>
          </div>
        </div>

        {/* ---- 1X2 Probabilities ---- */}
        {(prob_home != null || prob_draw != null || prob_away != null) && (
          <div className="mb-4">
            <ProbabilityBar
              probHome={prob_home}
              probDraw={prob_draw}
              probAway={prob_away}
            />
          </div>
        )}

        {/* ---- Dual-Color Progress Bars for Over/Under 2.5 and BTTS ---- */}
        {(prob_over_25 != null || prob_btts != null) && (
          <div className="mb-4">
            <DualGauge probOver25={prob_over_25} probBtts={prob_btts} />
          </div>
        )}

        {/* ---- Odds comparison with No-Vig & Slip Toggles ---- */}
        {(odds_home || odds_draw || odds_away) && (
          <div className="mb-4">
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
      </div>

      <div>
        {/* ---- Action Buttons: Matrix Heatmap & Quant Risk Modal ---- */}
        <div className="grid grid-cols-2 gap-2 pt-2 mb-3">
          <button
            type="button"
            onClick={() => onOpenMatrix(fixture)}
            className="py-2.5 px-3 min-h-[44px] rounded-xl bg-pitch-900 hover:bg-pitch-700 text-slate-300 hover:text-amber-400 border border-pitch-700 font-medium text-xs flex items-center justify-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <span aria-hidden="true">📊</span>
            <span>Score Matrix</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenQuantModal && onOpenQuantModal(fixture)}
            className="py-2.5 px-3 min-h-[44px] rounded-xl bg-pitch-900 hover:bg-pitch-700 text-slate-300 hover:text-amber-400 border border-pitch-700 font-medium text-xs flex items-center justify-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <span aria-hidden="true">🧮</span>
            <span>Quant & Kelly</span>
          </button>
        </div>

        {/* ---- Value bet strip (when EV detected) ---- */}
        {isValue && (
          <div className="pt-3 border-t border-pitch-700/60 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ValueBadge
                pick={value_pick}
                evPct={ev_percentage}
                odds={valueOdds}
                modelProb={valueProb}
                onClick={onOpenQuantModal ? () => onOpenQuantModal(fixture) : null}
              />

              {/* Quick Add Value Pick to Parlay Slip */}
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
                  className={`px-3 py-1.5 min-h-[38px] rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                    isValuePickInSlip
                      ? 'bg-amber-500 text-pitch-950 font-bold'
                      : 'bg-pitch-900 border border-pitch-700 text-slate-300 hover:text-amber-400 hover:border-amber-500/40'
                  }`}
                >
                  <span>{isValuePickInSlip ? '✓ Slip Added' : '+ Add EV to Slip'}</span>
                </button>
              )}
            </div>

            {/* Margin of Safety Indicator */}
            {marginSafety && (
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${marginSafety.colorClass}`}>
                  {marginSafety.label}
                </span>
                <span className="font-mono text-slate-500">
                  Target: <strong className="text-amber-300">{value_pick}</strong> @ {valueOdds ? Number(valueOdds).toFixed(2) : '-'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ---- No odds state ---- */}
        {!odds_home && !odds_draw && !odds_away && prob_home != null && (
          <p className="text-xs text-slate-500 mt-2 italic text-center">
            Bookmaker odds not yet published for this fixture.
          </p>
        )}
      </div>
    </article>
  )
}
