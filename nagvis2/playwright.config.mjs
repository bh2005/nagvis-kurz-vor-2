import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './frontend/tests/e2e',
  timeout:  30_000,
  retries:  process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL:    'http://localhost:8008',
    screenshot: 'only-on-failure',
    video:      'retain-on-failure',
  },

  // Nur Chromium – für schnelle Smoke-Tests reicht ein Browser
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Backend automatisch starten (DEMO_MODE=true → kein Nagios/Checkmk nötig)
  webServer: {
    cwd:                'backend',
    command:            'DEMO_MODE=true python -m uvicorn main:app --host 0.0.0.0 --port 8008',
    url:                'http://localhost:8008/api/health',
    reuseExistingServer: !process.env.CI,
    timeout:            20_000,
    stdout:             'pipe',
    stderr:             'pipe',
  },
})
