import { test, expect } from '@playwright/test';
import { esperarRender, instalarMocksApi, simularGoogleMaps } from './helpers';

/**
 * Escenario 6: Funcionamiento del mapa.
 * El SDK de Google Maps se reemplaza por un stub controlado (sin API Key real).
 */
test.describe('06 · Funcionamiento del mapa', () => {
  test.beforeEach(async ({ page }) => {
    await instalarMocksApi(page);
    await simularGoogleMaps(page);
  });

  test('inicializa el mapa sin errores ni estado de carga', async ({ page }) => {
    // El script del SDK se carga dinámicamente y su `onload` no dispara la
    // detección de cambios; se espera la respuesta y se re-renderiza.
    const sdk = page.waitForResponse((r) => r.url().includes('/maps/api/js'));
    await page.goto('/lugar/1');
    await sdk;

    await esperarRender(page, async () => (await page.locator('app-mapa .map-loading').count()) === 0);

    await expect(page.locator('app-mapa .map-container')).toBeVisible();
    await expect(page.locator('app-mapa .map-loading')).toHaveCount(0);
    await expect(page.locator('app-mapa .map-error')).toHaveCount(0);
  });

  test('muestra las coordenadas y el enlace "Cómo llegar"', async ({ page }) => {
    await page.goto('/lugar/1');

    await expect(page.locator('app-mapa .coords-text')).toContainText('Coordenadas: 4.3372, -74.3640');
    await expect(page.locator('app-mapa .btn-como-llegar')).toHaveAttribute(
      'href',
      /google\.com\/maps\/dir/
    );
  });

  test('renderiza el contenedor del mapa con altura real', async ({ page }) => {
    await page.goto('/lugar/1');

    const caja = await page.locator('app-mapa .map-container').boundingBox();
    expect(caja).not.toBeNull();
    expect(caja!.height).toBeGreaterThan(100);
  });
});
