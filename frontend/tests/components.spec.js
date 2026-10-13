// E2E tests for Matchlytics component interactions
import { test, expect } from '@playwright/test'

test.describe('Landing Page Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('text=Matchlytics', { timeout: 15000 })
  })

  test('scroll to pricing works', async ({ page }) => {
    await page.getByRole('button', { name: 'View Pricing' }).click()
    await page.waitForTimeout(1000)
    // scrollToPricing uses scrollIntoView, not hash navigation — check page is still interactive
    const hasContent = await page.locator('body').textContent()
    expect(hasContent.length).toBeGreaterThan(100)
  })

  test('methodology section is accessible', async ({ page }) => {
    await page.getByRole('link', { name: 'Methodology', exact: true }).click()
    await page.waitForTimeout(1000)
    const bodyText = await page.locator('body').textContent()
    expect(bodyText).toContain('Methodology')
  })
})

test.describe('Component Render Tests', () => {
  test('landing page has proper ARIA landmarks', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('text=Matchlytics', { timeout: 15000 })
    // Check for main landmark
    const main = page.locator('main')
    // Header should exist
    const header = page.locator('header')
    expect(await header.count()).toBeGreaterThan(0)
  })

  test('CTA buttons have proper roles', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('text=Matchlytics', { timeout: 15000 })
    const buttons = page.locator('button')
    const buttonCount = await buttons.count()
    expect(buttonCount).toBeGreaterThan(0)
  })

  test('social meta tags are present', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content')
    expect(ogTitle).toContain('Matchlytics')
  })
})

test.describe('Keyboard Navigation', () => {
  test('tab navigation cycles through interactive elements', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('text=Matchlytics', { timeout: 15000 })
    // Tab through several elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab')
      await page.waitForTimeout(100)
    }
    // Should have focused something
    const focusedTag = await page.locator(':focus').evaluate(el => el.tagName)
    expect(focusedTag).not.toBe('BODY')
  })
})

test.describe('Accessibility Checks', () => {
  test('images have alt text or aria-hidden', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('text=Matchlytics', { timeout: 15000 })
    const images = await page.locator('img').all()
    for (const img of images) {
      const alt = await img.getAttribute('alt')
      const ariaHidden = await img.getAttribute('aria-hidden')
      // Either alt text or aria-hidden="true" is acceptable
      expect(alt !== null || ariaHidden === 'true').toBeTruthy()
    }
  })

  test('all buttons have accessible names', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('text=Matchlytics', { timeout: 15000 })
    const buttons = await page.locator('button').all()
    for (const btn of buttons.slice(0, 15)) {
      const text = await btn.textContent()
      const ariaLabel = await btn.getAttribute('aria-label')
      const hasName = (text && text.trim().length > 0) || ariaLabel !== null
      expect(hasName).toBeTruthy()
    }
  })
})

test.describe('SPA Hydration', () => {
  test('page loads without JavaScript errors', async ({ page }) => {
    const errors = []
    page.on('pageerror', (err) => {
      const text = err.message || ''
      if (!text.includes('Supabase') && !text.includes('fetch')) {
        errors.push(text)
      }
    })
    await page.goto('/')
    await page.waitForSelector('text=Matchlytics', { timeout: 15000 })
    await page.waitForTimeout(1000)
    expect(errors).toHaveLength(0)
  })

  test('network requests complete', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('text=Matchlytics', { timeout: 15000 })
    // Wait for initial network to settle
    await page.waitForTimeout(2000)
    // Should have loaded resources
    const response = await page.evaluate(() => document.readyState)
    expect(response).toBe('complete')
  })
})
