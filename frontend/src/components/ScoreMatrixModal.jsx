// ---- ScoreMatrixModal.jsx ----
// Interactive 6x6 Poisson Score Matrix Heatmap (0-5 x 0-5)
// Calculated dynamically from Poisson lambda (xG) parameters.
// Supports Escape key, backdrop click, focus management.

import { useEffect, useRef, useMemo } from 'react'
import { computePoissonMatrix } from '../utils/analytics'
import FormGuide from './FormGuide'

export default function ScoreMatrixModal({ fixture, isOpen, onClose, standingsMap = {} }) {
  const modalRef = useRef(null)

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

  // Compute matrix dynamically
  const matrixData = useMemo(() => {
    if (!fixture) return null
    return computePoissonMatrix(fixture.lambda_home, fixture.lambda_away, 5)
  }, [fixture])

  if (!isOpen || !fixture || !matrixData) return null

  const homeStandings = standingsMap?.[fixture?.home_team_id] || standingsMap?.[`${fixture?.league_id}_${fixture?.home_team_id}`] || null
  const awayStandings = standingsMap?.[fixture?.away_team_id] || standingsMap?.[`${fixture?.league_id}_${fixture?.away_team_id}`] || null

  const {
    home_team_name, home_team_logo,
    away_team_name, away_team_logo,
    league_name,
    lambda_home, lambda_away,
    predicted_score,
  } = fixture

  const {
    matrix,
    maxProb,
    mostProbable,
    sumHomeWin,
    sumDraw,
    sumAwayWin,
    sumOver25,
    sumBtts,
  } = matrixData

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-pitch-950/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="matrix-modal-title"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl bg-pitch-900 border border-pitch-700 rounded-2xl p-4 sm:p-6 shadow-2xl overflow-y-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close score matrix modal"
          className="absolute top-4 right-4 w-9 h-9 min-h-[36px] flex items-center justify-center rounded-lg bg-pitch-800 text-slate-400 hover:text-slate-100 hover:bg-pitch-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Modal Header */}
        <div className="mb-5 pr-8">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            {league_name || 'Match Analytics'}
          </span>
          <h2 id="matrix-modal-title" className="text-lg sm:text-xl font-bold text-slate-100 mt-0.5">
            Poisson Scoreline Matrix (0-5 Goals)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Dynamic probability heatmap based on estimated attacking and defensive goal expectation.
          </p>
        </div>

        {/* Teams & xG Strip */}
        <div className="grid grid-cols-2 gap-3 mb-5 p-3 rounded-xl bg-pitch-950/80 border border-pitch-800">
          {/* Home */}
          <div className="flex items-center gap-2.5 min-w-0">
            {home_team_logo && (
              <img
                src={home_team_logo}
                alt=""
                width={28}
                height={28}
                className="w-7 h-7 object-contain flex-shrink-0"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            )}
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-slate-200 truncate">{home_team_name}</p>
              <p className="text-xs text-sky-400 font-mono">xG λ: {lambda_home ?? '1.35'}</p>
            </div>
          </div>

          {/* Away */}
          <div className="flex items-center gap-2.5 min-w-0 justify-end text-right">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-slate-200 truncate">{away_team_name}</p>
              <p className="text-xs text-rose-400 font-mono">xG λ: {lambda_away ?? '1.35'}</p>
            </div>
            {away_team_logo && (
              <img
                src={away_team_logo}
                alt=""
                width={28}
                height={28}
                className="w-7 h-7 object-contain flex-shrink-0"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            )}
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="overflow-x-auto pb-2 mb-5">
          <div className="min-w-[360px]">
            {/* Column Label: Home Goals */}
            <div className="text-center text-xs font-semibold text-sky-400 mb-2">
              ← {home_team_name} (Home Goals) →
            </div>

            <table className="w-full text-center border-collapse">
              <thead>
                <tr>
                  <th className="text-[11px] font-medium text-slate-500 p-1.5 w-16 text-left">
                    Away ↓
                  </th>
                  {[0, 1, 2, 3, 4, 5].map((h) => (
                    <th key={h} className="text-xs font-bold text-slate-300 p-1.5 bg-pitch-950/60 rounded-t border-b border-pitch-800">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row, awayGoals) => (
                  <tr key={awayGoals}>
                    <th className="text-xs font-bold text-rose-400 p-1.5 text-left bg-pitch-950/60 rounded-l border-r border-pitch-800">
                      {awayGoals}
                    </th>
                    {row.map((cell) => {
                      const isTop = cell.home === mostProbable.home && cell.away === mostProbable.away
                      const ratio = maxProb > 0 ? cell.prob / maxProb : 0
                      const bgAlpha = Math.max(0.08, ratio * 0.75)
                      const isPredicted = predicted_score === `${cell.home}-${cell.away}`

                      return (
                        <td
                          key={cell.home}
                          className={`p-1 relative transition-all duration-150 ${
                            isTop || isPredicted
                              ? 'ring-2 ring-amber-400/80 rounded z-10'
                              : 'hover:ring-1 hover:ring-slate-400/50'
                          }`}
                          style={{
                            backgroundColor: `rgba(245, 158, 11, ${bgAlpha})`,
                          }}
                          title={`${home_team_name} ${cell.home} - ${cell.away} ${away_team_name}: ${cell.prob.toFixed(2)}%`}
                        >
                          <div className="py-1.5 px-0.5 rounded flex flex-col items-center justify-center">
                            <span className="text-[11px] font-mono font-medium text-slate-300">
                              {cell.home}-{cell.away}
                            </span>
                            <span className={`text-[10px] font-mono font-bold ${
                              ratio > 0.6 ? 'text-amber-200' : 'text-slate-400'
                            }`}>
                              {cell.prob.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-left text-[11px] font-semibold text-rose-400 mt-2">
              ↑ {away_team_name} (Away Goals)
            </div>
          </div>
        </div>

        {/* Most Likely Scoreline Highlight */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-semibold text-amber-300">Most Probable Scoreline:</span>
            <span className="text-sm font-bold text-amber-200 font-mono">
              {mostProbable.home} - {mostProbable.away}
            </span>
          </div>
          <span className="text-xs font-mono font-semibold text-amber-400">
            {mostProbable.prob.toFixed(1)}% probability
          </span>
        </div>

        {/* Aggregated Totals Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
          <div className="p-2 rounded-lg bg-pitch-950 border border-pitch-800">
            <p className="text-[10px] text-slate-500 font-medium">Home Win</p>
            <p className="text-sm font-bold text-sky-400 font-mono">{sumHomeWin}%</p>
          </div>
          <div className="p-2 rounded-lg bg-pitch-950 border border-pitch-800">
            <p className="text-[10px] text-slate-500 font-medium">Draw</p>
            <p className="text-sm font-bold text-slate-300 font-mono">{sumDraw}%</p>
          </div>
          <div className="p-2 rounded-lg bg-pitch-950 border border-pitch-800">
            <p className="text-[10px] text-slate-500 font-medium">Away Win</p>
            <p className="text-sm font-bold text-rose-400 font-mono">{sumAwayWin}%</p>
          </div>
          <div className="p-2 rounded-lg bg-pitch-950 border border-pitch-800">
            <p className="text-[10px] text-slate-500 font-medium">Over 2.5</p>
            <p className="text-sm font-bold text-emerald-400 font-mono">{sumOver25}%</p>
          </div>
          <div className="p-2 rounded-lg bg-pitch-950 border border-pitch-800 col-span-2 sm:col-span-1">
            <p className="text-[10px] text-slate-500 font-medium">BTTS (Yes)</p>
            <p className="text-sm font-bold text-amber-400 font-mono">{sumBtts}%</p>
          </div>
        </div>

        {/* Footer info note */}
        <div className="mt-4 pt-3 border-t border-pitch-800 flex justify-between items-center text-[11px] text-slate-500">
          <span>Formula: P(x, y) = P(x; λh) × P(y; λa)</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-pitch-800 hover:bg-pitch-700 text-slate-300 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
