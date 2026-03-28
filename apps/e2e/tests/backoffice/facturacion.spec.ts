/**
 * Flujo 4: Facturación
 *
 * Navega a /facturas, verifica que la tabla se rellena con datos reales
 * o simulados, y que hacer clic en una fila navega al detalle.
 */
import { test, expect } from '@playwright/test';

const HAS_AUTH = !!(
  process.env.TEST_BACKOFFICE_EMAIL && process.env.TEST_BACKOFFICE_PASSWORD
);

const MOCK_FACTURAS = [
  {
    id: 'fac-001',
    numero_factura: 'F-2024-001',
    expediente_id: 'exp-001',
    numero_expediente: 'EXP-2024-001',
    compania_nombre: 'Aseguradora Test',
    empresa_nombre: 'Empresa Test',
    serie: 'A',
    fecha_emision: '2024-03-01',
    fecha_vencimiento: '2024-04-01',
    total: 350.0,
    estado: 'emitida',
    estado_cobro: 'pendiente',
    importe_cobrado: 0,
  },
  {
    id: 'fac-002',
    numero_factura: 'F-2024-002',
    expediente_id: 'exp-002',
    numero_expediente: 'EXP-2024-002',
    compania_nombre: 'Otra Aseguradora',
    empresa_nombre: 'Empresa Test',
    serie: 'A',
    fecha_emision: '2024-03-10',
    fecha_vencimiento: '2024-04-10',
    total: 180.5,
    estado: 'cobrada',
    estado_cobro: 'cobrada',
    importe_cobrado: 180.5,
  },
];

test.describe('Facturación', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!HAS_AUTH, 'Requiere TEST_BACKOFFICE_EMAIL + TEST_BACKOFFICE_PASSWORD');
  });

  test('tabla de facturas carga y muestra los registros', async ({ page }) => {
    await page.route('**/facturas**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_FACTURAS, error: null, meta: { total: 2 } }),
      })
    );
    // Silence companias filter request
    await page.route('**/masters/companias**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], error: null }),
      })
    );

    await page.goto('/facturas');

    await expect(page.locator('h2')).toContainText('Facturas');
    await expect(page.locator('.data-table')).toBeVisible({ timeout: 10_000 });

    // Two rows should be rendered (one per factura)
    const rows = page.locator('.data-table tbody tr');
    await expect(rows).toHaveCount(2, { timeout: 8_000 });
    await expect(rows.first()).toContainText('F-2024-001');
    await expect(rows.nth(1)).toContainText('F-2024-002');
  });

  test('filtro por estado actualiza la tabla', async ({ page }) => {
    let lastEstadoFilter = '';
    await page.route('**/facturas**', (route) => {
      const url = new URL(route.request().url());
      lastEstadoFilter = url.searchParams.get('estado') ?? '';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: MOCK_FACTURAS.filter(
            (f) => !lastEstadoFilter || f.estado === lastEstadoFilter
          ),
          error: null,
          meta: { total: 1 },
        }),
      });
    });
    await page.route('**/masters/companias**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], error: null }),
      })
    );

    await page.goto('/facturas');
    await expect(page.locator('.filters-bar')).toBeVisible({ timeout: 10_000 });

    // Select "emitida" in the estado filter
    await page.locator('.filters-bar select').first().selectOption('emitida');

    // Table should refresh — only 1 factura in 'emitida' state
    await expect
      .poll(
        () => page.locator('.data-table tbody tr').count(),
        { timeout: 8_000 }
      )
      .toBe(1);
  });

  test('clic en fila de factura navega al detalle', async ({ page }) => {
    await page.route('**/facturas**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_FACTURAS, error: null, meta: { total: 2 } }),
      })
    );
    await page.route('**/masters/companias**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], error: null }),
      })
    );

    await page.goto('/facturas');
    await expect(page.locator('.data-table tbody tr').first()).toBeVisible({ timeout: 10_000 });

    await page.locator('.data-table tbody tr').first().click();

    await expect(page).toHaveURL(/facturas\/fac-001/, { timeout: 8_000 });
  });
});
