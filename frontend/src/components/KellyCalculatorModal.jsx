// ---- KellyCalculatorModal.jsx ----
// Deep-dive quantitative inspection modal:
// - Zero-Vig Consensus Odds & Bookmaker Vigorish / Juice
// - Net Edge & Margin of Safety (Buffer Index)
// - Dynamic Kelly Criterion & Fractional Staking Calculator
// - Client-side Monte Carlo Simulation (3,000 iterations)
// - Accessible dialog with Escape key, backdrop dismiss, and visible focus.

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  calculateZeroVigOdds,
  calculateEdgeAndEV,
  getMarginOfSafety,
  calculateKelly,
  runMonteCarloSimulation,
  formatLocalizedMatchDate,
} from '../utils/analytics'

export default function KellyCalculatorModal({
  fixture,
  isOpen,
  onClose,
  onAddToSlip,
  isInSlip,
}) {
  const modalRef = useRef(null)
  const [bankroll, setBankroll] = useState(1000000)
  const [selectedOutcome, setSelectedOutcome] = useState('HOME')

  // Set default outcome when fixture opens
  useEffect(() => {
    if (fixture?.value_pick) {
      setSelectedOutcome(fixture.value_pick)
    } else {
      setSelectedOutcome('HOME')
    }
  }, [fixture])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Zero-Vig True Consensus Odds calculation
  const zeroVig = useMemo(() => {
    if (!fixture) return null
    return calculateZeroVigOdds(fixture.odds_home, fixture.odds_draw, fixture.odds_away)
  }, [fixture])

  // Determine active odds and model prob for selected outcome
  const outcomeStats = useMemo(() => {
    if (!fixture) return { odds: 0, modelProb: 0, label: 'Home Win', fairOdds: 0 }
    if (selectedOutcome === 'DRAW') {
      return {
        odds: Number(fixture.odds_draw) || 0,
        modelProb: Number(fixture.prob_draw) || 0,
        label: 'Draw (X)',
        fairOdds: zeroVig?.fairOddsDraw || 0,
      }
    }
    if (selectedOutcome === 'AWAY') {
      return {
        odds: Number(fixture.odds_away) || 0,
        modelProb: Number(fixture.prob_away) || 0,
        label: `${fixture.away_team_name} (Away Win)`,
        fairOdds: zeroVig?.fairOddsAway || 0,
      }
    }
    return {
      odds: Number(fixture.odds_home) || 0,
      modelProb: Number(fixture.prob_home) || 0,
      label: `${fixture.home_team_name} (Home Win)`,
      fairOdds: zeroVig?.fairOddsHome || 0,
    }
  }, [fixture, selectedOutcome, zeroVig])

  // Net Edge & Expected Value
  const edgeData = useMemo(() => {
    return calculateEdgeAndEV(outcomeStats.odds, outcomeStats.modelProb)
  }, [outcomeStats])

  const marginSafety = useMemo(() => {
    return getMarginOfSafety(edgeData.netEdge)
  }, [edgeData.netEdge])

  // Kelly Staking
  const kelly = useMemo(() => {
    return calculateKelly(outcomeStats.odds, outcomeStats.modelProb)
  }, [outcomeStats])

  // Monte Carlo Simulation (3,000 runs)
  const sim = useMemo(() => {
    if (!fixture || !isOpen) return null
    return runMonteCarloSimulation(fixture.lambda_home, fixture.lambda_away, 3000)
  }, [fixture, isOpen])

  if (!isOpen || !fixture) return null

  const nominalStake = Math.round((Number(bankroll) || 0) * (kelly.quarterKellyPct / 100))
  const { dateStr, timeStr } = formatLocalizedMatchDate(fixture.match_date)

  const handleSlipClick = () => {
    if (onAddToSlip) {
      onAddToSlip({
        fixtureId: fixture.id,
        homeTeam: fixture.home_team_name,
        awayTeam: fixture.away_team_name,
        pick: selectedOutcome,
        pickLabel: outcomeStats.label,
        odds: outcomeStats.odds,
        modelProb: outcomeStats.modelProb,
        ev: edgeData.evPercent,
        leagueName: fixture.league_name,
        matchDate: fixture.match_date,
      })
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-pitch-950/85 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kelly-modal-title"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-3xl bg-pitch-900 border border-pitch-700 rounded-2xl p-4 sm:p-6 shadow-2xl overflow-y-auto max-h-[92vh] text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close quantitative analytics modal"
          className="absolute top-4 right-4 w-9 h-9 min-h-[36px] flex items-center justify-center rounded-lg bg-pitch-800 text-slate-400 hover:text-slate-100 hover:bg-pitch-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Header */}
        <div className="mb-5 pr-8">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
              Quantitative Risk Engine
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {fixture.league_name} · {dateStr} {timeStr}
            </span>
          </div>
          <h2 id="kelly-modal-title" className="text-lg sm:text-2xl font-bold text-slate-100 mt-1">
            {fixture.home_team_name} vs {fixture.away_team_name}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Zero-vig fair value calculation, margin of safety audit, and Kelly criterion fractional sizing.
          </p>
        </div>

        {/* Outcome Selector Tabs */}
        <div className="flex items-center gap-2 mb-5 p-1 rounded-xl bg-pitch-950 border border-pitch-800" role="tablist" aria-label="Select outcome to analyze">
          {[
            { id: 'HOME', label: `1 · ${fixture.home_team_name}`, odds: fixture.odds_home, prob: fixture.prob_home },
            { id: 'DRAW', label: 'X · Draw', odds: fixture.odds_draw, prob: fixture.prob_draw },
            { id: 'AWAY', label: `2 · ${fixture.away_team_name}`, odds: fixture.odds_away, prob: fixture.prob_away },
          ].map((item) => {
            const isSelected = selectedOutcome === item.id
            const isModelPick = fixture.value_pick === item.id
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedOutcome(item.id)}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                  isSelected
                    ? 'bg-pitch-800 text-amber-400 border border-amber-500/40 shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-pitch-900'
                }`}
              >
                <span className="truncate">{item.label}</span>
                <span className="font-mono text-slate-300">
                  {item.odds ? Number(item.odds).toFixed(2) : '-'}
                </span>
                {isModelPick && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500 text-pitch-950 font-bold">
                    +EV
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Top Quantitative Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {/* Model Probability */}
          <div className="p-3 rounded-xl bg-pitch-950 border border-pitch-800">
            <span className="text-[11px] text-slate-500 block font-medium">Model Probability</span>
            <span className="text-xl font-bold font-mono text-sky-400">
              {outcomeStats.modelProb ? `${outcomeStats.modelProb.toFixed(1)}%` : '-'}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Bivariate Poisson</span>
          </div>

          {/* Implied Market Prob */}
          <div className="p-3 rounded-xl bg-pitch-950 border border-pitch-800">
            <span className="text-[11px] text-slate-500 block font-medium">Implied Probability</span>
            <span className="text-xl font-bold font-mono text-slate-300">
              {edgeData.impliedProb ? `${edgeData.impliedProb}%` : '-'}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">1 / Market Odds</span>
          </div>

          {/* Zero-Vig Fair Odds */}
          <div className="p-3 rounded-xl bg-pitch-950 border border-pitch-800">
            <span className="text-[11px] text-slate-500 block font-medium">Zero-Vig Fair Odds</span>
            <span className="text-xl font-bold font-mono text-emerald-400">
              {outcomeStats.fairOdds ? outcomeStats.fairOdds.toFixed(2) : '-'}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Juice Stripped</span>
          </div>

          {/* Bookmaker Vig */}
          <div className="p-3 rounded-xl bg-pitch-950 border border-pitch-800">
            <span className="text-[11px] text-slate-500 block font-medium">Bookmaker Juice</span>
            <span className="text-xl font-bold font-mono text-amber-400">
              {zeroVig?.vigPercent != null ? `${zeroVig.vigPercent}%` : '-'}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Overround (S - 1)</span>
          </div>
        </div>

        {/* Margin of Safety & Value Tier Banner */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-pitch-950 border border-pitch-800 mb-5">
          <div className="flex items-center gap-3">
            <div className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${marginSafety.colorClass}`}>
              {marginSafety.label} ({edgeData.netEdge > 0 ? `+${edgeData.netEdge}%` : `${edgeData.netEdge}%`})
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200">
                Tier: <span className={kelly.tierClass}>{kelly.tier}</span>
              </p>
              <p className="text-[11px] text-slate-400">{marginSafety.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
            <button
              type="button"
              onClick={handleSlipClick}
              className={`px-3 py-1.5 min-h-[40px] rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                isInSlip
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-amber-500 text-pitch-950 hover:bg-amber-400 font-bold'
              }`}
            >
              <span>{isInSlip ? '✓ In Parlay Slip' : '+ Add to Slip'}</span>
            </button>
          </div>
        </div>

        {/* Dynamic Kelly Staking Calculator */}
        <div className="p-4 rounded-xl bg-pitch-950/80 border border-pitch-800 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Theoretical Staking Calculator (Quarter-Kelly)
              </h3>
              <p className="text-xs text-slate-400">
                Mathematical allocation maximizing long-term bankroll growth rate while mitigating drawdown volatility.
              </p>
            </div>

            {/* Bankroll Input */}
            <div className="flex items-center gap-2">
              <label htmlFor="bankroll-input" className="text-xs text-slate-400 font-medium whitespace-nowrap">
                Bankroll:
              </label>
              <div className="relative">
                <input
                  id="bankroll-input"
                  type="number"
                  min="0"
                  step="1000"
                  value={bankroll}
                  onChange={(e) => setBankroll(Number(e.target.value) || 0)}
                  className="w-32 px-3 py-1.5 text-xs font-mono rounded-lg bg-pitch-900 border border-pitch-700 text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Staking Outputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-pitch-800/80">
            <div className="p-2.5 rounded-lg bg-pitch-900 border border-pitch-800">
              <span className="text-[11px] text-slate-400 block font-medium">Recommended Fraction</span>
              <span className="text-lg font-bold font-mono text-amber-400">
                {kelly.quarterKellyPct > 0 ? `${kelly.quarterKellyPct}%` : '0.0%'}
              </span>
              <span className="text-[10px] text-slate-500 block">Quarter-Kelly (Conservative)</span>
            </div>

            <div className="p-2.5 rounded-lg bg-pitch-900 border border-pitch-800">
              <span className="text-[11px] text-slate-400 block font-medium">Recommended Stake Amount</span>
              <span className="text-lg font-bold font-mono text-emerald-400">
                {nominalStake.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-500 block">Nominal Capital</span>
            </div>

            <div className="p-2.5 rounded-lg bg-pitch-900 border border-pitch-800">
              <span className="text-[11px] text-slate-400 block font-medium">Full Kelly Theoretical</span>
              <span className="text-lg font-bold font-mono text-slate-300">
                {kelly.fullKellyPct > 0 ? `${kelly.fullKellyPct}%` : '0.0%'}
              </span>
              <span className="text-[10px] text-slate-500 block">Uncapped Growth Optima</span>
            </div>
          </div>
        </div>

        {/* Monte Carlo Variance Simulation (3,000 Runs) */}
        {sim && (
          <div className="p-4 rounded-xl bg-pitch-950/80 border border-pitch-800 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100">
                  Monte Carlo Match Variance Simulation
                </h3>
                <p className="text-xs text-slate-400">
                  3,000 stochastic match iterations based on Poisson goal expectation.
                </p>
              </div>
              <span className="text-[11px] font-mono font-semibold text-slate-400 bg-pitch-900 px-2 py-0.5 rounded border border-pitch-700">
                3,000 Runs
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
              <div className="p-2 rounded-lg bg-pitch-900 border border-pitch-800">
                <span className="text-[10px] text-slate-500 block">Home Clean Sheet</span>
                <span className="text-sm font-bold font-mono text-sky-400">{sim.homeCleanSheetPct}%</span>
              </div>
              <div className="p-2 rounded-lg bg-pitch-900 border border-pitch-800">
                <span className="text-[10px] text-slate-500 block">Away Clean Sheet</span>
                <span className="text-sm font-bold font-mono text-rose-400">{sim.awayCleanSheetPct}%</span>
              </div>
              <div className="p-2 rounded-lg bg-pitch-900 border border-pitch-800">
                <span className="text-[10px] text-slate-500 block">1-Goal Margin</span>
                <span className="text-sm font-bold font-mono text-amber-400">{sim.margin1Pct}%</span>
              </div>
              <div className="p-2 rounded-lg bg-pitch-900 border border-pitch-800">
                <span className="text-[10px] text-slate-500 block">2+ Goal Margin</span>
                <span className="text-sm font-bold font-mono text-emerald-400">
                  {(sim.margin2Pct + sim.margin3PlusPct).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Total Goal Brackets */}
            <div className="mt-3 pt-2 border-t border-pitch-800 flex items-center justify-between text-xs text-slate-400">
              <span>Goal Brackets:</span>
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span>Low (0-1): <strong className="text-slate-200">{sim.bracketLowPct}%</strong></span>
                <span>Normal (2-3): <strong className="text-emerald-400">{sim.bracketNormalPct}%</strong></span>
                <span>High (4+): <strong className="text-amber-400">{sim.bracketHighPct}%</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="pt-3 border-t border-pitch-800 flex justify-between items-center text-xs text-slate-500">
          <span>Staking based on Kelly criterion: f* = (bp - q) / b</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-pitch-800 hover:bg-pitch-700 text-slate-200 font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
