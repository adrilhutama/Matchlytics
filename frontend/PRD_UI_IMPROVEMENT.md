# Product Requirements Document (PRD)
## Matchlytics UI Professionalization
**Version:** 1.1  
**Date:** 2026-01-10  
**Status:** Draft  
**Owner:** Matchlytics Team

---

## 1. Executive Summary

### 1.1 Problem Statement
Matchlytics memiliki fondasi teknis yang kuat (Poisson engine, +EV scanner, Kelly sizing), namun implementasi UI-nya belum mencapai standar institutional-grade yang diharapkan untuk platform quant sports analytics. Beberapa masalah utama:

1. **Visual hierarchy lemah** - Data density tinggi tanpa stratifikasi yang jelas
2. **Inconsistent component system** - Design tokens dipakai tidak merata
3. **Performance concern** - JS bundle 750KB tanpa code splitting
4. **Mobile experience suboptimal** - Sidebar tidak responsive di small screens
5. **Trust signal kurang** - Social proof dan credibility indicators minim

### 1.2 Success Metrics
| Metric | Target | Measurement |
|---|---|---|
| LCP (Largest Contentful Paint) | < 1.5s | Lighthouse |
| CLS (Cumulative Layout Shift) | < 0.1 | Lighthouse |
| Time to Interactive | < 3.5s | Lighthouse |
| Bundle size (initial) | < 300KB gzipped | Build output |
| Task completion rate (scanner) | > 85% | User testing |
| Session duration (dashboard) | +40% | Analytics |
| Conversion rate (landing to app) | +25% | Analytics |

### 1.3 Competitive References
| Platform | Strength | Benchmark For |
|---|---|---|
| **Bet365** | Real-time odds table, dense data presentation | MatchCard, TableView |
| **Pinnacle** | Clean odds display, Asian handicap clarity | Market filters |
| **FanZero** | Mobile-first design, gesture navigation | Mobile experience |
| **The Action Network** | EV visualization, confidence scoring | +EV Scanner UI |
| **Rotowire/DFS sites** | Player props table, filter rails | FilterBar system |
| **Bloomberg Terminal** | Dark theme, data density, information hierarchy | Overall terminal feel |

---

## 2. Design System Specifications

### 2.1 Color Palette (Enhanced)

#### Core Palette
```css
/* Base */
--pitch-950: #020617;  /* Deepest background */
--pitch-900: #0a0f1a;  /* Card background */
--pitch-800: #111827;  /* Elevated surface */
--pitch-700: #1e293b;  /* Border/divider */
--pitch-600: #334155;  /* Disabled states */

/* Semantic */
--amber-400: #fbbf24;  /* Primary accent, +EV signals */
--amber-500: #f59e0b;  /* CTA, active states */
--emerald-400: #34d399; /* Win, strong signal */
--emerald-500: #10b981; /* Positive trends */
--sky-400: #38bdf8;    /* Model probability */
--rose-400: #fb7185;   /* Error, warning */
--slate-200: #e2e8f0;  /* Primary text */
--slate-300: #cbd5e1;  /* Secondary text */
--slate-400: #94a3b8;  /* Tertiary text */
--slate-500: #64748b;  /* Muted text */
--slate-600: #475569;  /* Disabled */
```

#### Signal Intensity Mapping
| Signal Type | Color | Context |
|---|---|---|
| +EV > 5% | `emerald-400` + glow | Strong edge, recommend stake |
| +EV 2-5% | `amber-400` + glow | Moderate edge, consider stake |
| +EV < 2% | `sky-400` | Weak edge, informational only |
| Model Prob High | `sky-400` | Highlighted probability |
| Loss/Negative | `rose-400` | Error states, lost positions |
| Neutral Data | `slate-400` | Metadata, labels |

### 2.2 Typography Scale

```css
/* Type Scale (base 16px) */
.text-h1    { font-size: 2.25rem; font-weight: 800; letter-spacing: -0.025em; } /* Hero */
.text-h2    { font-size: 1.875rem; font-weight: 700; letter-spacing: -0.025em; } /* Section */
.text-h3    { font-size: 1.25rem; font-weight: 600; }                          /* Card title */
.text-body  { font-size: 0.875rem; font-weight: 400; line-height: 1.5; }       /* Body */
.text-caption { font-size: 0.75rem; font-weight: 500; }                        /* Small labels */
.text-mono  { font-family: 'DM Mono', monospace; font-size: 0.75rem; }         /* Numbers/data */

/* Font Weights */
--font-light: 300;
--font-regular: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
--font-black: 800;
```

