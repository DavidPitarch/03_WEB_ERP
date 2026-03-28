/**
 * Flujo 2: Alta de expediente
 *
 * Navega a /expedientes/nuevo, rellena el formulario con datos maestros
 * simulados y verifica que la creación redirige al detalle del expediente.
 */
import { test, expect } from '@playwright/test';

const HAS_AUTH = !!(
  process.env.TEST_BACKOFFICE_EMAIL && process.env.TEST_BACKOFFICE_PASSWORD
);

// Master data that the form needs before it becomes interactive
const MOCK_COMPANIA = { id: 'cia-001', nombre: 'Aseguradora Test', activa: true };
const MOCK_EMPRESA = { id: 'emp-001', nombre: 'Empresa Facturadora Test', activa: true };
const MOCK_TIPO = { id: 'tipo-001', clave: 'hogar', label: 'Hogar' };
const CREATED_EXP = { id: 'exp-e2e-001', numero_expediente: 'EXP-2024-E2E-001' };

test.describe('Nuevo expediente', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!HAS_AUTH, 'Requiere TEST_BACKOFFICE_EMAIL + TEST_BACKOFFICE_PASSWORD');

    // Mock catalog/master endpoints so tests run without a seeded DB
    await page.route('**/masters/companias**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [MOCK_COMPANIA], error: null }),
      })
    );
    await page.route('**/masters/empresas**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [MOCK_EMPRESA], error: null }),
      })
    );
    await page.route('**/masters/catalogos**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [MOCK_TIPO], error: null }),
      })
    );
    // Silence asegurado search
    await page.route('**/masters/asegurados**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], error: null }),
      })
    );
  });

  test('formulario carga con todos los campos obligatorios', async ({ page }) => {
    await page.goto('/expedientes/nuevo');

    await expect(page.locator('h2')).toContainText('Nuevo expediente');
    // Required selects
    await expect(page.locator('select').first()).toBeVisible();
    // Required description textarea
    await expect(page.locator('textarea').first()).toBeVisible();
    // Submit button
    await expect(page.locator('button[type="submit"]')).toContainText('Crear expediente');
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
  });

  test('submit sin rellenar campos obligatorios no navega', async ({ page }) => {
    await page.goto('/expedientes/nuevo');
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    const currentUrl = page.url();
    await page.click('button[type="submit"]');

    // Either browser validation blocks navigation or a .form-error appears
    const errorVisible = await page.locator('.form-error').isVisible().catch(() => false);
    const sameUrl = page.url() === currentUrl;
    expect(errorVisible || sameUrl).toBeTruthy();
  });

  test('formulario completo crea expediente y navega al detalle', async ({ page }) => {
    // Mock the create POST
    await page.route('**/expedientes', async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ data: CREATED_EXP, error: null }),
        });
      }
      return route.continue();
    });

    await page.goto('/expedientes/nuevo');

    // Wait for selects to be populated by mocked API
    await page.locator('select').first().waitFor({ state: 'visible' });

    // Compañía — select the only option
    await page.locator('select').nth(0).selectOption({ index: 1 });
    // Empresa facturadora
    await page.locator('select').nth(1).selectOption({ index: 1 });
    // Tipo de siniestro
    await page.locator('select').nth(2).selectOption({ index: 1 });

    // Descripción
    await page.locator('textarea').first().fill('Daños por agua en cocina — test e2e');

    // Asegurado (nuevo) — fill required fields
    const inputs = page.locator('input[type="text"], input:not([type])');
    await inputs.nth(0).fill('Juan');      // nombre
    await inputs.nth(1).fill('García');    // apellidos
    await inputs.nth(2).fill('612345678'); // teléfono

    // Dirección siniestro
    const allInputs = page.locator('input');
    const count = await allInputs.count();
    // Fill the last four required address inputs
    await allInputs.nth(count - 4).fill('Calle Test 1');
    await allInputs.nth(count - 3).fill('28001');
    await allInputs.nth(count - 2).fill('Madrid');
    await allInputs.nth(count - 1).fill('Madrid');

    await page.click('button[type="submit"]');

    // After successful creation, the app navigates to the expediente detail
    await expect(page).toHaveURL(/expedientes\/exp-e2e-001/, { timeout: 10_000 });
  });
});
