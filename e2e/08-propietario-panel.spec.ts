import { test, expect, Page } from '@playwright/test';
import {
  esperarRender,
  instalarMocksApi,
  sembrarLugares,
  sembrarSesion,
  NegocioSemilla,
  USUARIO_PROPIETARIO
} from './helpers';

/**
 * Abre el panel y espera la carga de "mis lugares".
 * El panel cae al almacén local porque el backend mock devuelve una lista vacía;
 * como la respuesta HTTP se resuelve fuera de la zona de Angular, hay que
 * esperarla y re-renderizar hasta que las tarjetas aparezcan en el DOM.
 */
async function abrirPanel(page: Page): Promise<void> {
  const misLugares = page.waitForResponse((r) =>
    r.url().includes('/api/establecimientos/mis-lugares')
  );
  await page.goto('/propietario/panel');
  await misLugares;
  await esperarRender(page, async () => (await page.locator('.info-card h3').count()) > 0);
}

/** Negocio de prueba cuyo propietario es USUARIO_PROPIETARIO (id 777). */
const NEGOCIO_PROPIO: NegocioSemilla = {
  id: 1001,
  nombre: 'Café de Ana',
  categoria: 'cafes',
  calificacion: 4.5,
  direccion: 'Calle 1 # 2-3',
  icono: '☕',
  descripcion: 'Café de especialidad',
  horario: 'Lunes a Viernes: 08:00 - 18:00',
  publicado: false,
  propietarioId: USUARIO_PROPIETARIO.id,
  fotos: [],
  rangoPrecio: 2
};

/**
 * Escenario 8: Panel de propietarios.
 * Ruta real: /propietario/panel (protegida por roleGuard('PROPIETARIO')).
 */
test.describe('08 · Panel de propietarios', () => {
  test.beforeEach(async ({ page }) => {
    // misLugares vacío => el panel cae al almacén local del propietario.
    await instalarMocksApi(page, { misLugares: [] });
    await sembrarSesion(page, USUARIO_PROPIETARIO);
    await sembrarLugares(page, [NEGOCIO_PROPIO]);
  });

  test('muestra los negocios del propietario con su estado', async ({ page }) => {
    await abrirPanel(page);

    await expect(page.locator('.user-role')).toHaveText('Panel Propietario');
    await expect(page.locator('.user-name')).toHaveText('Ana Propietaria');
    await expect(page.locator('.info-card h3')).toHaveText('Café de Ana');
    await expect(page.locator('.status-badge')).toHaveText('Borrador');
  });

  test('publica un negocio que estaba en borrador', async ({ page }) => {
    await abrirPanel(page);

    await page.locator('.info-card button.btn-publish').click();
    // El handler actualiza el estado del componente, pero la detección de cambios
    // automática no se dispara en este entorno; se re-renderiza hasta reflejarlo.
    await esperarRender(
      page,
      async () => (await page.locator('.status-badge').textContent())?.trim() === 'Publicado'
    );

    await expect(page.locator('.status-badge')).toHaveText('Publicado');

    const publicado = await page.evaluate(() => {
      const datos = JSON.parse(window.localStorage.getItem('localspot_lugares_mock') || '[]');
      const negocio = datos.find((l: { id: number }) => l.id === 1001);
      return negocio ? negocio.publicado : null;
    });
    expect(publicado).toBe(true);
  });

  test('personaliza la información de un negocio', async ({ page }) => {
    page.on('dialog', (dialogo) => dialogo.accept());

    await abrirPanel(page);
    await page.locator('.info-card button.btn-edit').click();
    // `editar()` activa `editando`; se re-renderiza para que aparezca el
    // formulario (*ngIf), ya que la CD automática no se dispara aquí.
    await esperarRender(page, async () => (await page.locator('.edit-container').count()) > 0);

    await expect(page.locator('.edit-container')).toBeVisible();
    await page.locator('.edit-form input[name="nombre"]').fill('Café de Ana Renombrado');

    // Al guardar se relanza la carga de "mis lugares" (respuesta fuera de la zona).
    const recarga = page.waitForResponse((r) =>
      r.url().includes('/api/establecimientos/mis-lugares')
    );
    await page.locator('.edit-actions-footer button.btn-save').click();
    await recarga;
    await esperarRender(
      page,
      async () =>
        (await page.locator('.info-card h3').textContent())?.trim() === 'Café de Ana Renombrado'
    );

    await expect(page.locator('.info-card h3')).toHaveText('Café de Ana Renombrado');
  });
});
