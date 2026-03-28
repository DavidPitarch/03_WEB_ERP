/**
 * Flujo 3: Transición de estado de un expediente
 *
 * Carga el detalle de un expediente en estado NUEVO y verifica que
 * el botón de transición dispara la llamada correcta y actualiza el badge.
 */
import { test, expect } from '@playwright/test';

const HAS_AUTH = !!(
  process.env.TEST_BACKOFFICE_EMAIL && process.env.TEST_BACKOFFICE_PASSWORD
);

const EXP_ID = 'exp-e2e-trans-001';

const mockExpediente = (estado: string) => ({
  id: EXP_ID,
  numero_expediente: 'EXP-2024-T-001',
  estado,
  tipo_siniestro: 'hogar',
  prioridad: 'media',
  descripcion: 'Test expediente para transición',
  direccion_siniestro: 'Calle Test 1',
  localidad: 'Madrid',
  provincia: 'Madrid',
  codigo_postal: '28001',
  fecha_encargo: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  compania: { nombre: 'Aseguradora Test' },
  asegurado: { nombre: 'Juan', apellidos: 'García', telefono: '612345678' },
});

test.describe('Transición de estado', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!HAS_AUTH, 'Requiere TEST_BACKOFFICE_EMAIL + TEST_BACKOFFICE_PASSWORD');
  });

  test('expediente en NUEVO muestra el botón de transición correcto', async ({ page }) => {
    await page.route(`**/expedientes/${EXP_ID}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockExpediente('NUEVO'), error: null }),
      })
    );
    await page.route(`**/expedientes/${EXP_ID}/**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], error: null }),
      })
    );
    await page.route('**/pedidos**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], error: null }),
      })
    );

    await page.goto(`/expedientes/${EXP_ID}`);

    // Wait for expediente data to render
    await expect(page.locator('.detail-header, h2').first()).toBeVisible({ timeout: 10_000 });

    // The NUEVO→NO_ASIGNADO transition button should be visible
    await expect(
      page.getByRole('button', { name: 'Marcar como no asignado' })
    ).toBeVisible();

    // Current state badge shows NUEVO
    await expect(page.locator('.badge, .estado-badge').first()).toContainText(/Nuevo/i);
  });

  test('clic en transición llama a la API y actualiza el estado mostrado', async ({ page }) => {
    let transitionCalled = false;

    // Initially return NUEVO state
    await page.route(`**/expedientes/${EXP_ID}`, async (route) => {
      const state = transitionCalled ? 'NO_ASIGNADO' : 'NUEVO';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockExpediente(state), error: null }),
      });
    });
    await page.route(`**/expedientes/${EXP_ID}/**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], error: null }),
      })
    );
    await page.route('**/pedidos**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], error: null }),
      })
    );

    // Mock the transition PATCH endpoint
    await page.route(`**/expedientes/${EXP_ID}/transicion`, async (route) => {
      transitionCalled = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: mockExpediente('NO_ASIGNADO'),
          error: null,
        }),
      });
    });

    await page.goto(`/expedientes/${EXP_ID}`);
    await expect(page.getByRole('button', { name: 'Marcar como no asignado' })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole('button', { name: 'Marcar como no asignado' }).click();

    // Confirm dialog (if any) — expediente NUEVO→NO_ASIGNADO has no confirm prompt
    // Transition should have been called
    await expect
      .poll(() => transitionCalled, { timeout: 8_000 })
      .toBeTruthy();

    // After re-fetch, state badge should reflect NO_ASIGNADO
    await expect(page.locator('.badge, .estado-badge').first()).toContainText(
      /No asignado/i,
      { timeout: 8_000 }
    );
  });
});
