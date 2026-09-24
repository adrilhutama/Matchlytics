// ---- CompactTableView.jsx ----
// Dense, high-information table view for rapid scanning of fixtures:
// - Kickoff timing & relative hints
// - Real vs Fair Odds indicators
// - Zero-Vig True Consensus Odds
// - Interactive +EV Badges with Kelly fraction
// - One-click "+ Slip" parlay accumulator integration
// - Triggers for Score Matrix and Kelly Risk modals

import {
  formatLocalizedMatchDate,
  isRealMarketOdds,
  calculateZeroVigOdds,
} from '../utils/analytics'
import ValueBadge from './ValueBadge'

export default function CompactTableView({
  fixtures,
  watchlist,
  onToggleWatchlist,
  onOpenMatrix,
  onOpenQuantModal,
  slipLegs = [],
  onToggleSlip,
}) {
  return (
    <div className="w-full bg-pitch-900 border border-pitch-700 rounded-xl overflow-hidden shadow-lg animate-fade-in">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[920px]">
          <thead>
            <tr className="border-b border-pitch-700/80 bg-pitch-950 text-[11px] uppercase tracking-wider text-slate-400">
              <th scope="col" className="py-3 px-3 w-10 text-center">Pin</th>
              <th scope="col" className="py-3 px-3 w-32">Kickoff</th>
              <th scope="col" className="py-3 px-3">Fixture</th>
              <th scope="col" className="py-3 px-3 w-28">League</th>
              <th scope="col" className="py-3 px-3 w-24 text-center">xG (λ)</th>
              <th scope="col" className="py-3 px-3 w-36 text-center">1 / X / 2 Prob</th>
              <th scope="col" className="py-3 px-3 w-44 text-center">Odds & No-Vig</th>
              <th scope="col" className="py-3 px-3 w-28 text-center">O/U 2.5</th>
              <th scope="col" className="py-3 px-3 w-32 text-center">+EV Pick</th>
              <th scope="col" className="py-3 px-3 w-28 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pitch-800 text-xs">
            {fixtures.map((fixture) => {
              const isPinned = watchlist.includes(fixture.id)
              const hasRealOdds = isRealMarketOdds(fixture)
              const { relativeBadge, timeStr } = formatLocalizedMatchDate(fixture.match_date)

              const probH = fixture.prob_home != null ? Math.round(fixture.prob_home) : '-'
              const probD = fixture.prob_draw != null ? Math.round(fixture.prob_draw) : '-'
              const probA = fixture.prob_away != null ? Math.round(fixture.prob_away) : '-'

              const oddsH = fixture.odds_home ? Number(fixture.odds_home).toFixed(2) : '-'
              const oddsD = fixture.odds_draw ? Number(fixture.odds_draw).toFixed(2) : '-'
              const oddsA = fixture.odds_away ? Number(fixture.odds_away).toFixed(2) : '-'

              const zeroVig = calculateZeroVigOdds(fixture.odds_home, fixture.odds_draw, fixture.odds_away)

              const isFixtureInSlip = slipLegs.some(l => l.fixtureId === fixture.id)

              // Identify odds and prob for the value pick
              let valOdds = null
              let valProb = null
              let valLabel = ''
              if (fixture.value_pick === 'HOME') {
                valOdds = fixture.odds_home
                valProb = fixture.prob_home
                valLabel = `${fixture.home_team_name} Win`
              } else if (fixture.value_pick === 'DRAW') {
                valOdds = fixture.odds_draw
                valProb = fixture.prob_draw
                valLabel = 'Draw (X)'
              } else if (fixture.value_pick === 'AWAY') {
                valOdds = fixture.odds_away
                valProb = fixture.prob_away
                valLabel = `${fixture.away_team_name} Win`
              }

              return (
                <tr
                  key={fixture.id}
                  className={`hover:bg-pitch-800/60 transition-colors ${
                    fixture.value_pick ? 'bg-amber-500/[0.03]' : ''
                  }`}
                >
                  {/* Pin / Star Action */}
                  <td className="py-2.5 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => onToggleWatchlist(fixture.id)}
                      aria-label={isPinned ? `Remove ${fixture.home_team_name} vs ${fixture.away_team_name} from watchlist` : `Add ${fixture.home_team_name} vs ${fixture.away_team_name} to watchlist`}
                      className="p-1 min-h-[32px] min-w-[32px] inline-flex items-center justify-center rounded text-slate-500 hover:text-amber-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
                    >
                      <svg
                        width="16"
                        height="16"
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
                  </td>

                  {/* Kickoff */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className="font-medium text-slate-200 block">{relativeBadge}</span>
                    <span className="text-[11px] text-slate-500 font-mono">{timeStr}</span>
                  </td>

                  {/* Fixture (Teams) */}
                  <td className="py-2.5 px-3">
                    <div className="flex flex-col gap-1 min-w-[190px]">
                      <div className="flex items-center gap-2">
                        {fixture.home_team_logo && (
                          <img
                            src={fixture.home_team_logo}
                            alt=""
                            width={16}
                            height={16}
                            className="w-4 h-4 object-contain flex-shrink-0"
                            onError={(e) => { e.currentTarget.style.display = 'none' }}
                          />
                        )}
                        <span className={`font-semibold truncate ${fixture.value_pick === 'HOME' ? 'text-amber-300' : 'text-slate-200'}`}>
                          {fixture.home_team_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {fixture.away_team_logo && (
                          <img
                            src={fixture.away_team_logo}
                            alt=""
                            width={16}
                            height={16}
                            className="w-4 h-4 object-contain flex-shrink-0"
                            onError={(e) => { e.currentTarget.style.display = 'none' }}
                          />
                        )}
                        <span className={`font-semibold truncate ${fixture.value_pick === 'AWAY' ? 'text-amber-300' : 'text-slate-300'}`}>
                          {fixture.away_team_name}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* League */}
                  <td className="py-2.5 px-3">
                    <span className="text-xs text-slate-400 block truncate max-w-[110px]" title={fixture.league_name}>
                      {fixture.league_name}
                    </span>
                  </td>

                  {/* xG */}
                  <td className="py-2.5 px-3 text-center whitespace-nowrap font-mono text-[11px]">
                    <span className="text-sky-400 font-bold">{fixture.lambda_home ?? '-'}</span>
                    <span className="text-slate-600 mx-1">:</span>
                    <span className="text-rose-400 font-bold">{fixture.lambda_away ?? '-'}</span>
                  </td>

                  {/* 1 / X / 2 Probabilities */}
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    <div className="inline-flex items-center gap-1 font-mono text-[11px]">
                      <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 font-medium">
                        {probH}%
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-300 font-medium">
                        {probD}%
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 font-medium">
                        {probA}%
                      </span>
                    </div>
                  </td>

                  {/* Market Odds & No-Vig */}
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    <div className="inline-flex flex-col items-center gap-0.5">
                      <div className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold">
                        <span className={fixture.value_pick === 'HOME' ? 'text-amber-400 underline font-bold' : 'text-slate-200'}>
                          {oddsH}
                        </span>
                        <span className="text-slate-600">/</span>
                        <span className={fixture.value_pick === 'DRAW' ? 'text-amber-400 underline font-bold' : 'text-slate-200'}>
                          {oddsD}
                        </span>
                        <span className="text-slate-600">/</span>
                        <span className={fixture.value_pick === 'AWAY' ? 'text-amber-400 underline font-bold' : 'text-slate-200'}>
                          {oddsA}
                        </span>
                      </div>
                      <div className="inline-flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
                        {zeroVig ? (
                          <span title="Consensus fair odds with bookmaker juice removed">
                            no-vig: {zeroVig.fairOddsHome.toFixed(2)} / {zeroVig.fairOddsDraw.toFixed(2)} / {zeroVig.fairOddsAway.toFixed(2)}
                          </span>
                        ) : (
                          <span>{hasRealOdds ? '● Bet365' : '○ Model Fair'}</span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* O/U 2.5 */}
                  <td className="py-2.5 px-3 text-center whitespace-nowrap font-mono text-xs">
                    {fixture.prob_over_25 != null ? (
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        fixture.prob_over_25 >= 55
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-pitch-800 text-slate-400'
                      }`}>
                        {fixture.prob_over_25.toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>

                  {/* +EV Pick */}
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    {fixture.value_pick && fixture.ev_percentage ? (
                      <ValueBadge
                        pick={fixture.value_pick}
                        evPct={fixture.ev_percentage}
                        odds={valOdds}
                        modelProb={valProb}
                        onClick={onOpenQuantModal ? () => onOpenQuantModal(fixture) : null}
                      />
                    ) : (
                      <span className="text-slate-600 font-mono">-</span>
                    )}
                  </td>

                  {/* Actions: Matrix, Quant & Slip */}
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenMatrix(fixture)}
                        className="px-2 py-1 min-h-[32px] text-[11px] font-semibold rounded-lg bg-pitch-800 hover:bg-pitch-700 text-slate-300 border border-pitch-700 transition-colors"
                        title="View Poisson score matrix"
                      >
                        Matrix
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenQuantModal && onOpenQuantModal(fixture)}
                        className="px-2 py-1 min-h-[32px] text-[11px] font-semibold rounded-lg bg-pitch-800 hover:bg-amber-500 hover:text-pitch-950 text-slate-300 border border-pitch-700 transition-colors"
                        title="View quantitative risk and Kelly staking"
                      >
                        Quant
                      </button>

                      {onToggleSlip && (valOdds || fixture.odds_home) && (
                        <button
                          type="button"
                          onClick={() => {
                            const pickToUse = fixture.value_pick || 'HOME'
                            const oddsToUse = valOdds || fixture.odds_home
                            const probToUse = valProb || fixture.prob_home
                            const labelToUse = valLabel || `${fixture.home_team_name} Win`
                            onToggleSlip({
                              fixtureId: fixture.id,
                              homeTeam: fixture.home_team_name,
                              awayTeam: fixture.away_team_name,
                              pick: pickToUse,
                              pickLabel: labelToUse,
                              odds: oddsToUse,
                              modelProb: probToUse,
                              ev: fixture.ev_percentage || 0,
                              leagueName: fixture.league_name,
                              matchDate: fixture.match_date,
                            })
                          }}
                          className={`px-2 py-1 min-h-[32px] text-[11px] font-bold rounded-lg transition-colors ${
                            isFixtureInSlip
                              ? 'bg-amber-500 text-pitch-950'
                              : 'bg-pitch-800 hover:bg-pitch-700 text-slate-400 hover:text-amber-400 border border-pitch-700'
                          }`}
                          title={isFixtureInSlip ? 'Remove from slip' : 'Add to parlay slip'}
                        >
                          {isFixtureInSlip ? '✓' : '+Slip'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