#### Typography Rules
- **Numbers/Data**: Always `DM Mono`, `tabular-nums`, aligned right
- **Labels**: `DM Sans`, uppercase, `tracking-wider`, `text-slate-500`
- **Body**: `DM Sans`, `leading-relaxed`, `text-slate-300`
- **Headings**: `DM Sans`, `tracking-tight`, `text-slate-100`

### 2.3 Spacing System

```css
/* Spacing Scale (based on 4px grid) */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

### 2.4 Radius & Shadows

```css
/* Border Radius */
--radius-sm: 0.375rem;   /* 6px - buttons, badges */
--radius-md: 0.5rem;     /* 8px - inputs, small cards */
--radius-lg: 0.75rem;    /* 12px - cards, panels */
--radius-xl: 1rem;       /* 16px - large cards, modals */
--radius-2xl: 1.5rem;    /* 24px - hero sections */

/* Shadows */
--shadow-card: 0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2);
--shadow-elevated: 0 10px 40px rgba(0,0,0,0.4);
--shadow-glow-amber: 0 0 20px rgba(245,158,11,0.15);
--shadow-glow-emerald: 0 0 20px rgba(16,185,129,0.15);
```

---

## 3. Component Specifications

### 3.1 Navigation System

#### 3.1.1 Desktop Sidebar

**Status:** COMPLETED (commit 93096b5) - Iterating

**Implementation Status:**
- Mini-rail sidebar (w-16 expanded ke w-56) sudah diimplementasikan
- Hover expand dengan smooth transition
- Active state dengan amber left border
- Badge counts untuk +EV dan watchlist

**Remaining Refinements:**
- [ ] Add chevron toggle untuk collapse/expand manual
- [ ] Improve keyboard navigation focus states
- [ ] Add tooltip untuk collapsed state icons

```jsx
// Component Props
interface SidebarProps {
  activeWorkspace: string;
  activeFeed: string;
  valueCount: number;
  watchlistCount: number;
  pinned: boolean;
  onPin: () => void;
  onSelectWorkspace: (ws: string) => void;
  onSelectFeed: (feed: string) => void;
}
```

#### 3.1.2 Mobile Navigation

**Status:** Needs Improvement

**Requirements:**
- Bottom tab bar (5 tabs max)
- Hamburger menu untuk secondary actions
- Swipe gestures untuk workspace switching
- Safe area insets untuk notched devices

```
Bottom Tabs:
┌─────────────────────────────────────┐
│  [Scanner] [Lab] [Portfolio] [Ledger]│
│   🔵        �-�        �-�        �-�     │
└─────────────────────────────────────┘
```

### 3.2 Filter Bar

**Status:** COMPLETED (commit 93096b5) - Iterating

**Implementation Status:**
- Layout 2-tier (Search + Segmented Market + Time Pills) sudah diimplementasikan
- League pills dengan horizontal scroll
- View mode toggle (table/cards)

**Remaining Refinements:**
- [ ] Add persistent filter chips showing active filters
- [ ] Add clear all button when filters active
- [ ] Improve mobile stacked layout
- [ ] Add fade masks untuk league rail edges

```jsx
// FilterBar Component Structure
<div className="filter-bar">
  {/* Primary Controls */}
  <div className="primary-controls">
    <SearchInput />
    <DateRangeSelector />
    <MarketFilter />
    <ViewModeToggle />
  </div>
  
  {/* Secondary Controls - League Pills */}
  <div className="league-rail">
    <FadeMask left />
    {leagues.map(league => <LeaguePill ... />)}
    <FadeMask right />
  </div>
  
  {/* Active Filter Chips */}
  {activeFilters.length > 0 && (
    <div className="filter-chips">
      {activeFilters.map(filter => <FilterChip ... />)}
      <ClearAllButton />
    </div>
  )}
