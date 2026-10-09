// ---- VirtualList.jsx ----
// Virtualized list component for 400+ items
// Uses @tanstack/react-virtual for optimal performance
// R-02 Compliant: Zero em dashes

import { useRef, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

// Virtualized Card Grid
export function VirtualCardList({ items, renderItem, columns = 3, rowHeight = 280, overscan = 3 }) {
  const parentRef = useRef(null)
  
  const virtualizer = useVirtualizer({
    count: Math.ceil(items.length / columns),
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  })

  return (
    <div
      ref={parentRef}
      className="overflow-y-auto h-full"
      style={{ contain: 'strict' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columns
          const endIndex = Math.min(startIndex + columns, items.length)
          const rowItems = items.slice(startIndex, endIndex)
          
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                display: 'grid',
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gap: '1rem',
                padding: '0 0.25rem',
              }}
              data-index={virtualRow.index}
            >
              {rowItems.map((item, idx) => {
                const globalIndex = startIndex + idx
                return (
                  <div key={item?.id || globalIndex}>
                    {renderItem(item, globalIndex)}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Virtualized Table Rows
export function VirtualTableList({ items, renderItem, rowHeight = 64, overscan = 10 }) {
  const parentRef = useRef(null)
  
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  })

  return (
    <div
      ref={parentRef}
      className="overflow-y-auto h-full"
      style={{ contain: 'strict' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
            data-index={virtualRow.index}
          >
            {renderItem(items[virtualRow.index], virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  )
}

// Virtualized Horizontal List (for league pills)
export function VirtualHList({ items, renderItem, itemWidth = 100, overscan = 3 }) {
  const parentRef = useRef(null)
  
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemWidth,
    overscan,
    horizontal: true,
  })

  return (
    <div
      ref={parentRef}
      className="overflow-x-auto scroll-hide"
      style={{ contain: 'strict' }}
    >
      <div
        style={{
          width: `${virtualizer.getTotalSize()}px`,
          height: '100%',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: `${virtualItem.size}px`,
              height: '100%',
              transform: `translateX(${virtualItem.start}px)`,
              display: 'flex',
              alignItems: 'center',
            }}
            data-index={virtualItem.index}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  )
}
