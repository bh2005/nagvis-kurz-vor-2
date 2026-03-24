/**
 * Playwright Smoke-Tests – minimale Prüfung dass die App überhaupt startet.
 *
 * Voraussetzung: Backend läuft auf localhost:8008 (DEMO_MODE=true),
 * wird automatisch via playwright.config.mjs webServer-Option gestartet.
 */
import { test, expect } from '@playwright/test'

test('App lädt und zeigt NagVis 2 im Titel', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/NagVis 2/)
})

test('Demo-Map öffnet sich automatisch im DEMO_MODE', async ({ page }) => {
  await page.goto('/')
  // Map-Container muss sichtbar sein
  const mapArea = page.locator('#map-area')
  await expect(mapArea).toBeVisible({ timeout: 10_000 })
})

test('Ctrl+E aktiviert den Edit-Mode (Banner erscheint)', async ({ page }) => {
  await page.goto('/')
  // Warten bis Map geladen
  await page.locator('#map-area').waitFor({ state: 'visible', timeout: 10_000 })

  await page.keyboard.press('Control+e')

  const banner = page.locator('#nv2-edit-banner')
  await expect(banner).toBeVisible({ timeout: 3_000 })
})
