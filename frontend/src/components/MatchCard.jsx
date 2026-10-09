// ---- MatchCard.jsx ----
// Professional match card with clear visual hierarchy
// Progressive disclosure: compact default, expand for details
// R-02 Compliant: Zero em dashes

import { useState, useMemo } from 'react'
import { Badge, EvBadge, StatusBadge, formatOdds, formatKelly } from './ui'

// Team Logo Component
function TeamLogo({ src, name, side }) {
  const initial = name?.[0] || '?'
  
  return (
    <div className={`flex flex-col items-center gap-1.5 ${side === 'home' ? 'items-end' : 'items-start'}`}>
      <div className="relative">
        {src ? (
          <img
            src={src}
            alt={`${name} crest`}
            className="w-8 h-8 sm:w-10 sm:h-10 object-contain drop-shadow-lg"
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-pitch-700 border border-pitch-600 flex items-center justify-center text-sm font-bold text-slate-300">
            {initial}
          </div>
        )}
        {/* Position indicator */}
        <div className={`absolute -bottom-0.5 ${side === 'home' ? '-right-0.5' : '-left-0.5'} w-2 h-2 rounded-full bg-amber-400 border-2 border-pitch-800`} />
      </div>
      <span className="text-xs font-semibold text-slate-200 max-w-[80px] truncate sm:max-w-[100px]">
        {name}
      </span>
    </div>
  )
}

// Probability Bar Component
function ProbabilityBar({ home, draw, away }) {
  return (
    <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-pitch-700">
      <div
        className="bg-gradient-to-r from-sky-600 to-sky-400 rounded-l-full transition-all duration-500"
        style={{ width: `${home || 0}%` }}
      />
      <div
        className="bg-gradient-to-r from-slate-600 to-slate-400 transition-all duration-500"
        style={{ width: `${draw || 0}%` }}
      />
      <div
        className="bg-gradient-to-r from-rose-400 to-rose-600 rounded-r-full transition-all duration-500"
        style={{ width: `${away || 0}%` }}
      />
    </div>
  )
}

// Odds Display Component
function OddsGroup({ odds, probabilities }) {
  const { home, draw, away } = odds
  const { home: homeProb, draw: drawProb, away: awayProb } = probabilities || {}
  
  return (
    <div className="flex flex-col items-center gap-1 min-w-[80px]">
      {/* Odds Row */}
      <div className="flex items-center gap-2">
        <div className="text-center">
          <span className="block text-xs text-slate-500 font-mono">H</span>
          <span className="block text-base font-bold font-mono text-sky-400">{formatOdds(home)}</span>
        </div>
        <div className="text-center">
          <span className="block text-xs text-slate-500 font-mono">D</span>
          <span className="block text-base font-bold font-mono text-slate-300">{formatOdds(draw)}</span>
        </div>
        <div className="text-center">
          <span className="block text-xs text-slate-500 font-mono">A</span>
          <span className="block text-base font-bold font-mono text-rose-400">{formatOdds(away)}</span>
        </div>
      </div>
      
      {/* Probability Bar */}
      {(homeProb || drawProb || awayProb) && (
        <ProbabilityBar home={homeProb} draw={drawProb} away={awayProb} />
      )}
      
      {/* Probability Labels */}
      {(homeProb || drawProb || awayProb) && (
        <div className="flex gap-2 text-[10px] font-mono">
          <span className="text-sky-400">{homeProb}%</span>
          <span className="text-slate-400">{drawProb}%</span>
          <span className="text-rose-400">{awayProb}%</span>
        </div>
      )}
    </div>
  )
}

// EV & Kelly Section
function EVSection({ ev, kelly, valuePick }) {
  if (ev == null && kelly == null) return null
  
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {ev != null && <EvBadge value={ev} />}
      {kelly != null && (
        <Badge variant="slate" size="sm">
          Kelly: {formatKelly(kelly)}%
        </Badge>
      )}
      {valuePick && (
        <Badge variant="sky" size="sm" dot>
          Model: {valuePick}
        </Badge>
      )}
    </div>
  )
}

