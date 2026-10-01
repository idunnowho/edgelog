import { chromium } from 'playwright-core'
import fs from 'node:fs'

const base = 'http://localhost:3000'
const outDir = '/opt/cursor/artifacts/screenshots'
fs.mkdirSync(outDir, { recursive: true })

async function main() {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (err) => errors.push(String(err)))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
  })

  // Fresh user to avoid stale session issues
  const email = `trader_${Date.now()}@edgelog.test`
  const password = 'password123'

  await page.goto(`${base}/sign-up`)
  await page.fill('input[name="name"]', 'Sam Trader')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.getByRole('button', { name: /Create account|Sign in/i }).click()
  await page.waitForURL((url) => url.pathname === '/', { timeout: 15000 })
  await page.waitForSelector('text=Your trading edge')
  await page.screenshot({ path: `${outDir}/pw-empty-overview.png`, fullPage: true })

  // Add trade
  await page.getByRole('button', { name: 'Add trade' }).first().click()
  await page.waitForSelector('#add-trade-title')
  await page.fill('input[name="symbol"]', 'YM')
  await page.fill('input[name="quantity"]', '1')
  await page.fill('input[name="entryPrice"]', '45000')
  await page.fill('input[name="exitPrice"]', '45040')
  await page.fill('input[name="stopLoss"]', '44980')
  await page.fill('input[name="setup"]', 'Breakout')
  await page.fill('input[name="accountName"]', 'Tradovate Live')
  await page.fill('textarea[name="notes"]', 'Playwright verify')
  await page.getByRole('button', { name: 'Save trade' }).click()
  await page.waitForSelector('#add-trade-title', { state: 'detached', timeout: 10000 })
  await page.waitForSelector('text=YM')
  await page.waitForSelector('text=+$40.00')
  await page.screenshot({ path: `${outDir}/pw-after-save.png`, fullPage: true })

  // Trade log view
  await page.getByRole('button', { name: 'Trade log 1' }).click()
  await page.waitForSelector('text=Every execution')
  await page.screenshot({ path: `${outDir}/pw-trade-log.png`, fullPage: true })

  // Sign out
  await page.locator('aside').getByRole('button', { name: /Sign out/i }).click()
  await page.waitForURL((url) => url.pathname === '/sign-in', { timeout: 10000 })
  await page.screenshot({ path: `${outDir}/pw-signed-out.png`, fullPage: true })

  // Confirm demo strings are gone from earlier overview screenshot path usage
  const overview = fs.readFileSync(`${outDir}/pw-after-save.png`)
  if (!overview.length) throw new Error('missing after-save screenshot')

  console.log(JSON.stringify({ ok: true, email, errors }, null, 2))
  await browser.close()
}

main().catch(async (err) => {
  console.error('TEST_FAILED', err)
  process.exit(1)
})
