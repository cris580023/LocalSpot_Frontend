import { test, expect } from '@playwright/test';
import { instalarMocksApi, sembrarSesion, TOKEN_E2E, USUARIO_ADMIN } from './helpers';

/**
 * Escenario 9: Login y panel administrativo.
 * Rutas reales: /admin/login y /admin/panel (protegida por roleGuard('ADMINISTRADOR')).
 */
test.describe('09 · Login y panel administrativo', () => {
  test('inicia sesión con las credenciales de administrador', async ({ page }) => {
    await instalarMocksApi(page, {
      login: { status: 200, body: { token: TOKEN_E2E, usuario: USUARIO_ADMIN } }
    });

    await page.goto('/admin/login');
    await expect(page.locator('h1')).toHaveText('LocalSpot Admin');

    await page.locator('input#correo').fill('admin1@gmail.com');
    await page.locator('input#password').fill('12345');
    await page.locator('button[type="submit"].btn-admin').click();

    await expect(page).toHaveURL(/\/admin\/panel$/);
    await expect(page.locator('.user-role')).toHaveText('Panel Administrador');
    await expect(page.locator('.content-header h1')).toHaveText('Hola, Administrador');
  });

  test('rechaza credenciales que no son de administrador', async ({ page }) => {
    await instalarMocksApi(page);

    await page.goto('/admin/login');
    await page.locator('input#correo').fill('cliente@correo.com');
    await page.locator('input#password').fill('clave123');
    await page.locator('button[type="submit"].btn-admin').click();

    await expect(page.locator('p.form-error')).toHaveText(
      'Correo o contraseña incorrectos. Verifica tus datos de administrador.'
    );
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test('muestra las estadísticas de los establecimientos', async ({ page }) => {
    await instalarMocksApi(page);
    await sembrarSesion(page, USUARIO_ADMIN);

    await page.goto('/admin/panel');

    await expect(page.locator('.stat-card')).toHaveCount(3);
    await expect(
      page.locator('.stat-card', { hasText: 'Establecimientos' }).locator('.stat-value')
    ).toHaveText('6');
    await expect(
      page.locator('.stat-card', { hasText: 'Publicados' }).locator('.stat-value')
    ).toHaveText('6');
  });

  test('filtra establecimientos por texto', async ({ page }) => {
    await instalarMocksApi(page);
    await sembrarSesion(page, USUARIO_ADMIN);

    await page.goto('/admin/panel');
    await page.locator('input[name="busqueda"]').fill('Café');

    await expect(page.locator('.business-grid .info-card')).toHaveCount(1);
  });

  test('cierra sesión desde el panel y limpia el almacenamiento', async ({ page }) => {
    await instalarMocksApi(page);
    await sembrarSesion(page, USUARIO_ADMIN);

    await page.goto('/admin/panel');
    await page.locator('button.btn-logout').click();

    await expect(page).toHaveURL(/\/login$/);
    const token = await page.evaluate(() => window.localStorage.getItem('localspot_token'));
    expect(token).toBeNull();
  });
});
