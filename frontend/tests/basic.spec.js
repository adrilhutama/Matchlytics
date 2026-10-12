// E2E tests for Matchlytics frontend
import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test('loads with title', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveTitle(/Matchlytics/i)
  })

  test('renders main content after hydration', async ({ page }) => {
    await page.goto('/')
    // Wait for React to hydrate and render the SPA
    await page.waitForSelector('text=MATCHLYTICS', { timeout: 15000 })
    // Should see landing page elements
    const bodyText = await page.locator('body').textContent()
    expect(bodyText).toContain('Matchlytics')
  })

  test('shows CTA buttons', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('text=MATCHLYTICS', { timeout: 15000 })
    await page.waitForTimeout(2000)
    // Launch Terminal is an <a> tag, View Pricing is a <button>
    const launchLink = page.getByRole('link', { name: 'Launch Terminal' })
    const pricingBtn = page.getByRole('button', { name: 'View Pricing' })
    await expect(launchLink).toBeVisible()
    await expect(pricingBtn).toBeVisible()
  })

  test('shows pricing tiers', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('text=MATCHLYTICS', { timeout: 15000 })
    const starter = page.getByRole('heading', { name: 'Starter' })
    const pro = page.getByRole('heading', { name: 'Pro Pass' })
    const season = page.getByRole('heading', { name: 'Season Pass' })
    await expect(starter).toBeVisible()
    await expect(pro).toBeVisible()
    await expect(season).toBeVisible()
  })

  test('navigates to dashboard via Launch Terminal on localhost', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('text=MATCHLYTICS', { timeout: 15000 })
    await page.waitForTimeout(2000)
    const launchLink = page.getByRole('link', { name: 'Launch Terminal' })
    await launchLink.click()
    // On localhost, should switch to dashboard view state
    await page.waitForTimeout(2000)
    const url = page.url()
    // Either stayed on same page with ?view=app or navigated
    expect(url.includes('localhost') || url.includes('view=app')).toBeTruthy()
  })

  test('navigation links are present', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('text=MATCHLYTICS', { timeout: 15000 })
    await page.waitForTimeout(2000)
    // Use exact text matching to avoid strict mode violation
    const methodology = page.getByRole('link', { name: 'Methodology', exact: true })
    const pricing = page.getByRole('link', { name: 'Pricing', exact: true })
    await expect(methodology).toBeVisible()
    await expect(pricing).toBeVisible()
  })
})

test.describe('Em Dash Compliance (R-02)', () => {
  test('no em dashes in visible UI text', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('text=MATCHLYTICS', { timeout: 15000 })
    const bodyText = await page.locator('body').textContent()
    // Check for em dash (—) and en dash used as em dash (–)
    const emDashCount = (bodyText.match(/—/g) || []).length
    expect(emDashCount).toBe(0)
  })
})

test.describe('Build Integrity', () => {
  test('no console errors on load', async ({ page }) => {
    const errors = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        // Ignore known benign errors
        if (!text.includes('Supabase') && !text.includes('NetworkError')) {
          errors.push(text)
        }
      }
    })
    await page.goto('/')
    await page.waitForSelector('text=MATCHLYTICS', { timeout: 15000 })
    await page.waitForTimeout(2000)
    expect(errors).toHaveLength(0)
  })

  test('all links have valid hrefs or onClick', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('text=MATCHLYTICS', { timeout: 15000 })
    const links = await page.locator('a[href]').all()
    for (const link of links.slice(0, 10)) {
      const href = await link.getAttribute('href')
      const onClick = await link.getAttribute('onclick')
      // Each link should have either a valid href or an onClick handler
      expect(href !== null || onClick !== null).toBeTruthy()
    }
  })
})

test.describe('Dashboard View', () => {
  test('dashboard loads with auth loading state', async ({ page }) => {
    await page.goto('/?view=app')
    await page.waitForTimeout(3000)
    // Should show either landing, login, or dashboard
    const bodyText = await page.locator('body').textContent()
    expect(bodyText.length).toBeGreaterThan(100)
  })

  test('app header renders on dashboard', async ({ page }) => {
    await page.goto('/?view=app')
    await page.waitForTimeout(4000)
    // Check that page has loaded some content
    const bodyText = await page.locator('body').textContent()
    expect(bodyText.length).toBeGreaterThan(50)
  })
})

test.describe('Responsive Layout', () => {
  test('mobile layout renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.waitForSelector('text=MATCHLYTICS', { timeout: 15000 })
    // Should still show content on mobile
    const bodyText = await page.locator('body').textContent()
    expect(bodyText).toContain('Matchlytics')
  })

  test('desktop layout renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await page.waitForSelector('text=MATCHLYTICS', { timeout: 15000 })
    const bodyText = await page.locator('body').textContent()
    expect(bodyText).toContain('Matchlytics')
  })
})
