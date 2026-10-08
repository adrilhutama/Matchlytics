// ---- DailyPicksModal.jsx ----
// Institutional-grade daily curated betting slip popup.
// Tier-gated: Free sees singles only; Pro unlocks 2-leg parlay; Institutional
// unlocks 3-leg and 4-leg multipliers.
// Dismiss tracking via localStorage per date key.
// Zero em dash characters (R-02 compliance).

import { useState, useEffect, useCallback } from 'react'
import { buildDailyPicks } from '../utils/dailyPicksEngine'
import { useAuth } from '../context/AuthContext'

const DISABLED_MARKET_ICONS = {
  h2h: '\u{1F494}',
  totals: '\u{1F52C}',
  spreads: '\u{1F4C8}',
}

const DISABLED_MARKET_LABELS = {
  h2h: '1X2',
  totals: 'Totals',
  spreads: 'Spreads',
}

function MarketBadge({ market }) {
  const colorMap = {
    h2h:   'bg-sky-500/15 text-sky-300 border-sky-500/30',
    totals:'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    spreads:'bg-amber-500/15 text-amber-300 border-amber-500/30',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${colorMap[market] || colorMap.h2h}`}>
      {DISABLED_MARKET_LABELS[market] || market}
    </span>
  )
}

function LockOverlay({ children }) {
  return (
    <div className="relative rounded-xl overflow-hidden">
      {children}
      <div className="absolute inset-0 bg-pitch-950/75 backdrop-blur-sm flex flex-col items-center justify-center gap-2 p-6">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <p className="text-xs font-mono text-slate-400 text-center">{children.props.lockText}</p>
      </div>
    </div>
  )
}

function SingleCard({ card, onAddToSlip, isInSlip }) {
  return (
    <div className={`rounded-xl border p-4 transition-all hover:border-amber-500/40 ${
      isInSlip ? 'border-amber-500/50 bg-amber-500/5' : 'border-pitch-700 bg-pitch-950'
    }`}>
      <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2">
        <div>
          <p className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
            <span>{card.matchLabel.split(' vs ')[0]}</span>
            <span className="text-slate-500 font-normal">vs</span>
            <span>{card.matchLabel.split(' vs ')[1]}</span>
          </p>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono text-slate-400">
            <span className="font-semibold text-amber-400/90">{card.league}</span>
            <span className="text-slate-600">•</span>
            <span>{card.timeStr}</span>
          </div>
        </div>
        <MarketBadge market={card.market} />
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3">
        <div>
          <p className="text-[9px] text-slate-600 font-mono uppercase">Pick</p>
          <p className="text-xs font-mono text-slate-200">{card.selection}</p>
        </div>
        <div>
          <p className="text-[9px] text-slate-600 font-mono uppercase">Odds</p>
          <p className="text-xs font-mono text-slate-200">{card.odds}</p>
        </div>
        <div>
          <p className="text-[9px] text-slate-600 font-mono uppercase">Model %</p>
          <p className="text-xs font-mono text-emerald-400">{card.modelProb}%</p>
        </div>
        <div>
          <p className="text-[9px] text-slate-600 font-mono uppercase">+EV</p>
          <p className="text-xs font-mono text-amber-400 font-bold">+{card.evPercent}%</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onAddToSlip(card)}
        disabled={isInSlip}
        className={`w-full py-1.5 rounded-lg text-[11px] font-mono font-bold transition-colors min-h-[32px] ${
          isInSlip
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            : 'bg-amber-500 hover:bg-amber-400 text-pitch-950'
        }`}
      >
        {isInSlip ? '✓ Added to Slip' : '+ Add to Slip'}
      </button>
    </div>
  )
}

