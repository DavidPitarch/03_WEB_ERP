/**
 * Flujo 1: Autenticación backoffice
 *
 * Verifica la página de login, la gestión de credenciales incorrectas
 * y la redirección tras un login exitoso.
 */
import { test, expect } from '@playwright/test';

// Login tests operate on a blank session — no stored auth
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login — backoffice', () => {
  test('carga la página de login con todos los campos', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Entrar');
    await expect(page.locator('h1')).toContainText('ERP');
  });

  test('credenciales incorrectas muestran el mensaje de error', async ({ page }) => {
    // Intercept Supabase auth so the test runs without a live connection
    await page.route('**/auth/v1/token**', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid login credentials',
        }),
      })
    );

    await page.goto('/');
    await page.fill('#email', 'noexiste@test.com');
    await page.fill('#password', 'wrongpassword123');
    await page.click('button[type="submit"]');

    await expect(page.locator('.form-error')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.form-error')).toContainText('Credenciales incorrectas');
  });

  test('login correcto redirige al área de expedientes', async ({ page }) => {
    test.skip(
      !process.env.TEST_BACKOFFICE_EMAIL,
      'Requiere TEST_BACKOFFICE_EMAIL + TEST_BACKOFFICE_PASSWORD'
    );

    await page.goto('/');
    await page.fill('#email', process.env.TEST_BACKOFFICE_EMAIL!);
    await page.fill('#password', process.env.TEST_BACKOFFICE_PASSWORD!);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/expedientes|dashboard/, { timeout: 25_000 });
  });
});
