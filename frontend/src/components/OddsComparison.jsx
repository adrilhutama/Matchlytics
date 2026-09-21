// ---- OddsComparison.jsx ----
// Side-by-side: bookmaker decimal odds vs model's implied fair odds.
// Highlights underpriced selections in amber.

function impliedFairOdds(prob) {
  if (!prob || prob <= 0) return null
  return (100 / prob).toFixed(2)
}

function OddsCell({ label, bookOdds, modelProb, isValue }) {
  const fairOdds = impliedFairOdds(modelProb)
  return (
    <div className={`text-center px-2 py-2 rounded-lg ${isValue ? 'bg-amber-500/10 ring-1 ring-amber-500/30' : 'bg-pitch-900'}`}>
      <p className="text-xs text-slate-500 mb-1 font-medium">{label}</p>
      {/* Bookmaker odds */}
      <p className={`text-base font-semibold tabular-nums ${isValue ? 'text-amber-400' : 'text-slate-200'}`}>
        {bookOdds ? bookOdds.toFixed(2) : <span className="text-slate-600">N/A</span>}
      </p>
      {/* Model fair odds */}
      {fairOdds && (
        <p className="text-xs tabular-nums text-slate-600 mt-0.5">
          fair: {fairOdds}
        </p>
      )}
    </div>
  )
}

export default function OddsComparison({
  oddsHome, oddsDraw, oddsAway,
  probHome, probDraw, probAway,
  valuePick,
}) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">
        Bet365 odds vs model fair
      </p>
      <div className="grid grid-cols-3 gap-2">
        <OddsCell
          label="1 (Home)"
          bookOdds={oddsHome}
          modelProb={probHome}
          isValue={valuePick === 'HOME'}
        />
        <OddsCell
          label="X (Draw)"
          bookOdds={oddsDraw}
          modelProb={probDraw}
          isValue={valuePick === 'DRAW'}
        />
        <OddsCell
          label="2 (Away)"
          bookOdds={oddsAway}
          modelProb={probAway}
          isValue={valuePick === 'AWAY'}
        />
      </div>
    </div>
  )
}
