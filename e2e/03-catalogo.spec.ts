import { test, expect } from '@playwright/test';
import { instalarMocksApi } from './helpers';

/**
 * Escenario 3: Búsqueda y listado de lugares.
 * La app parte de 6 establecimientos semilla publicados (ids 1..6).
 */
test.describe('03 · Búsqueda y listado de lugares', () => {
  test('lista los establecimientos publicados', async ({ page }) => {
    await instalarMocksApi(page);

    await page.goto('/lugares');

    await expect(page.locator('#lugares .card')).toHaveCount(6);
    await expect(page.locator('#lugares .card').first()).toContainText('Restaurante El Mirador');
    await expect(page.locator('#lugares .card').last()).toContainText('Plaza Comercial Centro');
  });

  test('filtra por texto de búsqueda', async ({ page }) => {
    await instalarMocksApi(page);

    await page.goto('/lugares');
    await page.locator('input[name="q"]').fill('Café');

    await expect(page.locator('#lugares .card')).toHaveCount(1);
    await expect(page.locator('#lugares .card h3')).toHaveText('Café Central');
  });

  test('filtra por categoría desde el selector', async ({ page }) => {
    await instalarMocksApi(page);

    await page.goto('/lugares');
    await page.locator('select[name="cat"]').selectOption('restaurantes');

    await expect(page.locator('#lugares .card h3')).toHaveText(['Restaurante El Mirador']);
  });

  test('filtra por categoría desde las tarjetas de categoría', async ({ page }) => {
    await instalarMocksApi(page);

    await page.goto('/lugares');
    await page.locator('.cat-card', { hasText: 'Bares' }).click();

    await expect(page.locator('#lugares .card h3')).toHaveText(['Bar La Estación']);
  });

  test('muestra el estado vacío cuando no hay coincidencias', async ({ page }) => {
    await instalarMocksApi(page);

    await page.goto('/lugares');
    await page.locator('input[name="q"]').fill('zzzzzz');

    await expect(page.locator('#lugares .empty')).toBeVisible();
    await expect(page.locator('#lugares .card')).toHaveCount(0);
  });
});
