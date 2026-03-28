import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const AUTH_DIR = path.join(__dirname, 'playwright/.auth');
const AUTH_FILE = path.join(AUTH_DIR, 'backoffice.json');
const EMPTY_STATE = JSON.stringify({ cookies: [], origins: [] });

export default async function globalSetup() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const email = process.env.TEST_BACKOFFICE_EMAIL;
  const password = process.env.TEST_BACKOFFICE_PASSWORD;
  const baseURL = process.env.TEST_BACKOFFICE_URL ?? 'http://localhost:5173';

  if (!email || !password) {
    fs.writeFileSync(AUTH_FILE, EMPTY_STATE);
    console.log('[e2e] TEST_BACKOFFICE_EMAIL not set — auth-dependent tests will be skipped');
    return;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/expedientes|dashboard/, { timeout: 25000 });
    await page.context().storageState({ path: AUTH_FILE });
    console.log('[e2e] Backoffice session saved to playwright/.auth/backoffice.json');
  } catch (err) {
    // Write empty state so tests can skip gracefully instead of crashing
    fs.writeFileSync(AUTH_FILE, EMPTY_STATE);
    console.error('[e2e] Auth setup failed:', err);
  } finally {
    await browser.close();
  }
}
