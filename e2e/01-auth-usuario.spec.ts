import { test, expect } from '@playwright/test';
import { esperarRender, instalarMocksApi } from './helpers';

/**
 * Escenario 1: Login y registro de usuarios.
 * Rutas reales: /login y /registro.
 */
test.describe('01 · Login y registro de usuarios', () => {
  test('muestra el formulario de login con sus campos', async ({ page }) => {
    await instalarMocksApi(page);

    await page.goto('/login');

    await expect(page.locator('h1')).toHaveText('LocalSpot');
    await expect(page.locator('input#correo')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
    await expect(page.locator('button[type="submit"].btn-submit')).toHaveText('Iniciar Sesión');
  });

  test('navega del login al registro', async ({ page }) => {
    await instalarMocksApi(page);

    await page.goto('/login');
    await page.getByRole('link', { name: 'Regístrate aquí' }).click();

    await expect(page).toHaveURL(/\/registro$/);
    await expect(page.locator('button[type="submit"].btn-submit')).toHaveText('Registrarse');
  });

  test('registra un usuario nuevo y redirige al login', async ({ page }) => {
    await instalarMocksApi(page);

    await page.goto('/registro');
    await page.locator('input#nombre').fill('Nuevo Cliente');
    await page.locator('input#correo').fill('nuevo@correo.com');
    await page.locator('input#password').fill('clave123');
    await page.locator('button[type="submit"].btn-submit').click();

    await expect(page).toHaveURL(/\/login$/);
  });

  test('inicia sesión correctamente como usuario final', async ({ page }) => {
    await instalarMocksApi(page);

    await page.goto('/login');
    await page.locator('input#correo').fill('cliente@correo.com');
    await page.locator('input#password').fill('clave123');
    await page.locator('button[type="submit"].btn-submit').click();

    await expect(page).toHaveURL(/\/lugares$/);
  });

  test('muestra el error del backend cuando las credenciales son rechazadas (401)', async ({ page }) => {
    await instalarMocksApi(page, {
      login: { status: 401, body: { mensaje: 'Credenciales inválidas' } }
    });

    await page.goto('/login');
    await page.locator('input#correo').fill('cliente@correo.com');
    await page.locator('input#password').fill('mala');

    // El mensaje de error llega en la respuesta 401 (fuera de la zona de Angular).
    // `waitForResponse` puede resolver antes de que el callback fije `error`, así
    // que se re-renderiza en bucle hasta que el mensaje aparezca en el DOM.
    const respuesta = page.waitForResponse((r) => r.url().includes('/api/auth/login'));
    await page.locator('button[type="submit"].btn-submit').click();
    await respuesta;
    await esperarRender(page, async () => (await page.locator('p.form-error').count()) > 0);

    await expect(page.locator('p.form-error')).toHaveText('Credenciales inválidas');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('valida en el frontend las credenciales de administrador con contraseña incorrecta', async ({ page }) => {
    await instalarMocksApi(page);

    await page.goto('/login');
    await page.locator('input#correo').fill('admin1@gmail.com');
    await page.locator('input#password').fill('incorrecta');
    await page.locator('button[type="submit"].btn-submit').click();

    await expect(page.locator('p.form-error')).toHaveText('Correo o contraseña incorrectos.');
  });

  test('navega al acceso de propietario desde el login de clientes', async ({ page }) => {
    await instalarMocksApi(page);

    await page.goto('/login');
    await page.getByRole('link', { name: 'Acceso propietario' }).click();

    await expect(page).toHaveURL(/\/propietario\/login$/);
  });
});
