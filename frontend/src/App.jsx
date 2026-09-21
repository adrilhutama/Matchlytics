import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import Header from './components/Header'
import FilterBar from './components/FilterBar'
import MatchCard from './components/MatchCard'
import LoadingState from './components/LoadingState'
import EmptyState from './components/EmptyState'
import ErrorState from './components/ErrorState'

// ---- League metadata ----------------------------------------
export const LEAGUES = [
  { id: 'all',  label: 'All Leagues',    country: null },
  { id: 39,     label: 'Premier League', country: 'England' },
  { id: 140,    label: 'La Liga',        country: 'Spain' },
  { id: 135,    label: 'Serie A',        country: 'Italy' },
  { id: 78,     label: 'Bundesliga',     country: 'Germany' },
  { id: 61,     label: 'Ligue 1',        country: 'France' },
]

// Upcoming window: fixtures in the next 7 days
const DAYS_AHEAD = 7

function buildDateRange() {
  const now  = new Date()
  const end  = new Date(now)
  end.setDate(end.getDate() + DAYS_AHEAD)
  return {
    from: now.toISOString(),
    to:   end.toISOString(),
  }
}

export default function App() {
  const [fixtures,       setFixtures]       = useState([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)
  const [activeLeague,   setActiveLeague]   = useState('all')
  const [valueOnly,      setValueOnly]      = useState(false)
  const [lastUpdated,    setLastUpdated]    = useState(null)

  // ---- Data fetching ----------------------------------------
  const fetchFixtures = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { from, to } = buildDateRange()

    try {
      let query = supabase
        .from('fixtures')
        .select('*')
        .gte('match_date', from)
        .lte('match_date', to)
        .eq('status', 'NS')
        .order('match_date', { ascending: true })

      if (activeLeague !== 'all') {
        query = query.eq('league_id', activeLeague)
      }

      if (valueOnly) {
        query = query.not('value_pick', 'is', null)
      }

      const { data, error: sbErr } = await query

      if (sbErr) throw sbErr

      setFixtures(data || [])
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Supabase fetch error:', err)
      setError(err.message || 'Failed to load fixtures.')
    } finally {
      setLoading(false)
    }
  }, [activeLeague, valueOnly])

  useEffect(() => {
    fetchFixtures()
  }, [fetchFixtures])

  // ---- Render -----------------------------------------------
  return (
    <div className="min-h-dvh bg-pitch-950">
      <Header lastUpdated={lastUpdated} />

      {/* Sticky glassmorphism filter bar — the single glass element (R-10) */}
      <div className="sticky top-0 z-20 glass-filter">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <FilterBar
            leagues={LEAGUES}
            activeLeague={activeLeague}
            onLeagueChange={setActiveLeague}
            valueOnly={valueOnly}
            onValueOnlyChange={setValueOnly}
          />
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6" id="main-content">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchFixtures} />
        ) : fixtures.length === 0 ? (
          <EmptyState
            leagueLabel={LEAGUES.find(l => l.id === activeLeague)?.label}
            valueOnly={valueOnly}
            onClearFilters={() => { setActiveLeague('all'); setValueOnly(false) }}
          />
        ) : (
          <section aria-label="Match fixtures">
            <p className="text-sm text-slate-500 mb-4">
              {fixtures.length} match{fixtures.length !== 1 ? 'es' : ''} in the next {DAYS_AHEAD} days
            </p>
            <div className="grid gap-4 sm:gap-5">
              {fixtures.map((fixture, idx) => (
                <MatchCard
                  key={fixture.id}
                  fixture={fixture}
                  style={{ animationDelay: `${idx * 40}ms` }}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="max-w-6xl mx-auto px-4 py-8 mt-4 border-t border-pitch-800">
        <p className="text-xs text-slate-500 text-center">
          Matchlytics uses Poisson distribution modelling. Probabilities are model estimates, not guarantees.
          Bet responsibly.
        </p>
      </footer>
    </div>
  )
}
