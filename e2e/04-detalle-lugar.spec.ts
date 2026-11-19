import { test, expect } from '@playwright/test';
import { aceptarDialogos, instalarMocksApi, simularGoogleMaps } from './helpers';

/**
 * Escenario 4: Visualización del detalle de lugares.
 * Ruta real: /lugar/:id (usa los datos semilla).
 */
test.describe('04 · Visualización del detalle de lugares', () => {
  test.beforeEach(async ({ page }) => {
    await instalarMocksApi(page);
    // El detalle incluye <app-mapa>; se usa el stub para no salir a Internet.
    await simularGoogleMaps(page);
  });

  test('muestra la información principal del lugar', async ({ page }) => {
    await page.goto('/lugar/1');

    await expect(page.locator('h1.lugar-title')).toHaveText('Restaurante El Mirador');
    await expect(page.locator('.category-chip')).toHaveText('Restaurante');
    await expect(page.locator('.rating-badge')).toContainText('4.8');
    await expect(page.locator('.price-badge')).toContainText('$$$');
    await expect(page.locator('.info-row').first()).toContainText('Calle 10 # 5-20');
  });

  test('permite volver al catálogo', async ({ page }) => {
    await page.goto('/lugar/1');

    await page.locator('a.btn-back').click();

    await expect(page).toHaveURL(/\/lugares$/);
  });

  test('navega la galería de fotos con el carrusel', async ({ page }) => {
    await page.goto('/lugar/1');

    await expect(page.locator('.carousel-counter')).toHaveText('1 / 2');
    await page.locator('.carousel-btn.next').click();
    await expect(page.locator('.carousel-counter')).toHaveText('2 / 2');
    await page.locator('.carousel-btn.prev').click();
    await expect(page.locator('.carousel-counter')).toHaveText('1 / 2');
  });

  test('muestra la información útil: contacto, horarios y pagos', async ({ page }) => {
    await page.goto('/lugar/1');

    await expect(page.locator('.contact-btn').first()).toBeVisible();
    await expect(page.locator('.schedule-list li').first()).toBeVisible();
    await expect(page.locator('.chip-list .chip').first()).toBeVisible();
    await expect(page.locator('.service-list li').first()).toBeVisible();
  });

  test('muestra el estado vacío de reseñas cuando no existen', async ({ page }) => {
    await page.goto('/lugar/2');

    await expect(page.locator('.reviews-card .empty-reviews')).toBeVisible();
  });

  test('solicita iniciar sesión al intentar reseñar sin sesión', async ({ page }) => {
    await page.goto('/lugar/1');

    // Se registra el manejador ANTES del click: sin él el diálogo nativo queda
    // abierto y bloquea la acción que lo disparó.
    const dialogo = aceptarDialogos(page);
    await page.locator('.btn-primary-action').click();

    await expect.poll(() => dialogo.mensaje).toContain('iniciar sesión');
  });
});
