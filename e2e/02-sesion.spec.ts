import { test, expect } from '@playwright/test';
import {
  instalarMocksApi,
  sembrarSesion,
  USUARIO_FINAL,
  USUARIO_PROPIETARIO,
  TOKEN_E2E
} from './helpers';

/**
 * Escenario 2: Inicio y cierre de sesión.
 *
 * Nota: el botón "Cerrar Sesión" del panel de propietario/administrador ejecuta
 * AuthService.logout() (limpia localStorage). El enlace "Cerrar sesión" de la
 * cabecera del catálogo solo navega a /login (comportamiento real actual).
 */
test.describe('02 · Inicio y cierre de sesión', () => {
  test('inicia sesión y el catálogo reconoce la sesión activa', async ({ page }) => {
    await instalarMocksApi(page);

    await page.goto('/login');
    await page.locator('input#correo').fill('cliente@correo.com');
    await page.locator('input#password').fill('clave123');
    await page.locator('button[type="submit"].btn-submit').click();

    await expect(page).toHaveURL(/\/lugares$/);
    // Enlaces que solo se muestran cuando hay sesión iniciada.
    await expect(page.getByRole('link', { name: /Mis Favoritos/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Preferencias/ })).toBeVisible();
  });

  test('persiste el token de sesión en localStorage tras el login', async ({ page }) => {
    await instalarMocksApi(page);

    await page.goto('/login');
    await page.locator('input#correo').fill('cliente@correo.com');
    await page.locator('input#password').fill('clave123');
    await page.locator('button[type="submit"].btn-submit').click();
    await expect(page).toHaveURL(/\/lugares$/);

    const token = await page.evaluate(() => window.localStorage.getItem('localspot_token'));
    const usuario = await page.evaluate(() => window.localStorage.getItem('localspot_usuario'));

    expect(token).toBe(TOKEN_E2E);
    expect(usuario).toContain('cliente@correo.com');
  });

  test('cierra sesión desde el panel de propietario y limpia el almacenamiento', async ({ page }) => {
    await instalarMocksApi(page);
    await sembrarSesion(page, USUARIO_PROPIETARIO);

    await page.goto('/propietario/panel');
    await expect(page.locator('.user-name')).toHaveText('Ana Propietaria');

    await page.locator('button.btn-logout').click();

    await expect(page).toHaveURL(/\/login$/);
    const token = await page.evaluate(() => window.localStorage.getItem('localspot_token'));
    const usuario = await page.evaluate(() => window.localStorage.getItem('localspot_usuario'));
    expect(token).toBeNull();
    expect(usuario).toBeNull();
  });

  test('el enlace "Cerrar sesión" del catálogo redirige al login', async ({ page }) => {
    await instalarMocksApi(page);
    await sembrarSesion(page, USUARIO_FINAL);

    await page.goto('/lugares');
    await page.locator('a.btn-ghost').click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('h1')).toHaveText('LocalSpot');
  });
});
