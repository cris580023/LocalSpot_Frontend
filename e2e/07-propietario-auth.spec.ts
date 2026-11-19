import { test, expect } from '@playwright/test';
import { esperarRender, instalarMocksApi, sembrarSesion, TOKEN_E2E, USUARIO_PROPIETARIO } from './helpers';

/**
 * Escenario 7: Registro e inicio de sesión de propietarios.
 * Rutas reales: /propietario/login y /propietario/registro.
 */
test.describe('07 · Registro e inicio de sesión de propietarios', () => {
  test('inicia sesión como propietario y entra a su panel', async ({ page }) => {
    await instalarMocksApi(page, {
      login: { status: 200, body: { token: TOKEN_E2E, usuario: USUARIO_PROPIETARIO } }
    });

    await page.goto('/propietario/login');
    await expect(page.locator('h1')).toHaveText('LocalSpot Propietarios');

    await page.locator('input#correo').fill('ana@negocio.com');
    await page.locator('input#password').fill('clave123');
    await page.locator('button.btn-admin').click();

    await expect(page).toHaveURL(/\/propietario\/panel$/);
  });

  test('muestra error si el backend rechaza el login de propietario', async ({ page }) => {
    await instalarMocksApi(page, {
      login: { status: 401, body: { mensaje: 'Credenciales inválidas' } }
    });

    await page.goto('/propietario/login');
    await page.locator('input#correo').fill('ana@negocio.com');
    await page.locator('input#password').fill('mala');

    // El mensaje de error llega en la respuesta 401 (fuera de la zona de Angular).
    // Se re-renderiza en bucle hasta que el mensaje aparezca (evita la carrera
    // entre la resolución de `waitForResponse` y el callback de error).
    const respuesta = page.waitForResponse((r) => r.url().includes('/api/auth/login'));
    await page.locator('button.btn-admin').click();
    await respuesta;
    await esperarRender(page, async () => (await page.locator('p.form-error').count()) > 0);

    await expect(page.locator('p.form-error')).toHaveText('Credenciales inválidas');
    await expect(page).toHaveURL(/\/propietario\/login$/);
  });

  test('registra un negocio nuevo y entra al panel del propietario', async ({ page }) => {
    await instalarMocksApi(page, {
      login: { status: 200, body: { token: TOKEN_E2E, usuario: USUARIO_PROPIETARIO } }
    });

    await page.goto('/propietario/registro');
    await expect(page.locator('h1')).toHaveText('Registra tu negocio');

    await page.locator('input#nombre').fill('Ana Propietaria');
    await page.locator('input#correo').fill('ana@negocio.com');
    await page.locator('input#contrasena').fill('clave12345');
    await page.locator('input#nombreNegocio').fill('Café Prueba E2E');
    await page.locator('select#categoria').selectOption('cafes');
    await page.locator('input#direccion').fill('Calle 99 # 1-23');

    // Secuencia real: login -> alta en backend -> navegación al panel -> carga
    // de "mis lugares". Las tres respuestas se resuelven fuera de la zona de
    // Angular, así que hay que esperarlas y re-renderizar.
    const login = page.waitForResponse((r) => r.url().includes('/api/auth/login'));
    const alta = page.waitForResponse(
      (r) => r.url().includes('/api/establecimientos') && r.request().method() === 'POST'
    );
    const misLugares = page.waitForResponse((r) =>
      r.url().includes('/api/establecimientos/mis-lugares')
    );
    await page.locator('button[type="submit"].btn-admin').click();
    await login;
    await alta;
    await misLugares;
    await esperarRender(page, async () => (await page.locator('.info-card h3').count()) > 0);

    await expect(page).toHaveURL(/\/propietario\/panel$/);
    await expect(page.locator('.info-card h3')).toHaveText('Café Prueba E2E');
    await expect(page.locator('.status-badge')).toHaveText('Borrador');
  });

  test('enlaza del login de propietario al registro', async ({ page }) => {
    await instalarMocksApi(page);
    await sembrarSesion(page, USUARIO_PROPIETARIO);

    await page.goto('/propietario/login');
    await page.getByRole('link', { name: 'Registra tu negocio' }).click();

    await expect(page).toHaveURL(/\/propietario\/registro$/);
  });
});
