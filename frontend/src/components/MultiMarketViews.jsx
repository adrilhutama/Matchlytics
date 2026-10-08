// ---- MultiMarketViews.jsx ----
// Interactive quantitative multi-market disclosure:
// 1. Totals (Over / Under) across lines 1.5, 2.5, 3.5 with model vs bookmaker odds.
// 2. Asian Handicap (Spreads) across lines -1.0, -0.5, 0.0, +0.5, +1.0.
// Zero em dash characters used (R-02 compliance).

import { useMemo } from 'react'
import { calculateMarketEV } from '../utils/analytics'

export function TotalsMarketView({
  totalsProbs = {},
  marketTotals = {},
  fallbackOver25 = null,
  slipPicks = [],
  onToggleSlip,
  homeTeam = 'Home',
  awayTeam = 'Away',
  fixtureId,
  leagueName,
  matchDate,
}) {
  const lines = ['1.5', '2.5', '3.5']

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
          Totals (Over / Under) Goal Lines
        </p>
        <span className="text-[10px] text-slate-500 font-mono">
          Model Implied vs Bookmaker Price
        </span>
      </div>

      <div className="space-y-2">
        {lines.map((line) => {
          const probOver = totalsProbs[line]?.over ?? (line === '2.5' && fallbackOver25 != null ? Number(fallbackOver25) : 50.0)
          const probUnder = totalsProbs[line]?.under ?? Math.max(0, 100 - probOver)

          const bookOddsOver = marketTotals[line]?.over ?? null
          const bookOddsUnder = marketTotals[line]?.under ?? null

          const fairOddsOver = probOver > 0 ? (100 / probOver).toFixed(2) : null
          const fairOddsUnder = probUnder > 0 ? (100 / probUnder).toFixed(2) : null

          const evOver = bookOddsOver ? calculateMarketEV(probOver, bookOddsOver) : null
          const evUnder = bookOddsUnder ? calculateMarketEV(probUnder, bookOddsUnder) : null

          const pickOverKey = `TOTAL_${line}_OVER`
          const pickUnderKey = `TOTAL_${line}_UNDER`
          const isOverInSlip = slipPicks.includes(pickOverKey)
          const isUnderInSlip = slipPicks.includes(pickUnderKey)

          return (
            <div
              key={line}
              className="p-2 rounded-xl bg-pitch-900 border border-pitch-800 flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between text-[11px] font-mono border-b border-pitch-800/60 pb-1">
                <span className="font-bold text-slate-200">Line {line} Goals</span>
                <span className="text-slate-500">
                  {bookOddsOver && bookOddsUnder ? 'Consensus Sharp' : 'Model Fair'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Over Cell */}
                <div
                  className={`p-2 rounded-lg border text-center transition-all flex flex-col justify-between ${
                    evOver && evOver >= 2.0
                      ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/20'
                      : 'bg-pitch-950/60 border-pitch-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] font-semibold text-slate-400">Over {line}</span>
                      {evOver && evOver >= 2.0 && (
                        <span className="text-[9px] font-bold px-1 rounded bg-amber-500 text-pitch-950">
                          +{evOver}% EV
                        </span>
                      )}
                    </div>
                    <p className={`text-sm font-bold font-mono ${evOver && evOver >= 2.0 ? 'text-amber-400' : 'text-slate-100'}`}>
                      {bookOddsOver ? Number(bookOddsOver).toFixed(2) : (fairOddsOver || 'N/A')}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      prob: <span className="text-slate-300 font-semibold">{probOver.toFixed(1)}%</span>
                      {fairOddsOver && <span className="ml-1 text-slate-500">fair: {fairOddsOver}</span>}
                    </p>
                  </div>

                  {onToggleSlip && (
                    <button
                      type="button"
                      onClick={() => onToggleSlip({
                        fixtureId,
                        homeTeam,
                        awayTeam,
                        market: 'totals',
                        pick: pickOverKey,
                        pickLabel: `${homeTeam} vs ${awayTeam}: Over ${line} Goals`,
                        odds: bookOddsOver || fairOddsOver || 1.90,
                        modelProb: probOver,
                        ev: evOver || 0,
                        leagueName,
                        matchDate,
                      })}
                      className={`mt-2 py-1 px-2 min-h-[44px] rounded-lg text-xs font-bold transition-all active:scale-95 touch-manipulation ${
                        isOverInSlip
                          ? 'bg-amber-500 text-pitch-950 font-extrabold shadow'
                          : 'bg-pitch-800 hover:bg-pitch-700 text-slate-200 hover:text-amber-400'
                      }`}
                    >
                      {isOverInSlip ? '✓ In Slip' : '+ Slip'}
                    </button>
                  )}
                </div>

                {/* Under Cell */}
                <div
                  className={`p-2 rounded-lg border text-center transition-all flex flex-col justify-between ${
                    evUnder && evUnder >= 2.0
                      ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/20'
                      : 'bg-pitch-950/60 border-pitch-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] font-semibold text-slate-400">Under {line}</span>
                      {evUnder && evUnder >= 2.0 && (
                        <span className="text-[9px] font-bold px-1 rounded bg-amber-500 text-pitch-950">
                          +{evUnder}% EV
                        </span>
                      )}
                    </div>
                    <p className={`text-sm font-bold font-mono ${evUnder && evUnder >= 2.0 ? 'text-amber-400' : 'text-slate-100'}`}>
                      {bookOddsUnder ? Number(bookOddsUnder).toFixed(2) : (fairOddsUnder || 'N/A')}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      prob: <span className="text-slate-300 font-semibold">{probUnder.toFixed(1)}%</span>
                      {fairOddsUnder && <span className="ml-1 text-slate-500">fair: {fairOddsUnder}</span>}
                    </p>
                  </div>

                  {onToggleSlip && (
                    <button
                      type="button"
                      onClick={() => onToggleSlip({
                        fixtureId,
                        homeTeam,
                        awayTeam,
                        market: 'totals',
                        pick: pickUnderKey,
                        pickLabel: `${homeTeam} vs ${awayTeam}: Under ${line} Goals`,
                        odds: bookOddsUnder || fairOddsUnder || 1.90,
                        modelProb: probUnder,
                        ev: evUnder || 0,
                        leagueName,
                        matchDate,
                      })}
                      className={`mt-2 py-1 px-2 min-h-[44px] rounded-lg text-xs font-bold transition-all active:scale-95 touch-manipulation ${
                        isUnderInSlip
                          ? 'bg-amber-500 text-pitch-950 font-extrabold shadow'
                          : 'bg-pitch-800 hover:bg-pitch-700 text-slate-200 hover:text-amber-400'
                      }`}
                    >
                      {isUnderInSlip ? '✓ In Slip' : '+ Slip'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function SpreadsMarketView({
  spreadsProbs = {},
  marketSpreads = {},
  slipPicks = [],
  onToggleSlip,
  homeTeam = 'Home',
  awayTeam = 'Away',
  fixtureId,
  leagueName,
  matchDate,
}) {
  const displayLines = ['-0.5', '0.0', '+0.5', '-1.0', '+1.0']

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
          Asian Handicap Lines
        </p>
        <span className="text-[10px] text-slate-500 font-mono">
          2-Way Spread with Push Refund
        </span>
      </div>

      <div className="space-y-2">
        {displayLines.map((line) => {
          const probHome = spreadsProbs[line]?.home ?? 50.0
          const probAway = spreadsProbs[line]?.away ?? 50.0
          const probPush = spreadsProbs[line]?.push ?? 0.0

          const bookOddsHome = marketSpreads[line]?.home ?? null
          const bookOddsAway = marketSpreads[line]?.away ?? null

          const fairOddsHome = probHome > 0 ? (100 / probHome).toFixed(2) : null
          const fairOddsAway = probAway > 0 ? (100 / probAway).toFixed(2) : null

          const evHome = bookOddsHome ? calculateMarketEV(probHome, bookOddsHome, probPush) : null
          const evAway = bookOddsAway ? calculateMarketEV(probAway, bookOddsAway, probPush) : null

          const pickHomeKey = `SPREAD_${line}_HOME`
          const pickAwayKey = `SPREAD_${line}_AWAY`
          const isHomeInSlip = slipPicks.includes(pickHomeKey)
          const isAwayInSlip = slipPicks.includes(pickAwayKey)

          // Inverse label for away team
          const awayLineLabel = line.startsWith('+') ? line.replace('+', '-') : (line === '0.0' ? '0.0' : `+${Math.abs(Number(line))}`)

          return (
            <div
              key={line}
              className="p-2 rounded-xl bg-pitch-900 border border-pitch-800 flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between text-[11px] font-mono border-b border-pitch-800/60 pb-1">
                <span className="font-bold text-slate-200">
                  {homeTeam} ({line}) vs {awayTeam} ({awayLineLabel})
                </span>
                {probPush > 0 && (
                  <span className="text-sky-400/90 font-medium">
                    Push: {probPush.toFixed(1)}%
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Home Cover Cell */}
                <div
                  className={`p-2 rounded-lg border text-center transition-all flex flex-col justify-between ${
                    evHome && evHome >= 2.0
                      ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/20'
                      : 'bg-pitch-950/60 border-pitch-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] font-semibold text-slate-400 truncate max-w-[100px]" title={`${homeTeam} ${line}`}>
                        {homeTeam} {line}
                      </span>
                      {evHome && evHome >= 2.0 && (
                        <span className="text-[9px] font-bold px-1 rounded bg-amber-500 text-pitch-950">
                          +{evHome}% EV
                        </span>
                      )}
                    </div>
                    <p className={`text-sm font-bold font-mono ${evHome && evHome >= 2.0 ? 'text-amber-400' : 'text-slate-100'}`}>
                      {bookOddsHome ? Number(bookOddsHome).toFixed(2) : (fairOddsHome || 'N/A')}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      cover: <span className="text-slate-300 font-semibold">{probHome.toFixed(1)}%</span>
                      {fairOddsHome && <span className="ml-1 text-slate-500">fair: {fairOddsHome}</span>}
                    </p>
                  </div>

                  {onToggleSlip && (
                    <button
                      type="button"
                      onClick={() => onToggleSlip({
                        fixtureId,
                        homeTeam,
                        awayTeam,
                        market: 'spreads',
                        pick: pickHomeKey,
                        pickLabel: `${homeTeam} ${line} Asian Handicap`,
                        odds: bookOddsHome || fairOddsHome || 1.90,
                        modelProb: probHome,
                        ev: evHome || 0,
                        leagueName,
                        matchDate,
                      })}
                      className={`mt-2 py-1 px-2 min-h-[44px] rounded-lg text-xs font-bold transition-all active:scale-95 touch-manipulation ${
                        isHomeInSlip
                          ? 'bg-amber-500 text-pitch-950 font-extrabold shadow'
                          : 'bg-pitch-800 hover:bg-pitch-700 text-slate-200 hover:text-amber-400'
                      }`}
                    >
                      {isHomeInSlip ? '✓ In Slip' : '+ Slip'}
                    </button>
                  )}
                </div>

                {/* Away Cover Cell */}
                <div
                  className={`p-2 rounded-lg border text-center transition-all flex flex-col justify-between ${
                    evAway && evAway >= 2.0
                      ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/20'
                      : 'bg-pitch-950/60 border-pitch-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] font-semibold text-slate-400 truncate max-w-[100px]" title={`${awayTeam} ${awayLineLabel}`}>
                        {awayTeam} {awayLineLabel}
                      </span>
                      {evAway && evAway >= 2.0 && (
                        <span className="text-[9px] font-bold px-1 rounded bg-amber-500 text-pitch-950">
                          +{evAway}% EV
                        </span>
                      )}
                    </div>
                    <p className={`text-sm font-bold font-mono ${evAway && evAway >= 2.0 ? 'text-amber-400' : 'text-slate-100'}`}>
                      {bookOddsAway ? Number(bookOddsAway).toFixed(2) : (fairOddsAway || 'N/A')}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      cover: <span className="text-slate-300 font-semibold">{probAway.toFixed(1)}%</span>
                      {fairOddsAway && <span className="ml-1 text-slate-500">fair: {fairOddsAway}</span>}
                    </p>
                  </div>

                  {onToggleSlip && (
                    <button
                      type="button"
                      onClick={() => onToggleSlip({
                        fixtureId,
                        homeTeam,
                        awayTeam,
                        market: 'spreads',
                        pick: pickAwayKey,
                        pickLabel: `${awayTeam} ${awayLineLabel} Asian Handicap`,
                        odds: bookOddsAway || fairOddsAway || 1.90,
                        modelProb: probAway,
                        ev: evAway || 0,
                        leagueName,
                        matchDate,
                      })}
                      className={`mt-2 py-1 px-2 min-h-[44px] rounded-lg text-xs font-bold transition-all active:scale-95 touch-manipulation ${
                        isAwayInSlip
                          ? 'bg-amber-500 text-pitch-950 font-extrabold shadow'
                          : 'bg-pitch-800 hover:bg-pitch-700 text-slate-200 hover:text-amber-400'
                      }`}
                    >
                      {isAwayInSlip ? '✓ In Slip' : '+ Slip'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