// Expandable Details
function MatchDetails({ fixture, isExpanded, onToggle }) {
  if (!isExpanded) return null
  
  return (
    <div className="mt-3 pt-3 border-t border-pitch-700/50 space-y-3 animate-fade-in">
      {/* xG Values */}
      {fixture.lambda_home && (
        <div className="flex items-center gap-4 text-xs font-mono">
          <span>
            <span className="text-slate-500">xG:</span>{' '}
            <span className="text-sky-400 font-semibold">{fixture.lambda_home}</span>
          </span>
          <span className="text-slate-600">v</span>
          <span>
            <span className="text-slate-500">xG:</span>{' '}
            <span className="text-rose-400 font-semibold">{fixture.lambda_away}</span>
          </span>
        </div>
      )}
      
      {/* Additional Markets */}
      <div className="flex flex-wrap gap-2">
        {fixture.prob_over_25 != null && (
          <Badge variant="slate" size="sm">O2.5: {Math.round(fixture.prob_over_25)}%</Badge>
        )}
        {fixture.prob_btts_yes != null && (
          <Badge variant="slate" size="sm">BTTS: {Math.round(fixture.prob_btts_yes)}%</Badge>
        )}
        {fixture.predicted_score && (
          <Badge variant="sky" size="sm">Predicted: {fixture.predicted_score}</Badge>
        )}
      </div>
    </div>
  )
}

