/**
 * Flujo 5: Operario — agenda y detalle de cita
 *
 * Prueba la PWA del operario: login (con mock de Supabase), carga de agenda
 * y navegación al detalle de un expediente.
 *
 * Se utilizan mocks de red para no depender de credenciales reales ni
 * de la disponibilidad de Supabase.
 */
import { test, expect } from '@playwright/test';

const MOCK_SESSION = {
  access_token: 'e2e-fake-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'e2e-fake-refresh-token',
  user: {
    id: 'op-user-e2e-001',
    email: 'operario@test.com',
    role: 'authenticated',
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  },
};

const MOCK_AGENDA = [
  {
    cita_id: 'cita-001',
    expediente_id: 'exp-agenda-001',
    numero_expediente: 'EXP-2024-001',
    tipo_siniestro: 'Hogar',
    direccion_siniestro: 'Calle Test 1, Madrid',
    localidad: 'Madrid',
    fecha_hora_inicio: new Date(Date.now() + 3_600_000).toISOString(),
    estado_expediente: 'EN_CURSO',
    tiene_parte: false,
  },
  {
    cita_id: 'cita-002',
    expediente_id: 'exp-agenda-002',
    numero_expediente: 'EXP-2024-002',
    tipo_siniestro: 'Comercio',
    direccion_siniestro: 'Avda. Principal 5, Barcelona',
    localidad: 'Barcelona',
    fecha_hora_inicio: new Date(Date.now() + 7_200_000).toISOString(),
    estado_expediente: 'EN_PLANIFICACION',
    tiene_parte: false,
  },
];

const MOCK_CLAIM = {
  id: 'exp-agenda-001',
  numero_expediente: 'EXP-2024-001',
  tipo_siniestro: 'Hogar',
  estado: 'EN_CURSO',
  descripcion: 'Avería en cocina — test e2e',
  direccion_siniestro: 'Calle Test 1',
  localidad: 'Madrid',
  asegurado_nombre: 'María López',
  asegurado_telefono: '698123456',
  citas: [{ id: 'cita-001', fecha_hora_inicio: MOCK_AGENDA[0].fecha_hora_inicio }],
};

test.describe('Agenda del operario', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Supabase authentication
    await page.route('**/auth/v1/token**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SESSION),
      })
    );
    // Silence Supabase session verification requests
    await page.route('**/auth/v1/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: MOCK_SESSION.user }),
      })
    );

    // Mock operator API
    await page.route('**/operator/me/agenda**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_AGENDA, error: null }),
      })
    );
    await page.route('**/operator/claims/exp-agenda-001**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_CLAIM, error: null }),
      })
    );
  });

  test('login muestra la pantalla de agenda con las citas del día', async ({ page }) => {
    await page.goto('/');

    // Fill login form
    await page.locator('input[type="email"]').fill('operario@test.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button[type="submit"]').click();

    // Should land on agenda
    await expect(page).toHaveURL(/agenda/, { timeout: 15_000 });

    // Two cita cards should render
    const items = page.locator('.op-agenda-item, .op-cita-card, li[data-cita], [data-testid="cita"]');
    // Fallback: just verify the agenda page rendered content
    await expect(page.locator('body')).toContainText('EXP-2024-001', { timeout: 10_000 });
    await expect(page.locator('body')).toContainText('EXP-2024-002');
  });

  test('clic en una cita navega al detalle del expediente', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="email"]').fill('operario@test.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/agenda/, { timeout: 15_000 });

    // Click on the first agenda item (contains EXP-2024-001)
    await page.locator('body').getByText('EXP-2024-001').first().click();

    await expect(page).toHaveURL(/claim\/exp-agenda-001/, { timeout: 10_000 });
    await expect(page.locator('body')).toContainText('EXP-2024-001');
  });
});
