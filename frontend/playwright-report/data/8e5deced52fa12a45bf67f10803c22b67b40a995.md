# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: basic.spec.js >> Build Integrity >> no console errors on load
- Location: tests\basic.spec.js:79:3

# Error details

```
Error: expect(received).toHaveLength(expected)

Expected length: 0
Received length: 1
Received array:  ["Failed to load resource: net::ERR_CONNECTION_TIMED_OUT"]
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - banner [ref=e5]:
      - generic [ref=e7]:
        - link "Matchlytics by imortifex" [ref=e8] [cursor=pointer]:
          - /url: https://imortifex.me/
          - generic [ref=e10]:
            - generic [ref=e11]: MATCHLYTICS
            - generic [ref=e12]: by imortifex
        - navigation "Landing sections" [ref=e13]:
          - link "Methodology" [ref=e14] [cursor=pointer]:
            - /url: "#methodology"
          - link "Technology" [ref=e15] [cursor=pointer]:
            - /url: "#technology"
          - link "Pricing" [ref=e16] [cursor=pointer]:
            - /url: "#pricing"
          - link "Performance" [ref=e17] [cursor=pointer]:
            - /url: "#performance"
        - generic [ref=e18]:
          - status [ref=e19]: Engine Active · SYNCED 05:38 PM
          - link "Enter Terminal" [ref=e21] [cursor=pointer]:
            - /url: https://app.imortifex.me/
    - main [ref=e22]:
      - generic [ref=e25]:
        - generic [ref=e26]:
          - generic [ref=e27]: LIVE FEED ACTIVE
          - heading "Find Your Edge in Every Match" [level=1] [ref=e30]: Find YourEdge in Every Match
          - paragraph [ref=e31]: Quantitative football analysis powered by bivariate Poisson models and consensus de-vigging. Quarter-Kelly staking with a hard 2.5% cap keeps your bankroll protected.
          - generic [ref=e32]:
            - link "Launch Terminal" [ref=e33] [cursor=pointer]:
              - /url: https://app.imortifex.me/
            - button "View Pricing" [ref=e36] [cursor=pointer]
          - list "Verified engine proofs" [ref=e37]:
            - listitem [ref=e38]:
              - generic [aria-hidden] [ref=e39]: ◈
              - text: "Model Calibration: Brier Score Verified"
            - listitem [ref=e40]:
              - generic [aria-hidden] [ref=e41]: ◍
              - text: "Capital Preservation: 2.5% Max Kelly Sizing"
            - listitem [ref=e42]:
              - generic [aria-hidden] [ref=e43]: ◇
              - text: "True Probability: Zero-Vig Consensus De-vigging"
          - paragraph [ref=e44]: The public feed streams today's verified horizons. Open the terminal to unlock paid access windows.
        - generic [ref=e47]:
          - generic [ref=e48]:
            - generic [ref=e49]: Live Edge Monitor
            - generic [ref=e52]: MARKET ODDS
          - generic [ref=e53]:
            - paragraph [ref=e55]: Aston Villa FCvsManchester City FC
            - tablist "Positive-EV picks" [ref=e56]:
              - tab "Manchester ... +34.8%" [selected] [ref=e57] [cursor=pointer]:
                - generic [ref=e58]: Manchester ...
                - generic [ref=e59]: +34.8%
              - tab "Como 1907 +34.7%" [ref=e60] [cursor=pointer]:
                - generic [ref=e61]: Como 1907
                - generic [ref=e62]: +34.7%
              - tab "Brighton & ... +32.8%" [ref=e63] [cursor=pointer]:
                - generic [ref=e64]: Brighton & ...
                - generic [ref=e65]: +32.8%
              - tab "Millwall +32.4%" [ref=e66] [cursor=pointer]:
                - generic [ref=e67]: Millwall
                - generic [ref=e68]: +32.4%
            - generic [ref=e69]:
              - paragraph [ref=e70]: Expected Goals (Poisson Lambdas)
              - generic [ref=e71]:
                - generic [ref=e72]:
                  - paragraph [ref=e73]: λ HOME
                  - paragraph [ref=e74]: n/a
                - generic [ref=e75]:
                  - paragraph [ref=e76]: λ AWAY
                  - paragraph [ref=e77]: n/a
            - generic [ref=e78]:
              - paragraph [ref=e79]: Model Probability vs Market Price
              - generic [ref=e80]:
                - generic [ref=e81]:
                  - paragraph [ref=e82]: Home
                  - paragraph [ref=e83]: 6%
                  - paragraph [ref=e84]: n/a
                - generic [ref=e85]:
                  - paragraph [ref=e86]: Draw
                  - paragraph [ref=e87]: 12%
                  - paragraph [ref=e88]: n/a
                - generic [ref=e89]:
                  - paragraph [ref=e90]: Away
                  - paragraph [ref=e91]: 82%
                  - paragraph [ref=e92]: n/a
      - generic [ref=e95]:
        - generic [ref=e96]: "Live Edges:"
        - generic [ref=e97]:
          - generic [ref=e98]: Manchester City FC Win
          - generic [ref=e99]: "@0.00"
          - generic [ref=e100]: +34.8%
        - generic [ref=e101]:
          - generic [ref=e102]: Como 1907 Win
          - generic [ref=e103]: "@0.00"
          - generic [ref=e104]: +34.7%
        - generic [ref=e105]:
          - generic [ref=e106]: Brighton & Hove Albion FC Win
          - generic [ref=e107]: "@0.00"
          - generic [ref=e108]: +32.8%
        - generic [ref=e109]:
          - generic [ref=e110]: Millwall FC Win
          - generic [ref=e111]: "@0.00"
          - generic [ref=e112]: +32.4%
      - generic [ref=e114]:
        - generic [ref=e115]:
          - paragraph [ref=e116]: 01Methodology
          - heading "Four pillars. Zero guesswork." [level=2] [ref=e117]
          - paragraph [ref=e118]: Every fixture runs through our pipeline before it appears. No shortcuts, no black boxes.
        - generic [ref=e119]:
          - article [ref=e120]:
            - generic [ref=e121]:
              - generic [ref=e122]:
                - generic [ref=e123]: "01"
                - heading "De-Vigged Consensus Pricing" [level=3] [ref=e124]
              - paragraph [ref=e125]: Bookmaker prices carry an overround built in. Matchlytics strips it proportionally across all three outcomes, recovering the fair market distribution to compare against model output.
            - paragraph [ref=e126]: Sum(1/o_i) > 1 · vig = Sum(1/o_i) - 1
          - article [ref=e127]:
            - generic [ref=e128]:
              - generic [ref=e129]:
                - generic [ref=e130]: "02"
                - heading "Bivariate Poisson & Bayesian Estimation" [level=3] [ref=e131]
              - paragraph [ref=e132]: Simultaneous attack and defense rate evaluation, shrunk toward league baselines with a dynamic home-advantage model. Outlier variance is eliminated by Bayesian regression, so early-season samples cannot distort a lambda.
            - paragraph [ref=e133]: P(h,a) = P(lambda_h, h) * P(lambda_a, a) · lambda in [0.6, 3.2]
          - article [ref=e134]:
            - generic [ref=e135]:
              - generic [ref=e136]:
                - generic [ref=e137]: "03"
                - heading "Automated +EV Scanner, Six Leagues" [level=3] [ref=e138]
              - paragraph [ref=e139]: Every odds cycle across Premier League, La Liga, Serie A, Bundesliga, Ligue 1 and the Champions League runs through the guardrails. Only picks with a real margin of safety reach the feed.
            - paragraph [ref=e140]: EV = p * o - 1 · flag when MOS >= 4 pts
          - article [ref=e141]:
            - generic [ref=e142]:
              - generic [ref=e143]:
                - generic [ref=e144]: "04"
                - heading "Quarter-Kelly Risk Allocation" [level=3] [ref=e145]
              - paragraph [ref=e146]: Full Kelly assumes perfect calibration, which no model has. Matchlytics stakes a quarter of the theoretical maximum and hard-caps it, keeping the bankroll curve forgiving on variance.
            - paragraph [ref=e147]: f* = 0.25 * (b * p - q) / b · cap 2.5%
      - generic [ref=e149]:
        - generic [ref=e150]:
          - paragraph [ref=e151]: 02Technology
          - heading "A three-stage proprietary workflow, from raw consensus to sized execution." [level=2] [ref=e152]
          - paragraph [ref=e153]: "One continuous loop inside an Enterprise-Grade Low-Latency Quant Pipeline & Real-Time Sync Engine: normalize the market, model it, then convert the discrepancy into disciplined capital allocation. Every stage is deterministic and auditable."
        - list [ref=e154]:
          - listitem [ref=e155]:
            - generic [ref=e156]:
              - generic [ref=e157]: STEP 1
              - heading "Consensus Odds Normalization" [level=3] [ref=e158]
              - paragraph [ref=e159]: Every odds cycle across Premier League, La Liga, Serie A, Bundesliga, Ligue 1 and Champions League is ingested, stripped of bookmaker margin (vig), and de-biased.
            - generic [ref=e160]: Active
          - listitem [ref=e163]:
            - generic [ref=e164]:
              - generic [ref=e165]: STEP 2
              - heading "Bivariate Poisson & Bayesian Modeling" [level=3] [ref=e166]
              - paragraph [ref=e167]: The Proprietary Bivariate Poisson & Bayesian Estimation Core evaluates simultaneous attack and defense rates, applies dynamic home-advantage modeling, and shrinks outlier variance toward league baselines so early-season samples cannot distort a lambda.
            - generic [ref=e168]: Active
          - listitem [ref=e171]:
            - generic [ref=e172]:
              - generic [ref=e173]: STEP 3
              - heading "Execution Edge & Position Sizing" [level=3] [ref=e174]
              - paragraph [ref=e175]: Automated +EV discrepancy detection is paired with constrained Quarter-Kelly capital allocation, hard-capped at 2.5% of bankroll per position, on the Enterprise-Grade Low-Latency Quant Pipeline & Real-Time Sync Engine.
            - generic [ref=e176]: Active
        - generic [ref=e179]:
          - generic [ref=e181]:
            - generic [ref=e182]:
              - generic [ref=e183]:
                - generic [ref=e184]:
                  - heading "6x6 Score Matrix" [level=3] [ref=e185]
                  - paragraph [ref=e186]: Joint goal-score probabilities. Shading encodes mass, amber marks the likeliest scoreline.
                - generic [ref=e187]: EXAMPLE · λ 1.55 / 1.05
              - table [ref=e189]:
                - rowgroup [ref=e190]:
                  - row [ref=e191]:
                    - columnheader "A \\ H" [ref=e192]
                    - columnheader "0" [ref=e193]
                    - columnheader "1" [ref=e194]
                    - columnheader "2" [ref=e195]
                    - columnheader "3" [ref=e196]
                    - columnheader "4" [ref=e197]
                    - columnheader "5" [ref=e198]
                - rowgroup [ref=e199]:
                  - row [ref=e200]:
                    - rowheader "0" [ref=e201]
                    - cell "7.5%" [ref=e202] [cursor=pointer]
                    - cell "11.6%" [ref=e203] [cursor=pointer]
                    - cell "9.0%" [ref=e204] [cursor=pointer]
                    - cell "4.6%" [ref=e205] [cursor=pointer]
                    - cell "1.8%" [ref=e206] [cursor=pointer]
                    - cell "0.6%" [ref=e207] [cursor=pointer]
                  - row [ref=e208]:
                    - rowheader "1" [ref=e209]
                    - cell "7.8%" [ref=e210] [cursor=pointer]
                    - cell "12.2%" [ref=e211] [cursor=pointer]
                    - cell "9.4%" [ref=e212] [cursor=pointer]
                    - cell "4.9%" [ref=e213] [cursor=pointer]
                    - cell "1.9%" [ref=e214] [cursor=pointer]
                    - cell "0.6%" [ref=e215] [cursor=pointer]
                  - row [ref=e216]:
                    - rowheader "2" [ref=e217]
                    - cell "4.1%" [ref=e218] [cursor=pointer]
                    - cell "6.4%" [ref=e219] [cursor=pointer]
                    - cell "4.9%" [ref=e220] [cursor=pointer]
                    - cell "2.6%" [ref=e221] [cursor=pointer]
                    - cell "1.0%" [ref=e222] [cursor=pointer]
                    - cell "0.3%" [ref=e223] [cursor=pointer]
                  - row [ref=e224]:
                    - rowheader "3" [ref=e225]
                    - cell "1.4%" [ref=e226] [cursor=pointer]
                    - cell "2.2%" [ref=e227] [cursor=pointer]
                    - cell "1.7%" [ref=e228] [cursor=pointer]
                    - cell "0.9%" [ref=e229] [cursor=pointer]
                    - cell "0.3%" [ref=e230] [cursor=pointer]
                    - cell "0.1%" [ref=e231] [cursor=pointer]
                  - row [ref=e232]:
                    - rowheader "4" [ref=e233]
                    - cell "0.4%" [ref=e234] [cursor=pointer]
                    - cell "0.6%" [ref=e235] [cursor=pointer]
                    - cell "0.5%" [ref=e236] [cursor=pointer]
                    - cell "0.2%" [ref=e237] [cursor=pointer]
                    - cell "0.1%" [ref=e238] [cursor=pointer]
                    - cell "0.0%" [ref=e239] [cursor=pointer]
                  - row [ref=e240]:
                    - rowheader "5" [ref=e241]
                    - cell "0.1%" [ref=e242] [cursor=pointer]
                    - cell "0.1%" [ref=e243] [cursor=pointer]
                    - cell "0.1%" [ref=e244] [cursor=pointer]
                    - cell "0.0%" [ref=e245] [cursor=pointer]
                    - cell "0.0%" [ref=e246] [cursor=pointer]
                    - cell "0.0%" [ref=e247] [cursor=pointer]
            - generic [ref=e248]:
              - generic [ref=e249]:
                - text: "Selected:"
                - strong [ref=e250]: 1-1
                - text: (DRAW)
              - generic [ref=e251]: 12.2% prob
          - generic [ref=e253]:
            - generic [ref=e254]:
              - generic [ref=e255]:
                - generic [ref=e256]:
                  - heading "+EV Discrepancy Scanner" [level=3] [ref=e257]
                  - paragraph [ref=e258]: Top edges detected across European leagues with Margin of Safety filter.
                - generic [ref=e259]: RADAR ACTIVE
              - generic [ref=e260]:
                - generic [ref=e261]:
                  - generic [ref=e262]:
                    - paragraph [ref=e263]: Aston Villa FC vs Manchester City FC
                    - paragraph [ref=e264]: Manchester City FC Win @ 0.00 ·
                  - generic [ref=e265]: +34.81% EV
                - generic [ref=e267]:
                  - generic [ref=e268]:
                    - paragraph [ref=e269]: ACF Fiorentina vs Como 1907
                    - paragraph [ref=e270]: Como 1907 Win @ 0.00 ·
                  - generic [ref=e271]: +34.67% EV
                - generic [ref=e273]:
                  - generic [ref=e274]:
                    - paragraph [ref=e275]: Brighton & Hove Albion FC vs Crystal Palace FC
                    - paragraph [ref=e276]: Brighton & Hove Albion FC Win @ 0.00 ·
                  - generic [ref=e277]: +32.83% EV
            - paragraph [ref=e279]: Filtered for minimum 4.0 margin of safety threshold.
          - generic [ref=e281]:
            - generic [ref=e282]:
              - generic [ref=e283]:
                - generic [ref=e284]:
                  - heading "Fractional Kelly Staking" [level=3] [ref=e285]
                  - paragraph [ref=e286]: Quarter-Kelly formula hard-capped at 2.5% to protect bankroll variance.
                - generic [ref=e287]: f* = 0.25 · KELLY
              - generic [ref=e288]:
                - generic [ref=e289]:
                  - generic [ref=e290]:
                    - paragraph [ref=e291]: Over 1.5 Goals
                    - paragraph [ref=e292]: Odds 1.50 · Prob 70%
                  - generic [ref=e293]: 2.5% Stake
                - generic [ref=e295]:
                  - generic [ref=e296]:
                    - paragraph [ref=e297]: Home Draw No Bet
                    - paragraph [ref=e298]: Odds 2.00 · Prob 55%
                  - generic [ref=e299]: 2.5% Stake
                - generic [ref=e301]:
                  - generic [ref=e302]:
                    - paragraph [ref=e303]: Away Win Margin 1+
                    - paragraph [ref=e304]: Odds 3.00 · Prob 40%
                  - generic [ref=e305]: 2.5% Stake
            - paragraph [ref=e307]: Automatic cap prevents catastrophic drawdown during volatility clusters.
          - generic [ref=e309]:
            - generic [ref=e310]:
              - generic [ref=e311]:
                - generic [ref=e312]:
                  - heading "Smart Parlay Combinator" [level=3] [ref=e313]
                  - paragraph [ref=e314]: Multi-leg correlation screening to find compounding positive EV.
                - generic [ref=e315]: 2-LEG PARLAY
              - generic [ref=e316]:
                - generic [ref=e317]:
                  - generic [ref=e318]:
                    - generic [ref=e319]: Arsenal vs Chelsea
                    - generic [ref=e320]: "@1.85"
                  - paragraph [ref=e321]: Home Win
                - generic [ref=e322]:
                  - generic [ref=e323]:
                    - generic [ref=e324]: Real Madrid vs Sevilla
                    - generic [ref=e325]: "@1.72"
                  - paragraph [ref=e326]: Over 2.5 Goals
            - generic [ref=e327]:
              - generic [ref=e328]: "Combined Odds: 3.18"
              - generic [ref=e329]: +18.3% EV
      - generic [ref=e331]:
        - generic [ref=e332]:
          - paragraph [ref=e333]: 03Pricing
          - heading "Simple pricing. Serious edge." [level=2] [ref=e334]
          - paragraph [ref=e335]: Start free, upgrade when you are ready. No hidden fees, no surprises.
        - generic [ref=e336]:
          - article [ref=e337]:
            - generic [ref=e338]:
              - generic [ref=e339]:
                - heading "Starter" [level=3] [ref=e340]
                - paragraph [ref=e341]: No card required
              - generic [ref=e342]:
                - paragraph [ref=e343]: Rp 0
                - paragraph [ref=e344]: Daily Horizon
              - list [ref=e345]:
                - listitem [ref=e346]:
                  - generic [ref=e349]: Core 1X2 Probabilities
                - listitem [ref=e350]:
                  - generic [ref=e353]: Standard Analytics
                - listitem [ref=e354]:
                  - generic [ref=e357]: Match summary and scoreline readout
                - listitem [ref=e358]:
                  - generic [ref=e361]: Watchlist and league filters
            - link "Access Terminal" [ref=e362] [cursor=pointer]:
              - /url: https://app.imortifex.me/
          - article [ref=e363]:
            - generic [ref=e364]: Most Selected
            - generic [ref=e365]:
              - generic [ref=e366]:
                - heading "Pro Pass" [level=3] [ref=e367]
                - paragraph [ref=e368]: Billed monthly &middot; cancel anytime
              - generic [ref=e369]:
                - paragraph [ref=e370]: Rp 149.000
                - paragraph [ref=e371]: 7-Day Horizon
              - list [ref=e372]:
                - listitem [ref=e373]:
                  - generic [ref=e376]: Full +EV Scanner
                - listitem [ref=e377]:
                  - generic [ref=e380]: 6x6 Heatmaps
                - listitem [ref=e381]:
                  - generic [ref=e384]: Kelly Sizing
                - listitem [ref=e385]:
                  - generic [ref=e388]: Parlay Engine
            - link "Subscribe to Pro" [ref=e389] [cursor=pointer]:
              - /url: https://app.imortifex.me/
          - article [ref=e390]:
            - generic [ref=e391]: Institutional Value
            - generic [ref=e392]:
              - generic [ref=e393]:
                - heading "Season Pass" [level=3] [ref=e394]
                - paragraph [ref=e395]: One season, one rate
              - generic [ref=e396]:
                - paragraph [ref=e397]: Rp 999.000
                - paragraph [ref=e398]: 30-Day Full Horizon
              - list [ref=e399]:
                - listitem [ref=e400]:
                  - generic [ref=e403]: All Pro Pass Capabilities
                - listitem [ref=e404]:
                  - generic [ref=e407]: Priority Pipeline Refresh
                - listitem [ref=e408]:
                  - generic [ref=e411]: Full Season Archive
                - listitem [ref=e412]:
                  - generic [ref=e415]: Dedicated Quantitative Desk
            - link "Unlock Full Season" [ref=e416] [cursor=pointer]:
              - /url: https://app.imortifex.me/
        - paragraph [ref=e417]: All tiers launch into the same verified dashboard at app.imortifex.me/.
      - generic [ref=e419]:
        - generic [ref=e420]:
          - paragraph [ref=e421]: 04Performance
          - heading "Numbers earned match by match, not promised in a slide deck." [level=2] [ref=e422]
          - paragraph [ref=e423]: "The engine tracks itself: every flagged pick is settled at official results, scored on calibration, and rolled into the bankroll simulator you can inspect in full below."
        - generic [ref=e425]:
          - generic [ref=e426]:
            - generic [ref=e427]:
              - heading "Settlement Ledger" [level=3] [ref=e428]
              - paragraph [ref=e429]: Post-match reconciliation across monitored fixtures.
            - button "Inspect Backtest Ledger" [ref=e431] [cursor=pointer]
          - generic [ref=e432]:
            - generic [ref=e433]:
              - paragraph [ref=e434]: Monitored Settlements
              - paragraph [ref=e435]: "43"
            - generic [ref=e436]:
              - paragraph [ref=e437]: Model Win Rate
              - paragraph [ref=e438]: 0.0%
            - generic [ref=e439]:
              - paragraph [ref=e440]: Brier Calibration Score
              - paragraph [ref=e441]: Calculated in terminal
            - generic [ref=e442]:
              - paragraph [ref=e443]: Equity Change
              - generic [ref=e444]: +0.0%
    - contentinfo [ref=e446]:
      - generic [ref=e447]:
        - generic [ref=e448]:
          - generic [ref=e449]:
            - generic [ref=e452]:
              - paragraph [ref=e453]: MATCHLYTICS
              - paragraph [ref=e454]: by imortifex
            - paragraph [ref=e455]: "A proprietary quantitative terminal for systematic edge discovery across major European leagues: consensus de-vigging, bivariate Poisson modeling, and constraint-capped fractional Kelly staking, settled against official results on every cycle."
          - generic [ref=e456]:
            - button "Contact Support" [ref=e457] [cursor=pointer]
            - link "Open Terminal" [ref=e458] [cursor=pointer]:
              - /url: https://app.imortifex.me/
            - link "Methodology Brief" [ref=e459] [cursor=pointer]:
              - /url: "#methodology"
            - link "Pricing Architecture" [ref=e460] [cursor=pointer]:
              - /url: "#pricing"
            - paragraph [ref=e461]: SYSTEM STATUS · NOMINAL · synced 05:38 pm
        - generic [ref=e462]:
          - paragraph [ref=e463]: Strictly 18+. Model outputs are mathematical estimates for informational and risk management purposes. Exercise disciplined bankroll management.
          - paragraph [ref=e464]: © 2026 Matchlytics by imortifex. All rights reserved.
  - alert "Install application prompt":
    - generic:
      - generic:
        - generic:
          - paragraph: Install Matchlytics
          - paragraph: Get instant +EV alerts, offline access, and a native app experience.
        - button "Dismiss install prompt"
      - generic:
        - generic: Instant Alerts
        - generic: Offline Access
        - generic: Native App
      - generic:
        - button "Not Now"
        - button "Install App"
```

