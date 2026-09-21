// ---- MatchCard.jsx ----
// The primary data display unit. Layout mirrors how analysts read match data:
// team identities top, probability cluster middle, odds comparison bottom.
// Value bet badge appears only when ev detected — it's the single amber glow element.

import ProbabilityBar from './ProbabilityBar'
import OddsComparison from './OddsComparison'
import ValueBadge from './ValueBadge'

// ---- Date/time formatting ----------------------------------

function formatMatchDate(isoString) {
  if (!isoString) return { date: 'TBD', time: '' }
  const d = new Date(isoString)
  return {
    date: d.toLocaleDateString(undefined, {
      weekday: 'short',
      month:   'short',
      day:     'numeric',
    }),
    time: d.toLocaleTimeString(undefined, {
      hour:   '2-digit',
      minute: '2-digit',
    }),
  }
}

// ---- Team logo with fallback ----------------------------------

function TeamLogo({ src, name }) {
  return (
    <div className="w-11 h-11 flex-shrink-0">
      {src ? (
        <img
          src={src}
          alt={`${name} crest`}
          width={44}
          height={44}
          className="w-full h-full object-contain"
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      ) : (
        // Initial fallback if logo URL is missing
        <div className="w-full h-full rounded-full bg-pitch-700 flex items-center justify-center text-sm font-bold text-slate-400">
          {name?.[0] ?? '?'}
        </div>
      )}
    </div>
  )
}

// ---- Over/Under + BTTS badges --------------------------------

function MarketBadge({ label, value, positive }) {
  if (value == null) return null
  return (
    <span
      className={[
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium tabular-nums',
        positive
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
          : 'bg-slate-500/15 text-slate-400 border border-slate-600/25',
      ].join(' ')}
    >
      {label} {value.toFixed(0)}%
    </span>
  )
}

// ---- Lambda display ------------------------------------------

function LambdaRow({ lambdaHome, lambdaAway }) {
  if (!lambdaHome && !lambdaAway) return null
  return (
    <p className="text-xs text-slate-600 tabular-nums">
      xG model:{' '}
      <span className="text-sky-600">{lambdaHome ?? '?'}</span>
      {' '}vs{' '}
      <span className="text-rose-600">{lambdaAway ?? '?'}</span>
    </p>
  )
}

// ---- Main card -----------------------------------------------

export default function MatchCard({ fixture, style }) {
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

  const { date: matchDate, time: matchTime } = formatMatchDate(match_date)
  const isValue = Boolean(value_pick)

  return (
    <article
      className={`match-card ${isValue ? 'match-card--value' : ''} p-5 animate-slide-up`}
      style={style}
      aria-label={`${home_team_name} vs ${away_team_name}, ${matchDate}`}
    >
      {/* ---- Header: league + date ---- */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 min-w-0">
          {league_logo && (
            <img
              src={league_logo}
              alt=""
              width={16}
              height={16}
              className="w-4 h-4 object-contain flex-shrink-0"
              loading="lazy"
              aria-hidden="true"
            />
          )}
          <span className="text-xs text-slate-500 font-medium truncate">
            {league_name}
          </span>
        </div>
        <div className="flex-shrink-0 text-right">
          <span className="text-xs text-slate-400 font-medium tabular-nums">{matchDate}</span>
          {matchTime && (
            <span className="text-xs text-slate-600 ml-1.5 tabular-nums">{matchTime}</span>
          )}
        </div>
      </div>

      {/* ---- Teams ---- */}
      <div className="flex items-center justify-between gap-4 mb-5">
        {/* Home */}
        <div className="flex flex-col items-center gap-2 flex-1">
          <TeamLogo src={home_team_logo} name={home_team_name} />
          <span className="text-sm font-semibold text-slate-200 text-center leading-tight">
            {home_team_name}
          </span>
        </div>

        {/* Centre: predicted score + metadata */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
          {predicted_score ? (
            <div className="text-center">
              <p className="text-xs text-slate-600 mb-0.5 font-medium">Predicted</p>
              <p className="text-2xl font-bold text-slate-100 tabular-nums tracking-tight leading-none">
                {predicted_score}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-600">vs</p>
          )}
          <LambdaRow lambdaHome={lambda_home} lambdaAway={lambda_away} />
        </div>

        {/* Away */}
        <div className="flex flex-col items-center gap-2 flex-1">
          <TeamLogo src={away_team_logo} name={away_team_name} />
          <span className="text-sm font-semibold text-slate-200 text-center leading-tight">
            {away_team_name}
          </span>
        </div>
      </div>

      {/* ---- Market badges (Over 2.5 + BTTS) ---- */}
      {(prob_over_25 != null || prob_btts != null) && (
        <div className="flex items-center gap-2 mb-4">
          <MarketBadge label="O/U 2.5" value={prob_over_25} positive={prob_over_25 >= 55} />
          <MarketBadge label="BTTS"    value={prob_btts}    positive={prob_btts >= 55} />
        </div>
      )}

      {/* ---- Probability bars ---- */}
      {(prob_home != null || prob_draw != null || prob_away != null) && (
        <div className="mb-5">
          <ProbabilityBar
            probHome={prob_home}
            probDraw={prob_draw}
            probAway={prob_away}
          />
        </div>
      )}

      {/* ---- Odds comparison ---- */}
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
          />
        </div>
      )}

      {/* ---- Value bet badge — only renders if EV detected ---- */}
      {isValue && (
        <div className="pt-3 border-t border-pitch-700/60 flex justify-between items-center">
          <ValueBadge pick={value_pick} evPct={ev_percentage} />
          <p className="text-xs text-slate-600">EV = (prob × odds) − 1</p>
        </div>
      )}

      {/* ---- No odds state ---- */}
      {!odds_home && !odds_draw && !odds_away && prob_home != null && (
        <p className="text-xs text-slate-600 mt-2 italic">
          Bet365 odds not yet available for this fixture.
        </p>
      )}

      {/* ---- No analytics state (metadata only) ---- */}
      {prob_home == null && (
        <p className="text-xs text-slate-600 mt-2 italic">
          Analytics pending — daily sync will populate at 06:00 UTC.
        </p>
      )}
    </article>
  )
}