</div>
```

### 3.3 Match Card

**Status:** Needs Rewrite - High Priority

**Reference:** Bet365 match list + The Action Network EV display

**Current Issues:**
- Information overloaded
- No clear visual hierarchy
- +EV signal buried in details

**New Design:**

```
┌─────────────────────────────────────────────────────────────┐
│ �-� LIVE          19:45        Premier League                 │
├─────────────────────────────────────────────────────────────┤
│  Arsenal    2.10    3.40    3.50    Chelsea                  │
│   🟢        🟡         -         🔵                         │
│  [62%]     [29%]      [41%]                               │
├─────────────────────────────────────────────────────────────┤
│ +EV: +4.2% │ Model: Home Win │ Kelly: 1.8% │  ▶ Expand      │
└─────────────────────────────────────────────────────────────┘
```

**Key Improvements:**
1. **Status indicator** (top-left): Live dot, scheduled time
2. **Teams + Odds row**: Compact, bold team names, aligned odds
3. **Probability bars**: Visual representation below odds
4. **EV badge**: Prominent +EV indicator with percentage
5. **Quick actions**: Expand for details, add to slip, quant lab
6. **Progressive disclosure**: Default compact, expand for details

```jsx
// MatchCard Layout
const MatchCard = ({ fixture }) => {
  return (
    <div className={`match-card ${fixture.has_ev ? 'match-card--value' : ''}`}>
      {/* Header: Status + League */}
      <div className="card-header">
        <StatusIndicator status={fixture.status} />
        <LeagueBadge league={fixture.league_name} />
        <KickoffTime time={fixture.kickoff_time} />
      </div>
      
      {/* Main Content: Teams + Odds */}
      <div className="card-main">
        <div className="teams-row">
          <TeamInfo team={fixture.home_team} direction="home" />
          <OddsGroup odds={fixture} />
          <TeamInfo team={fixture.away_team} direction="away" />
        </div>
        
        {/* Probability Visualization */}
        <ProbabilityBars 
          home={fixture.prob_home}
          draw={fixture.prob_draw}
          away={fixture.prob_away}
        />
      </div>
      
      {/* Footer: EV + Actions */}
      <div className="card-footer">
        <EvBadge ev={fixture.ev_percentage} />
        <KellySizer kelly={fixture.kelly_fraction} />
        <ActionButtons 
          onExpand={() => {}}
          onAddToSlip={() => {}}
          onOpenLab={() => {}}
        />
      </div>
    </div>
  )
}
```

### 3.4 TableView & CardView - Virtualization Required

**Status:** Needs Polish + Virtualization - High Priority

**Performance Concern:**
Filter "All (30 Days)" dapat merender 400+ pertandingan. Tanpa virtualisasi, browser mobile akan mengalami frame drop (jank) karena:
- 400+ komponen React dengan kalkulasi odds per card
- Badge SVG rendering berulang
- Probability bar animations

**Solution: @tanstack/react-virtual**

```jsx
import { useVirtualizer } from '@tanstack/react-virtual'