# Test source

```ts
  1   | // E2E tests for Matchlytics frontend
  2   | import { test, expect } from '@playwright/test'
  3   | 
  4   | test.describe('Landing Page', () => {
  5   |   test('loads with title', async ({ page }) => {
  6   |     await page.goto('/')
  7   |     await page.waitForLoadState('networkidle')
  8   |     await expect(page).toHaveTitle(/Matchlytics/i)
  9   |   })
  10  | 
  11  |   test('renders main content after hydration', async ({ page }) => {
  12  |     await page.goto('/')
  13  |     // Wait for React to hydrate and render the SPA
  14  |     await page.waitForSelector('text=Matchlytics', { timeout: 15000 })
  15  |     // Should see landing page elements
  16  |     const bodyText = await page.locator('body').textContent()
  17  |     expect(bodyText).toContain('Matchlytics')
  18  |   })
  19  | 
  20  |   test('shows CTA buttons', async ({ page }) => {
  21  |     await page.goto('/')
  22  |     await page.waitForSelector('text=Matchlytics', { timeout: 15000 })
  23  |     await page.waitForTimeout(2000)
  24  |     // Launch Terminal is an <a> tag, View Pricing is a <button>
  25  |     const launchLink = page.getByRole('link', { name: 'Launch Terminal' })
  26  |     const pricingBtn = page.getByRole('button', { name: 'View Pricing' })
  27  |     await expect(launchLink).toBeVisible()
  28  |     await expect(pricingBtn).toBeVisible()
  29  |   })
  30  | 
  31  |   test('shows pricing tiers', async ({ page }) => {
  32  |     await page.goto('/')
  33  |     await page.waitForSelector('text=Matchlytics', { timeout: 15000 })
  34  |     const starter = page.getByRole('heading', { name: 'Starter' })
  35  |     const pro = page.getByRole('heading', { name: 'Pro Pass' })
  36  |     const season = page.getByRole('heading', { name: 'Season Pass' })
  37  |     await expect(starter).toBeVisible()
  38  |     await expect(pro).toBeVisible()
  39  |     await expect(season).toBeVisible()
  40  |   })
  41  | 
  42  |   test('navigates to dashboard via Launch Terminal on localhost', async ({ page }) => {
  43  |     await page.goto('/')
  44  |     await page.waitForSelector('text=Matchlytics', { timeout: 15000 })
  45  |     await page.waitForTimeout(2000)
  46  |     const launchLink = page.getByRole('link', { name: 'Launch Terminal' })
  47  |     await launchLink.click()
  48  |     // On localhost, should switch to dashboard view state
  49  |     await page.waitForTimeout(2000)
  50  |     const url = page.url()
  51  |     // Either stayed on same page with ?view=app or navigated
  52  |     expect(url.includes('localhost') || url.includes('view=app')).toBeTruthy()
  53  |   })
  54  | 
  55  |   test('navigation links are present', async ({ page }) => {
  56  |     await page.goto('/')
  57  |     await page.waitForSelector('text=Matchlytics', { timeout: 15000 })
  58  |     await page.waitForTimeout(2000)
  59  |     // Use exact text matching to avoid strict mode violation
  60  |     const methodology = page.getByRole('link', { name: 'Methodology', exact: true })
  61  |     const pricing = page.getByRole('link', { name: 'Pricing', exact: true })
  62  |     await expect(methodology).toBeVisible()
  63  |     await expect(pricing).toBeVisible()
  64  |   })
  65  | })
  66  | 
  67  | test.describe('Em Dash Compliance (R-02)', () => {
  68  |   test('no em dashes in visible UI text', async ({ page }) => {
  69  |     await page.goto('/')
  70  |     await page.waitForSelector('text=Matchlytics', { timeout: 15000 })
  71  |     const bodyText = await page.locator('body').textContent()
  72  |     // Check for em dash (—) and en dash used as em dash (–)
  73  |     const emDashCount = (bodyText.match(/—/g) || []).length
  74  |     expect(emDashCount).toBe(0)
  75  |   })
  76  | })
  77  | 
  78  | test.describe('Build Integrity', () => {
  79  |   test('no console errors on load', async ({ page }) => {
  80  |     const errors = []
  81  |     page.on('console', (msg) => {
  82  |       if (msg.type() === 'error') {
  83  |         const text = msg.text()
  84  |         // Ignore known benign errors
  85  |         if (!text.includes('Supabase') && !text.includes('NetworkError')) {
  86  |           errors.push(text)
  87  |         }
  88  |       }
  89  |     })
  90  |     await page.goto('/')
  91  |     await page.waitForSelector('text=Matchlytics', { timeout: 15000 })
  92  |     await page.waitForTimeout(2000)
> 93  |     expect(errors).toHaveLength(0)
      |                    ^ Error: expect(received).toHaveLength(expected)
  94  |   })
  95  | 
  96  |   test('all links have valid hrefs or onClick', async ({ page }) => {
  97  |     await page.goto('/')
  98  |     await page.waitForSelector('text=Matchlytics', { timeout: 15000 })
  99  |     const links = await page.locator('a[href]').all()
  100 |     for (const link of links.slice(0, 10)) {
  101 |       const href = await link.getAttribute('href')
  102 |       const onClick = await link.getAttribute('onclick')
  103 |       // Each link should have either a valid href or an onClick handler
  104 |       expect(href !== null || onClick !== null).toBeTruthy()
  105 |     }
  106 |   })
  107 | })
  108 | 
  109 | test.describe('Dashboard View', () => {
  110 |   test('dashboard loads with auth loading state', async ({ page }) => {
  111 |     await page.goto('/?view=app')
  112 |     await page.waitForTimeout(3000)
  113 |     // Should show either landing, login, or dashboard
  114 |     const bodyText = await page.locator('body').textContent()
  115 |     expect(bodyText.length).toBeGreaterThan(100)
  116 |   })
  117 | 
  118 |   test('app header renders on dashboard', async ({ page }) => {
  119 |     await page.goto('/?view=app')
  120 |     await page.waitForTimeout(4000)
  121 |     // Check that page has loaded some content
  122 |     const bodyText = await page.locator('body').textContent()
  123 |     expect(bodyText.length).toBeGreaterThan(50)
  124 |   })
  125 | })
  126 | 
  127 | test.describe('Responsive Layout', () => {
  128 |   test('mobile layout renders correctly', async ({ page }) => {
  129 |     await page.setViewportSize({ width: 375, height: 812 })
  130 |     await page.goto('/')
  131 |     await page.waitForSelector('text=Matchlytics', { timeout: 15000 })
  132 |     // Should still show content on mobile
  133 |     const bodyText = await page.locator('body').textContent()
  134 |     expect(bodyText).toContain('Matchlytics')
  135 |   })
  136 | 
  137 |   test('desktop layout renders correctly', async ({ page }) => {
  138 |     await page.setViewportSize({ width: 1280, height: 800 })
  139 |     await page.goto('/')
  140 |     await page.waitForSelector('text=Matchlytics', { timeout: 15000 })
  141 |     const bodyText = await page.locator('body').textContent()
  142 |     expect(bodyText).toContain('Matchlytics')
  143 |   })
  144 | })
  145 | 
```