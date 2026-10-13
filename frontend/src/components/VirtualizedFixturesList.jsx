// ---- VirtualizedFixturesList.jsx ----
// High-performance virtualized list for 400+ fixtures using react-window.
// Only renders visible items (typically 5-10) instead of all 400+.
// Zero em dash characters (R-02 compliance).

import { FixedSizeList as List } from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'
import MatchCard from './MatchCard'
import MatchCardSkeleton from './MatchCardSkeleton'

function Row({ index, style, data }) {
  const { fixture, idx, ...rest } = data.rows[index]
  return (
    <div style={style} className="mb-3 sm:mb-4">
      <MatchCard
        key={fixture.id}
        fixture={fixture}
        {...rest}
        style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
      />
    </div>
  )
}

export default function VirtualizedFixturesList({
  fixtures = [],
  isLoading = false,
  ...rest
}) {
  if (isLoading) {
    return (
      <div className="space-y-3 sm:space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <MatchCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (!fixtures?.length) return null

  return (
    <AutoSizer>
      {({ height, width }) => (
        <List
          height={height}
          width={width}
          itemCount={fixtures.length}
          itemSize={320}
          overscanCount={5}
        >
          {({ index, style }) => (
            <Row
              index={index}
              style={style}
              data={{ rows: fixtures.map((f, i) => ({ fixture: f, idx: i })) }}
              {...rest}
            />
          )}
        </List>
      )}
    </AutoSizer>
  )
}
