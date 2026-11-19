import { test, expect } from '@playwright/test';
import {
  instalarMocksApi,
  sembrarSesion,
  simularGoogleMaps,
  USUARIO_ADMIN,
  USUARIO_FINAL,
  USUARIO_PROPIETARIO
} from './helpers';

/**
 * Escenario 10: Protección de rutas y permisos por rol.
 * - /admin/panel exige ADMINISTRADOR.
 * - /propietario/panel exige PROPIETARIO.
 * - /lugares y /lugar/:id son públicas (sin guard).
 */
test.describe('10 · Protección de rutas y permisos por rol', () => {
  test('sin sesión, /admin/panel redirige al login', async ({ page }) => {
    await instalarMocksApi(page);

    await page.goto('/admin/panel');

    await expect(page).toHaveURL(/\/login$/);
  });

  test('sin sesión, /propietario/panel redirige al login', async ({ page }) => {
    await instalarMocksApi(page);

    await page.goto('/propietario/panel');

    await expect(page).toHaveURL(/\/login$/);
  });

  test('un usuario FINAL no puede entrar al panel de administración', async ({ page }) => {
    await instalarMocksApi(page);
    await sembrarSesion(page, USUARIO_FINAL);

    await page.goto('/admin/panel');

    await expect(page).toHaveURL(/\/lugares$/);
  });

  test('un usuario FINAL no puede entrar al panel de propietario', async ({ page }) => {
    await instalarMocksApi(page);
    await sembrarSesion(page, USUARIO_FINAL);

    await page.goto('/propietario/panel');

    await expect(page).toHaveURL(/\/lugares$/);
  });

  test('un administrador entra al panel de administración', async ({ page }) => {
    await instalarMocksApi(page);
    await sembrarSesion(page, USUARIO_ADMIN);

    await page.goto('/admin/panel');

    await expect(page).toHaveURL(/\/admin\/panel$/);
    await expect(page.locator('.user-role')).toHaveText('Panel Administrador');
  });

  test('un administrador es enviado a su panel si intenta entrar al de propietario', async ({ page }) => {
    await instalarMocksApi(page);
    await sembrarSesion(page, USUARIO_ADMIN);

    await page.goto('/propietario/panel');

    await expect(page).toHaveURL(/\/admin\/panel$/);
  });

  test('un propietario entra a su panel', async ({ page }) => {
    await instalarMocksApi(page);
    await sembrarSesion(page, USUARIO_PROPIETARIO);

    await page.goto('/propietario/panel');

    await expect(page).toHaveURL(/\/propietario\/panel$/);
    await expect(page.locator('.user-role')).toHaveText('Panel Propietario');
  });

  test('un propietario es enviado a su panel si intenta entrar al de administración', async ({ page }) => {
    await instalarMocksApi(page);
    await sembrarSesion(page, USUARIO_PROPIETARIO);

    await page.goto('/admin/panel');

    await expect(page).toHaveURL(/\/propietario\/panel$/);
  });

  test('el catálogo y el detalle son accesibles sin sesión', async ({ page }) => {
    await instalarMocksApi(page);
    await simularGoogleMaps(page);

    await page.goto('/lugares');
    await expect(page.locator('#lugares .card')).toHaveCount(6);

    await page.goto('/lugar/1');
    await expect(page.locator('h1.lugar-title')).toHaveText('Restaurante El Mirador');
  });
});