// Main MatchCard Component
export default function MatchCard({
  fixture,
  isPinned,
  onToggleWatchlist,
  onSelectForLab,
  quantLocked = false,
  onTriggerUpgrade,
}) {
  if (!fixture) return null
  
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Extract data
  const homeTeam = fixture.home_team?.name || fixture.home_team_name || 'Home'
  const awayTeam = fixture.away_team?.name || fixture.away_team_name || 'Away'
  const homeLogo = fixture.home_team?.crest_url || fixture.home_team_logo
  const awayLogo = fixture.away_team?.crest_url || fixture.away_team_logo
  const league = fixture.league_name || fixture.competition?.name || 'Unknown'
  const kickoff = fixture.kickoff_time || fixture.match_date
  const status = fixture.status || 'SCHEDULED'
  
  // Odds data
  const h2hOdds = fixture?.market_odds?.h2h || {}
  const rawH = typeof h2hOdds.home === 'number' ? h2hOdds.home : (h2hOdds.home?.price || h2hOdds.consensus?.home)
  const rawD = typeof h2hOdds.draw === 'number' ? h2hOdds.draw : (h2hOdds.draw?.price || h2hOdds.consensus?.draw)
  const rawA = typeof h2hOdds.away === 'number' ? h2hOdds.away : (h2hOdds.away?.price || h2hOdds.consensus?.away)
  
  const odds = {
    home: rawH || fixture?.odds_home || fixture?.fair_odds_home || null,
    draw: rawD || fixture?.odds_draw || fixture?.fair_odds_draw || null,
    away: rawA || fixture?.odds_away || fixture?.fair_odds_away || null,
  }
  
  // Probabilities
  const probabilities = {
    home: fixture.prob_home || 0,
    draw: fixture.prob_draw || 0,
    away: fixture.prob_away || 0,
  }
  
  // EV Data
  const ev = fixture.ev_percentage || 0
  const kelly = fixture.kelly_fraction || 0
  const valuePick = fixture.value_pick
  
  // Time formatting
  const timeStr = kickoff 
    ? new Date(kickoff).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '--:--'
  
  const isValue = ev > 0
  
  return (
    <article
      className={`card-base group relative ${isValue ? 'card-value' : ''}`}
      aria-label={`Match: ${homeTeam} vs ${awayTeam}`}
    >
      {/* Status & League Header */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-pitch-700/50">
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <span className="text-[11px] text-slate-500 font-mono">{timeStr}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 hidden sm:inline">{league}</span>
          <Badge variant="slate" size="sm" className="sm:hidden">{league}</Badge>
          {isPinned && (
            <span className="text-amber-400" aria-label="Pinned">★</span>
          )}
        </div>
      </header>
      
      {/* Main Content */}
      <div className="px-4 py-3">
        {/* Teams Row */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <TeamLogo src={homeLogo} name={homeTeam} side="home" />
          
          <OddsGroup odds={odds} probabilities={probabilities} />
          
          <TeamLogo src={awayLogo} name={awayTeam} side="away" />
        </div>
        
        {/* EV & Actions Footer */}
        <footer className="flex items-center justify-between pt-2 border-t border-pitch-700/30">
          <EVSection ev={ev} kelly={kelly} valuePick={valuePick} />
          
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="btn-icon"
              aria-label={isExpanded ? 'Show less' : 'Show more'}
              aria-expanded={isExpanded}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
        </footer>
      </div>
      
      {/* Expandable Details */}
      <MatchDetails
        fixture={fixture}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
      />
      
      {/* Hover overlay actions */}
      <div className="absolute inset-0 bg-pitch-950/0 group-hover:bg-pitch-950/20 transition-colors rounded-[var(--radius-lg)] pointer-events-none" />
    </article>
  )
}

// Compact version for table view rows
export function MatchRow({ fixture, ...props }) {
  if (!fixture) return null
  
  const homeTeam = fixture.home_team?.name || fixture.home_team_name || 'Home'
  const awayTeam = fixture.away_team?.name || fixture.away_team_name || 'Away'
  const ev = fixture.ev_percentage || 0
  const status = fixture.status || 'SCHEDULED'
  
  const h2hOdds = fixture?.market_odds?.h2h || {}
  const rawH = typeof h2hOdds.home === 'number' ? h2hOdds.home : (h2hOdds.home?.price || h2hOdds.consensus?.home)
  const rawD = typeof h2hOdds.draw === 'number' ? h2hOdds.draw : (h2hOdds.draw?.price || h2hOdds.consensus?.draw)
  const rawA = typeof h2hOdds.away === 'number' ? h2hOdds.away : (h2hOdds.away?.price || h2hOdds.consensus?.away)
  
  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-pitch-800/50 transition-colors border-b border-pitch-700/30">
      {/* Status + Time */}
      <div className="flex flex-col items-start gap-0.5 min-w-[70px]">
        <StatusBadge status={status} size="sm" />
        <span className="text-[10px] text-slate-500 font-mono">
          {fixture.kickoff_time 
            ? new Date(fixture.kickoff_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
            : '--:--'
          }
        </span>
      </div>
      
      {/* Teams */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200 truncate">{homeTeam}</span>
          <span className="text-xs text-slate-500">vs</span>
          <span className="text-sm font-semibold text-slate-200 truncate">{awayTeam}</span>
        </div>
        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
          {fixture.league_name || fixture.competition?.name || 'League'}
        </div>
      </div>
      
      {/* Odds */}
      <div className="flex items-center gap-3 font-mono text-sm">
        <span className="text-sky-400 font-semibold">{formatOdds(rawH || fixture?.odds_home)}</span>
        <span className="text-slate-400">{formatOdds(rawD || fixture?.odds_draw)}</span>
        <span className="text-rose-400 font-semibold">{formatOdds(rawA || fixture?.odds_away)}</span>
      </div>
      
      {/* EV */}
      <div className="min-w-[70px]">
        {ev > 0 ? (
          <EvBadge value={ev} size="sm" />
        ) : (
          <span className="text-xs text-slate-600 font-mono">-</span>
        )}
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button type="button" className="btn-icon" aria-label="Add to slip">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button type="button" className="btn-icon" aria-label="Open in Quant Lab">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <path d="M2 12h20" />
          </svg>
        </button>
      </div>
    </div>
  )
}