// For TableView
const RowVirtualizer = ({ fixtures }) => {
  const parentRef = useRef(null)
  const virtualizer = useVirtualizer({
    count: fixtures.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Estimated row height
    overscan: 5,
  })

  return (
    <div ref={parentRef} className="overflow-y-auto h-[600px]">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
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
          >
            <MatchRow fixture={fixtures[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}

// For CardView
const CardVirtualizer = ({ fixtures, columns = 3 }) => {
  const parentRef = useRef(null)
  const virtualizer = useVirtualizer({
    count: Math.ceil(fixtures.length / columns),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 280, // Estimated card height
    overscan: 3,
  })

  return (
    <div ref={parentRef} className="overflow-y-auto h-[600px]">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columns
          const rowFixtures = fixtures.slice(startIndex, startIndex + columns)
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
                padding: '0 1rem',
              }}
            >
              {rowFixtures.map(fixture => (
                fixture && <MatchCard key={fixture.id} fixture={fixture} />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**TableView Requirements:**
- Sticky first column (team names)
- Sortable columns with indicator
- Hover row highlight
- Checkbox selection untuk bulk actions
- Column resize support

```
┌───────────────────────────────────────────────────────────────────────┐
│ ▼ Teams          H    D    A   EV%  Prob  Kelly  Market  Status      │
├───────────────────────────────────────────────────────────────────────┤
│ �-� Arsenal        2.10 3.40 3.50 +4.2% 62%   1.8%   1X2    SCHEDULED │
│   Chelsea        -    -    -    -      -     -      -      NS       │
├───────────────────────────────────────────────────────────────────────┤
│ �-� Man City       1.45 4.20 6.50 +2.1% 71%   0.9%   1X2    SCHEDULED │
└───────────────────────────────────────────────────────────────────────┘
```

### 3.5 Hero Monitor (Landing Page)

**Status:** Existing - Low Priority

**Requirements:**
- Live data from Supabase
- Auto-rotate antara top EV picks (5s interval)
- Smooth transition antara matches
- Animated progress bar untuk EV magnitude
- Responsive: full card di desktop, carousel di mobile

**Important: Data Timing Clarification**

```
┌─────────────────────────────────────────────────────────────────┐
│ REAL-TIME DATA DISCLAIMER                                       │
├─────────────────────────────────────────────────────────────────┤
│ Pipeline ini menggunakan snapshot batch (cron 2x sehari:        │
│ 06:00 UTC dan 14:00 UTC). Data odds bersifat point-in-time      │
│ pada waktu sync terakhir, bukan feed detik-per-detik.           │
│                                                                 │
│ Status "SCHEDULED" = Pertandingan belum dimulai                 │
│ Status "LIVE" = Pertandingan sedang berlangsung (info dari      │
│ football-data.org, bukan real-time odds feed)                   │
└─────────────────────────────────────────────────────────────────┘
```

**UX Copy Guidelines:**
- Ganti "Real-Time Feed" dengan "Last Sync: HH:MM UTC"
- Ganti "Live odds" dengan "Latest odds snapshot"
- Hindari kata "instant", "real-time", "second-by-second"

### 3.6 Pricing Cards

**Status:** Needs Redesign - High Priority

**Reference:** Stripe pricing page

**Improvements:**
- Monthly/Annual toggle dengan savings badge
- Feature comparison table (expandable)
- "Most Popular" badge di Pro tier
- FAQ accordion di bawah
- Trust badges (security, refund policy)

```
┌─────────────────────────────────────────────────────────────────┐
│              [Monthly] �-�──────�-� [Annual] (-17%)                 │
├──────────────────┬──────────────────┬───────────────────────────┤
│    Starter       │     Pro Pass     │    Season Pass            │
│     Free         │   Rp 149K/bulan  │   Rp 999K/tahun           │
│                  │   �-� MOST POPULAR │                           │
│ ✓ Core 1X2       │ ✓ Full +EV       │ ✓ All Pro features      │
│ ✓ Standard       │ ✓ 6x6 Heatmaps   │ ✓ Priority refresh      │
│   Analytics      │ ✓ Kelly Sizing   │ ✓ Full archive          │
│ ✓ Match summary  │ ✓ Parlay Engine  │ ✓ Quant desk support    │
│ ✓ Watchlist      │                  │                           │
├──────────────────┴──────────────────┴───────────────────────────┤
│              [Compare Plans]  [Start Free Trial]                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Interaction Design

### 4.1 Motion System

| Animation | Duration | Easing | Usage |
|---|---|---|---|
| Page transition | 200ms | ease-out | Workspace switch |
| Card hover | 150ms | ease-out | MatchCard, sidebar items |
| Modal open | 300ms | cubic-bezier(0.16, 1, 0.3, 1) | Matrices, Kelly calc |
| Toast | 300ms in / 200ms out | ease-out | Notifications |
| Number count | 400ms | ease-out cubic | EV%, probability changes |
| Skeleton | 1.5s loop | linear | Loading states |
| Progress bar | 700ms | ease-in-out | EV magnitude fill |

```css
/* Animation utilities */
.animate-fade-in {
  animation: fadeIn 200ms ease-out forwards;
}
.animate-slide-up {
  animation: slideUp 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.animate-pulse-slow {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

### 4.2 Micro-Interactions

**Hover States:**
- Cards: `translateY(-2px)` + shadow increase
- Buttons: Background darkening, scale(1.02)
- Links: Underline animation from left to right

**Active States:**
- Buttons: `scale(0.98)`
- Inputs: Border color change to amber
- Tabs: Bottom border indicator

**Focus States:**
- Visible ring: 2px amber outline + 2px offset
- Untuk keyboard navigation only (`:focus-visible`)

### 4.3 Loading States

```
Type              Pattern                    Duration
────────────────────────────────────────────────────
Initial load      Spinner + skeleton         1-3s
Data refresh      Shimmer bars               500ms
Async action      Button loading state       Variable
Error recovery    Error boundary + retry     Manual
```

---

## 5. Performance Requirements

### 5.1 Bundle Optimization - PRIORITY #1

**Current:** 733KB single chunk

**Target:** < 300KB initial + lazy loaded chunks

**Strategy:** React.lazy() + Suspense untuk heavy components

```jsx
// Lazy loading pattern - Implementasi Priority #1
const AdminPanel = React.lazy(() => import('./components/AdminPanel'))
const QuantLab = React.lazy(() => import('./components/QuantLab'))
const PortfolioTracker = React.lazy(() => import('./components/PortfolioTracker'))
const UserProfile = React.lazy(() => import('./components/UserProfile'))
const DailyPicksModal = React.lazy(() => import('./components/DailyPicksModal'))

// Fallback skeleton
const LazyFallback = () => (
  <div className="shimmer h-full w-full rounded-lg" />
)

// Usage in App.jsx
<Suspense fallback={<LazyFallback />}>
  {activeWorkspace === 'quant_lab' && <QuantLab ... />}
  {activeWorkspace === 'portfolio' && <PortfolioTracker ... />}
  {activeWorkspace === 'ledger' && <ModelLedger ... />}
</Suspense>
```

**Expected Bundle Split:**
```
├── vendors ~150KB (react, supabase)
├── core ~80KB (app shell, auth, utils)
├── terminal ~60KB (lazy)
├── quant-lab ~45KB (lazy)
├── portfolio ~35KB (lazy)
├── ledger ~40KB (lazy)
├── admin-panel ~50KB (lazy)
└── user-profile ~30KB (lazy)
```

### 5.2 DOM Virtualization - PRIORITY #2

**Library:** `@tanstack/react-virtual`

**Implementation Scope:**
1. **TableView**: Virtualize rows untuk 400+ fixtures
2. **CardView**: Virtualize row-based grid untuk 400+ cards
3. **FilterBar league pills**: Tidak perlu virtual (max 12 items)

**Performance Impact:**
| Scenario | Before (400 items) | After (Virtualized) |
|---|---|---|
| DOM nodes | ~400 komponen | ~20 komponen visible |
| Initial render | 2-4s | <500ms |
| Memory usage | High | Low |
| Scroll FPS | 30-45fps (mobile) | 60fps |

### 5.3 Rendering Optimization

| Technique | Usage |
|---|---|
| `React.memo` | MatchCard, FilterBar, sidebar items |
| `useMemo` | Fixture filtering, statistics calculations |
| `useCallback` | Event handlers, API calls |
| Virtual scrolling | TableView + CardView dengan 100+ fixtures |
| RequestAnimationFrame | EV bar animations |

---

## 6. Data Timing & Accuracy Disclosure

### 6.1 Pipeline Architecture Clarification

**Critical for UI Copy & User Expectations:**

| Aspect | Reality | UI Implication |
|---|---|---|
| **Sync Frequency** | 2x daily (06:00 & 14:00 UTC) | Show "Last Sync" timestamp |
| **Odds Source** | The Odds API (free tier) | Rate limited, not continuous |
| **Match Status** | football-data.org (batch) | Not truly real-time |
| **EV Calculation** | Server-side Python engine | Client mirrors calculation |

### 6.2 UI Copy Guidelines

**✅ Good (Accurate):**
- "Last sync: 14:00 UTC"
- "Odds snapshot from latest pipeline run"
- "Scheduled: Next refresh at 06:00 UTC"
- "Model probabilities based on Poisson distribution"

**❌ Bad (Misleading):**
- "Real-time odds feed"
- "Live updating every second"
- "Instant price changes"
- "Second-by-second market moves"

### 6.3 Status Indicator Refinement

```
┌─────────────────────────────────────────────────────────────┐
│ STATUS LEGEND                                               │
├─────────────────────────────────────────────────────────────┤
│ �-� SCHEDULED  = Match upcoming, odds from last sync          │
│ �-� LIVE       = Match in progress (score from feed)          │
│ �-� FT         = Full time, settled results                   │
│ �-� POST       = Postponed/cancelled                          │
├─────────────────────────────────────────────────────────────┤
│ NOTE: Odds are snapshots, not live streams. Refresh at      │
│ next cron sync (06:00/14:00 UTC).                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Accessibility Requirements

### 7.1 WCAG 2.1 AA Compliance

| Criterion | Requirement | Implementation |
|---|---|---|
| **Contrast** | 4.5:1 minimum | All text passes AA |
| **Keyboard** | Full navigation | Tab order, focus visible |
| **Screen Reader** | ARIA labels | Semantic HTML, roles |
| **Motion** | Reduced motion | `prefers-reduced-motion` |
| **Touch** | 44x44px minimum | Touch target sizing |

### 7.2 Keyboard Navigation

```
Tab: Move between interactive elements
Enter/Space: Activate buttons/links
Escape: Close modals, drawers
Arrow keys: Navigate within groups (tabs, pills)
Ctrl+K: Open command palette
```

---

## 8. Mobile Experience

### 8.1 Responsive Breakpoints

```css
/* Tailwind breakpoints */
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Laptop */
xl: 1280px  /* Desktop */
2xl: 1536px /* Large desktop */
```

### 8.2 Mobile-Specific Patterns

| Screen Size | Layout | Navigation |
|---|---|---|
| < 640px | Single column, stacked filters | Bottom tab bar |
| 640-768px | Two columns, compact cards | Horizontal scroll filters |
| 768-1024px | Three columns, full cards | Collapsible sidebar |
| > 1024px | Four columns, table view | Persistent sidebar |

### 8.3 Touch Interactions

- Swipe left/right pada match cards untuk quick actions
- Pull-to-refresh pada feed
- Long press untuk context menu
- Thumb-friendly tap targets (min 44px)

---

## 9. New Features (Phase 2)

### 9.1 Command Palette (Expanded)

**Reference:** Linear, Vercel command palette

```
[🔍 Search matches, teams, leagues...]

Recent:
  Arsenal vs Chelsea  →  Open in Quant Lab
  Lakers vs Celtics   →  Add to Watchlist

Commands:
  Switch Workspace    ⌘1-4
  Open Settings       ⌘,
  Sign Out            ⌘⇧Q
```

### 9.2 Real-Time Alerts

- Push notifications untuk +EV opportunities
- Email digest (daily/weekly)
- In-app notification center
- Sound alerts (optional)

### 9.3 Team Profiles

- Club crest + logo
- Form guide (last 5 matches)
- Home/Away splits
- Head-to-head history
- Key player injuries

---

## 10. Implementation Roadmap

### Phase 1: Performance Foundation (Week 1-2) - CRITICAL
- [x] Establish design token system
- [x] Code split architecture (React.lazy + Suspense)
- [ ] Install @tanstack/react-virtual
- [ ] Implement virtualization di TableView
- [ ] Implement virtualization di CardView
- [ ] Bundle size audit & optimization

### Phase 2: Landing Page (Week 3)
- [ ] Redesign Hero section
- [ ] Improve Pricing cards
- [ ] Add social proof elements
- [ ] Add data timing disclaimer
- [ ] Optimize mobile layout

### Phase 3: Dashboard Polish (Week 4-5)
- [ ] Refine Sidebar (chevron toggle, tooltips)
- [ ] Add filter chips to FilterBar
- [ ] New MatchCard component (hierarchical)
- [ ] Improved TableView dengan virtualization
- [ ] Mobile bottom navigation refinement

### Phase 4: Quant Lab Enhancement (Week 6)
- [ ] Split-screen layout
- [ ] Interactive matrix dengan zoom
- [ ] Monte Carlo animation
- [ ] Quick-add to slip

### Phase 5: Polish & Compliance (Week 7-8)
- [ ] Accessibility audit
- [ ] R-02 compliance check (zero em dashes)
- [ ] Error boundary improvements
- [ ] Loading states refinement
- [ ] Cross-browser testing
- [ ] Performance regression test

---

## 11. Technical Constraints

### 11.1 Must Maintain
- **R-02**: Zero em dashes in UI copy (use `-` or `:` instead)
- **R-03**: No vendor names in public UI
- **R-04**: Mathematical parity between Python and JS
- **R-05**: Odds API key pool & rate pacing

### 11.2 Dependencies
- React 18 (existing)
- Tailwind CSS (existing)
- Supabase (existing)
- Vite (existing)
- **New:** `@tanstack/react-virtual` for DOM virtualization
- **New:** `react-lazy-load-image-component` untuk image optimization

### 11.3 Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## 12. Open Questions & Recommendations

### Q1: Perlukah file token khusus (tokens.json) atau cukup Tailwind config?

**Recommendation:** Cukup extend di `tailwind.config.js` dengan CSS variables di `index.css`. Membuat tokens.json terpisah hanya menambah lapisan build tooling tanpa manfaat signifikan untuk skala aplikasi saat ini.

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        pitch: {
          950: '#020617',
          900: '#0a0f1a',
          // ...
        }
      }
    }
  }
}
```

### Q2: Apakah butuh Storybook?

**Recommendation:** Tidak perlu sekarang. Storybook membutuhkan biaya perawatan (maintenance overhead) yang tinggi. Cukup buat satu halaman playground/styleguide internal tersembunyi (`/dev-components`) jika ingin menguji komponen secara terisolasi.

### Q3: A/B Testing untuk Landing Page?

**Recommendation:** Tunda. A/B testing baru efektif jika traffic harian sudah mencapai ribuan pengunjung unik per hari. Saat ini fokus utama adalah kestabilan konversi landing page ke web app.

### Q4: Penanganan migrasi kode lama ke komponen baru?

**Recommendation:** Lakukan per komponen secara bertahap (strangler pattern). Mulai dari kartu laga (MatchCard.jsx), lalu TableView.jsx, baru kemudian sentuh halaman statis dan landing page.

### Q5: Haruskah ada Theming (Dark/Light mode)?

**Recommendation:** Hanya Dark Mode (Wajib). Produk bergaya terminal quant (seperti Bloomberg, TradingView, atau platform trading crypto/odds) memiliki identitas yang kuat di tema gelap. Menghapus light mode juga menghemat 40% waktu penulisan styling Tailwind dan mencegah inkonsistensi kontras warna pada badge +EV.

---

## Appendix A: Component Inventory

| Component | Status | Priority | Ref |
|---|---|---|---|
| Sidebar | Completed (Iterating) | Medium | Bet365 left rail |
| FilterBar | Completed (Iterating) | Medium | Pinnacle filters |
| MatchCard | Needs Rewrite | **High** | Bet365 match list |
| TableView | Needs Virtualization | **High** | Bloomberg table |
| CardView | Needs Virtualization | **High** | Card grid layout |
| HeroMonitor | Existing | Low | Action Network |
| QuantLab | Needs Polish | Medium | TradingView charts |
| PricingCard | Needs Redesign | **High** | Stripe pricing |
| CommandPalette | New feature | Medium | Linear palette |

---

## Appendix B: R-02 Compliance Checklist

Semua komponen UI HARUS mematuhi aturan zero em dash:

```jsx
// ❌ WRONG (em dash)
<p>This is an example - please read carefully.</p>

// ✅ CORRECT (hyphen or colon)
<p>This is an example - please read carefully.</p>
<p>This is an example: please read carefully.</p>
```

**Files to audit:**
- [ ] `src/components/LandingPage.jsx`
- [ ] `src/components/App.jsx`
- [ ] `src/components/TerminalScanner.jsx`
- [ ] `src/components/MatchCard.jsx`
- [ ] `src/components/FilterBar.jsx`
- [ ] `src/components/Sidebar.jsx`
- [ ] `src/components/QuantLab.jsx`
- [ ] `src/components/PortfolioTracker.jsx`
- [ ] `src/components/ModelLedger.jsx`
- [ ] `src/components/AdminDashboard.jsx`
- [ ] `src/components/AdminPanel.jsx`
- [ ] `src/components/DailyPicksModal.jsx`
- [ ] `src/components/UserProfile.jsx`

---

**Document Version:** 1.1  
**Last Updated:** 2026-01-10  
**Next Review:** After Phase 1 completion