function ParlayCard({ parlay, tierAccess, onAddToSlip }) {
  if (!parlay) return null

  const totalOdds = parseFloat(parlay.totalOdds)
  const isFreeUser = !tierAccess
  const locked = !tierAccess

  return (
    <LockOverlay lockText={isFreeUser ? 'Upgrade to Pro to unlock daily 2-team parlays' : 'Upgrade to Institutional for high-multiplier multi-leg slips'}>
      <div className="rounded-xl border border-pitch-700 bg-pitch-950 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-bold text-slate-100">{parlay.legCount}-Team Parlay</p>
            <p className="text-[10px] font-mono text-slate-500 mt-0.5">Combined odds: <span className="text-amber-400">{parlay.totalOdds}</span>x</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-500 font-mono">Model Prob</p>
            <p className="text-xs font-mono text-emerald-400">{parlay.combinedProb}%</p>
          </div>
        </div>

        <div className="space-y-2 mb-3">
          {parlay.legs.map((leg, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-5 h-5 rounded-full bg-pitch-800 flex items-center justify-center text-[10px] font-mono text-slate-400 flex-shrink-0">{i + 1}</span>
              <span className="text-slate-200 flex-1 truncate">{leg.matchLabel}</span>
              <MarketBadge market={leg.market} />
              <span className="text-slate-400 font-mono text-[10px]">{leg.selection}</span>
              <span className="text-slate-300 font-mono text-[10px]">{leg.odds}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => parlay.legs.forEach(leg => onAddToSlip(leg))}
          disabled={locked}
          className="w-full py-1.5 rounded-lg text-[11px] font-mono font-bold bg-amber-500 hover:bg-amber-400 disabled:bg-pitch-700 text-pitch-950 transition-colors min-h-[32px]"
        >
          Add All Legs to Slip
        </button>
      </div>
    </LockOverlay>
  )
}

export default function DailyPicksModal({ isOpen, onClose, fixtures, onAddToSlip, onOpenSlip }) {
  const { profile } = useAuth()
  const [picks, setPicks] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const todayKey = new Date().toISOString().split('T')[0]

  // Tier checks
  const tier = profile?.subscription_tier || 'free'
  const canSeeParlay2 = ['pro', 'annual', 'institutional'].includes(tier)
  const canSeeParlay3 = tier === 'institutional'
  const canSeeParlay4 = tier === 'institutional'

  // Load picks when modal opens
  useEffect(() => {
    if (!isOpen) return
    setIsLoading(true)
    try {
      const result = buildDailyPicks(fixtures || [])
      setPicks(result)
    } catch (e) {
      console.error('[DailyPicksModal] Failed to build picks:', e)
    }
    setIsLoading(false)
  }, [isOpen, fixtures])

  const handleAddToSlip = useCallback((card) => {
    if (!onAddToSlip) return
    const leg = {
      fixtureId: card.fixtureId,
      pick: card.selection,
      pickLabel: `${card.matchLabel} – ${card.selection}`,
      homeTeam: card.matchLabel.split(' vs ')[0] || '',
      awayTeam: card.matchLabel.split(' vs ')[1] || '',
      odds: parseFloat(card.odds) || 1,
      modelProb: parseFloat(card.modelProb) || 0,
      ev: parseFloat(card.evPercent) || 0,
    }
    onAddToSlip(leg)
    onOpenSlip?.()
  }, [onAddToSlip, onOpenSlip])

  const handleAddParlayToSlip = useCallback((parlay) => {
    if (!parlay || !onAddToSlip) return
    parlay.legs.forEach(leg => {
      onAddToSlip({
        fixtureId: leg.fixtureId,
        pick: leg.selection,
        pickLabel: `${leg.matchLabel} – ${leg.selection}`,
        homeTeam: leg.matchLabel.split(' vs ')[0] || '',
        awayTeam: leg.matchLabel.split(' vs ')[1] || '',
        odds: parseFloat(leg.odds) || 1,
        modelProb: parseFloat(leg.modelProb) || 0,
        ev: parseFloat(leg.evPercent) || 0,
      })
    })
    onOpenSlip?.()
  }, [onAddToSlip, onOpenSlip])

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(`matchlytics_daily_picks_dismissed_${todayKey}`, 'true')
    } catch {}
    onClose()
  }, [todayKey, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-pitch-950/90 backdrop-blur-md p-4" onClick={handleDismiss}>
      <div
        className="bg-pitch-900 border border-pitch-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-pitch-800 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[9px] font-mono font-bold border border-amber-500/30">
                DAILY QUANT INTELLIGENCE
              </span>
              <span className="text-[10px] font-mono text-slate-500">{todayKey}</span>
            </div>
            <p className="text-xs font-mono text-slate-400">
              Algorithmic value picks generated from proprietary Bivariate Poisson models.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-slate-500 hover:text-slate-300 text-lg leading-none min-w-[28px] min-h-[28px] flex items-center justify-center rounded hover:bg-pitch-800 transition-colors"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
              <p className="text-xs font-mono text-slate-500">Analyzing {fixtures?.length || 0} fixtures...</p>
            </div>
          ) : picks?.singles?.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-slate-300">No value picks found in the 24-36 hour window.</p>
              <p className="text-xs font-mono text-slate-500">Check back after the next sync cycle.</p>
            </div>
          ) : (
            <>
              {/* Top 3 Singles */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-mono font-bold text-slate-300">Top 3 Singles</h3>
                  <span className="text-[10px] font-mono text-slate-500">All tiers</span>
                </div>
                <div className="space-y-3">
                  {picks?.singles?.map((card) => (
                    <SingleCard
                      key={card.id}
                      card={card}
                      onAddToSlip={handleAddToSlip}
                      isInSlip={false}
                    />
                  ))}
                  {!picks?.singles?.length && (
                    <div className="p-6 text-center rounded-xl bg-pitch-950 border border-pitch-800">
                      <p className="text-xs font-mono text-slate-500">No single bets available right now.</p>
                    </div>
                  )}
                </div>
              </section>

              {/* 2-Team Parlay */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-mono font-bold text-slate-300">2-Team Value Parlay</h3>
                  <span className="text-[10px] font-mono text-slate-500">
                    {canSeeParlay2 ? 'Pro+' : '\u{1F512} Locked'}
                  </span>
                </div>
                <ParlayCard
                  parlay={picks?.parlay2}
                  tierAccess={canSeeParlay2}
                  onAddToSlip={handleAddParlayToSlip}
                />
              </section>

              {/* 3-Team Multiplier */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-mono font-bold text-slate-300">3-Team Quant Multiplier</h3>
                  <span className="text-[10px] font-mono text-slate-500">
                    {canSeeParlay3 ? 'Institutional' : '\u{1F512} Locked'}
                  </span>
                </div>
                <ParlayCard
                  parlay={picks?.parlay3}
                  tierAccess={canSeeParlay3}
                  onAddToSlip={handleAddParlayToSlip}
                />
              </section>

              {/* 4-Team Mega Parlay */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-mono font-bold text-slate-300">4-Team Mega Parlay</h3>
                  <span className="text-[10px] font-mono text-slate-500">
                    {canSeeParlay4 ? 'Institutional' : '\u{1F512} Locked'}
                  </span>
                </div>
                <ParlayCard
                  parlay={picks?.parlay4}
                  tierAccess={canSeeParlay4}
                  onAddToSlip={handleAddParlayToSlip}
                />
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-pitch-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleDismiss}
            className="px-4 py-2 rounded-lg bg-pitch-800 hover:bg-pitch-700 text-slate-300 text-xs font-mono transition-colors min-h-[36px]"
          >
            Dismiss
          </button>
          <p className="text-[10px] text-slate-600 font-mono hidden sm:block">
            Picks refresh every sync cycle. Model probabilities are estimates, not guarantees.
          </p>
        </div>
      </div>
    </div>
  )
}
