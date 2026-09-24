// ---- OddsComparison.jsx ----
// Side-by-side: Bookmaker decimal odds vs Zero-Vig true odds vs Model fair odds.
// Integrates "+ Slip" toggle per outcome and highlights +EV opportunities.

import { useMemo } from 'react'
import { calculateZeroVigOdds } from '../utils/analytics'

function OddsCell({
  label,
  bookOdds,
  modelProb,
  zeroVigOdds,
  isValue,
  isInSlip,
  onToggleSlip,
  onOpenQuant,
}) {
  const fairOdds = modelProb && modelProb > 0 ? (100 / modelProb).toFixed(2) : null

  return (
    <div
      className={`text-center p-2.5 rounded-xl border flex flex-col justify-between transition-all ${
        isValue
          ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/20'
          : 'bg-pitch-900 border-pitch-700/80 hover:border-pitch-600'
      }`}
    >
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-slate-400 font-semibold">{label}</span>
          {isValue && (
            <span className="text-[9px] font-bold px-1 rounded bg-amber-500 text-pitch-950">
              +EV
            </span>
          )}
        </div>

        {/* Bookmaker Odds */}
        <p className={`text-base font-bold tabular-nums font-mono ${isValue ? 'text-amber-400' : 'text-slate-100'}`}>
          {bookOdds ? Number(bookOdds).toFixed(2) : <span className="text-slate-600">N/A</span>}
        </p>

        {/* Zero-Vig True Consensus Odds */}
        {zeroVigOdds && (
          <p className="text-[10px] tabular-nums text-emerald-400/90 font-mono mt-0.5" title="Consensus fair odds with bookmaker juice removed">
            no-vig: {zeroVigOdds.toFixed(2)}
          </p>
        )}

        {/* Model Fair Odds */}
        {fairOdds && (
          <p className="text-[10px] tabular-nums text-slate-500 font-mono" title="Model implied fair odds based on Poisson goal expectation">
            fair: {fairOdds}
          </p>
        )}
      </div>

      {/* Slip Add / Remove Button */}
      {onToggleSlip && bookOdds && (
        <div className="mt-2 pt-1.5 border-t border-pitch-800 flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleSlip()
            }}
            className={`w-full py-1 px-1.5 min-h-[30px] rounded-lg text-[10px] font-bold transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 ${
              isInSlip
                ? 'bg-amber-500 text-pitch-950'
                : 'bg-pitch-800 text-slate-300 hover:bg-pitch-700 hover:text-amber-400'
            }`}
          >
            {isInSlip ? '✓ In Slip' : '+ Slip'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function OddsComparison({
  oddsHome, oddsDraw, oddsAway,
  probHome, probDraw, probAway,
  valuePick,
  slipPicks = [],
  onToggleSlipPick,
  onOpenQuant,
}) {
  const zeroVig = useMemo(() => {
    return calculateZeroVigOdds(oddsHome, oddsDraw, oddsAway)
  }, [oddsHome, oddsDraw, oddsAway])

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
          Market Odds vs No-Vig vs Fair
        </p>
        {zeroVig && (
          <span className="text-[10px] text-slate-500 font-mono">
            Juice: <strong className="text-amber-400">{zeroVig.vigPercent}%</strong>
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <OddsCell
          label="1 (Home)"
          bookOdds={oddsHome}
          modelProb={probHome}
          zeroVigOdds={zeroVig?.fairOddsHome}
          isValue={valuePick === 'HOME'}
          isInSlip={slipPicks.includes('HOME')}
          onToggleSlip={onToggleSlipPick ? () => onToggleSlipPick('HOME', oddsHome, probHome, 'Home Win') : null}
          onOpenQuant={onOpenQuant}
        />
        <OddsCell
          label="X (Draw)"
          bookOdds={oddsDraw}
          modelProb={probDraw}
          zeroVigOdds={zeroVig?.fairOddsDraw}
          isValue={valuePick === 'DRAW'}
          isInSlip={slipPicks.includes('DRAW')}
          onToggleSlip={onToggleSlipPick ? () => onToggleSlipPick('DRAW', oddsDraw, probDraw, 'Draw (X)') : null}
          onOpenQuant={onOpenQuant}
        />
        <OddsCell
          label="2 (Away)"
          bookOdds={oddsAway}
          modelProb={probAway}
          zeroVigOdds={zeroVig?.fairOddsAway}
          isValue={valuePick === 'AWAY'}
          isInSlip={slipPicks.includes('AWAY')}
          onToggleSlip={onToggleSlipPick ? () => onToggleSlipPick('AWAY', oddsAway, probAway, 'Away Win') : null}
          onOpenQuant={onOpenQuant}
        />
      </div>
    </div>
  )
}
