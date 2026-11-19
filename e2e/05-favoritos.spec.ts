import { test, expect } from '@playwright/test';
import {
  aceptarDialogos,
  esperarRender,
  instalarMocksApi,
  sembrarSesion,
  simularGoogleMaps,
  USUARIO_FINAL
} from './helpers';

/** Espera a que se complete una llamada a /api/favoritos/{id} con el método dado. */
function esperarToggleFavorito(page: import('@playwright/test').Page, metodo: 'POST' | 'DELETE') {
  return page.waitForResponse(
    (r) => /^\/api\/favoritos\/[^/]+$/.test(new URL(r.url()).pathname) && r.request().method() === metodo
  );
}

/**
 * Escenario 5: Agregar y eliminar favoritos.
 * Usa una sesión FINAL sembrada y un backend de favoritos mockeado.
 */
test.describe('05 · Agregar y eliminar favoritos', () => {
  test('agrega y elimina un favorito desde el catálogo', async ({ page }) => {
    await instalarMocksApi(page, { favoritos: [] });
    await sembrarSesion(page, USUARIO_FINAL);

    await page.goto('/lugares');
    const boton = page.locator('#lugares .card').first().locator('.btn-favorito-card');

    await expect(boton).toHaveText('🤍');

    const alta = esperarToggleFavorito(page, 'POST');
    await boton.click();
    await alta;
    await esperarRender(page, async () => (await boton.textContent())?.trim() === '❤️');
    await expect(boton).toHaveText('❤️');

    const baja = esperarToggleFavorito(page, 'DELETE');
    await boton.click();
    await baja;
    await esperarRender(page, async () => (await boton.textContent())?.trim() === '🤍');
    await expect(boton).toHaveText('🤍');
  });

  test('marca como favorito un lugar ya guardado en el backend', async ({ page }) => {
    await instalarMocksApi(page, { favoritos: [{ idUsuario: 501, idLugar: 1 }] });
    await sembrarSesion(page, USUARIO_FINAL);

    // Los favoritos del backend llegan en la respuesta GET (fuera de la zona de Angular).
    const cargaFavoritos = page.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/favoritos'
    );
    await page.goto('/lugares');
    await cargaFavoritos;
    const corazon = page.locator('#lugares .card').first().locator('.btn-favorito-card');
    await esperarRender(page, async () => (await corazon.textContent())?.trim() === '❤️');

    await expect(corazon).toHaveText('❤️');
  });

  test('la vista "Mis Favoritos" solo muestra los lugares guardados', async ({ page }) => {
    await instalarMocksApi(page, { favoritos: [{ idUsuario: 501, idLugar: 1 }] });
    await sembrarSesion(page, USUARIO_FINAL);

    await page.goto('/lugares');
    await page.getByRole('link', { name: /Mis Favoritos/ }).click();

    await expect(page.locator('#lugares .card')).toHaveCount(1);
    await expect(page.locator('#lugares .card h3')).toHaveText('Restaurante El Mirador');
  });

  test('permite guardar un lugar desde el detalle', async ({ page }) => {
    await instalarMocksApi(page, { favoritos: [] });
    await simularGoogleMaps(page);
    await sembrarSesion(page, USUARIO_FINAL);

    await page.goto('/lugar/1');
    const boton = page.locator('.favorite-btn');

    await expect(boton).toHaveText(/Guardar/);
    await boton.click();
    await expect(boton).toHaveText(/En Favoritos/);
  });

  test('no permite guardar favoritos sin sesión (muestra alerta)', async ({ page }) => {
    await instalarMocksApi(page, { favoritos: [] });

    await page.goto('/lugares');
    const boton = page.locator('#lugares .card').first().locator('.btn-favorito-card');

    const dialogo = aceptarDialogos(page);
    await boton.click();

    await expect.poll(() => dialogo.mensaje).toContain('Inicia sesión');
  });
});
