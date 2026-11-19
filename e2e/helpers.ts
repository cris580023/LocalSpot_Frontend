import { Page } from '@playwright/test';

/**
 * Utilidades compartidas por las pruebas E2E de LocalSpot.
 *
 * IMPORTANTE: estos helpers solo preparan el navegador (localStorage y mocks de red).
 * No modifican la lógica de producción; únicamente interceptan las llamadas /api/**
 * para que las pruebas sean deterministas sin depender del backend real
 * (http://localhost:18080).
 */

/** Claves reales de localStorage usadas por la aplicación. */
export const STORAGE_KEYS = {
  token: 'localspot_token',
  usuario: 'localspot_usuario',
  cuentas: 'localspot_cuentas_mock',
  lugares: 'localspot_lugares_mock'
} as const;

export type Rol = 'FINAL' | 'ADMINISTRADOR' | 'PROPIETARIO';

export interface UsuarioSesion {
  id: number;
  nombre: string;
  correo: string;
  rol: Rol;
}

/** Datos de prueba controlados (no son credenciales reales del backend). */
export const TOKEN_E2E = 'e2e-token';

export const USUARIO_FINAL: UsuarioSesion = {
  id: 501,
  nombre: 'Cliente Demo',
  correo: 'cliente@correo.com',
  rol: 'FINAL'
};

export const USUARIO_PROPIETARIO: UsuarioSesion = {
  id: 777,
  nombre: 'Ana Propietaria',
  correo: 'ana@negocio.com',
  rol: 'PROPIETARIO'
};

export const USUARIO_ADMIN: UsuarioSesion = {
  id: 888,
  nombre: 'Administrador',
  correo: 'admin1@gmail.com',
  rol: 'ADMINISTRADOR'
};

/**
 * Registra un init script que rellena localStorage antes de que la app arranque.
 * Se ejecuta en cada carga completa de documento.
 */
export async function sembrarAlmacenamiento(
  page: Page,
  valores: Record<string, string>
): Promise<void> {
  await page.addInitScript((entradas) => {
    for (const clave of Object.keys(entradas)) {
      window.localStorage.setItem(clave, entradas[clave]);
    }
  }, valores);
}

/** Siembra una sesión activa (token + usuario) en localStorage. */
export async function sembrarSesion(
  page: Page,
  usuario: UsuarioSesion,
  token: string = TOKEN_E2E
): Promise<void> {
  await sembrarAlmacenamiento(page, {
    [STORAGE_KEYS.token]: token,
    [STORAGE_KEYS.usuario]: JSON.stringify(usuario)
  });
}

export interface NegocioSemilla {
  id: number;
  nombre: string;
  categoria: string;
  calificacion: number;
  direccion: string;
  icono: string;
  descripcion: string;
  horario: string;
  publicado: boolean;
  propietarioId: number;
  fotos: string[];
  rangoPrecio: number;
}

/** Siembra el catálogo local de negocios (clave usada por LugaresService). */
export async function sembrarLugares(page: Page, lugares: NegocioSemilla[]): Promise<void> {
  await sembrarAlmacenamiento(page, {
    [STORAGE_KEYS.lugares]: JSON.stringify(lugares)
  });
}

export interface RespuestaLogin {
  status?: number;
  body?: unknown;
}

export interface ConfigMocks {
  /** Respuesta para POST /api/auth/login. */
  login?: RespuestaLogin;
  /** Cuerpo para GET /api/lugares. */
  lugares?: unknown;
  /** Lista para GET /api/favoritos. */
  favoritos?: unknown[];
  /** Resultado para POST /api/lugares/buscar-ia. */
  ia?: unknown[];
  /** Lista para GET /api/establecimientos/mis-lugares. */
  misLugares?: unknown[];
}

/**
 * Intercepta todas las llamadas a /api/** y devuelve respuestas controladas.
 * Evita depender del backend real y mantiene las pruebas reproducibles.
 */
export async function instalarMocksApi(page: Page, config: ConfigMocks = {}): Promise<void> {
  const login = config.login ?? {
    status: 200,
    body: { token: TOKEN_E2E, usuario: USUARIO_FINAL }
  };
  const lugares = config.lugares ?? { content: [] };
  const favoritos = config.favoritos ?? [];
  const ia = config.ia ?? [];
  const misLugares = config.misLugares ?? [];

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const ruta = new URL(request.url()).pathname;
    const metodo = request.method();

    const responder = (status: number, body: unknown) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body)
      });

    if (ruta === '/api/auth/login' && metodo === 'POST') {
      return responder(login.status ?? 200, login.body ?? {});
    }
    if (ruta === '/api/auth/register' && metodo === 'POST') {
      return responder(200, { success: true });
    }
    if (ruta === '/api/auth/google' && metodo === 'POST') {
      return responder(200, { token: TOKEN_E2E, usuario: USUARIO_FINAL });
    }
    if (ruta === '/api/lugares' && metodo === 'GET') {
      return responder(200, lugares);
    }
    if (ruta === '/api/lugares/buscar-ia' && metodo === 'POST') {
      return responder(200, ia);
    }
    if (/^\/api\/lugares\/[^/]+\/calificaciones$/.test(ruta)) {
      return responder(200, { ok: true });
    }
    if (ruta === '/api/favoritos' && metodo === 'GET') {
      return responder(200, favoritos);
    }
    if (/^\/api\/favoritos\/[^/]+$/.test(ruta) && (metodo === 'POST' || metodo === 'DELETE')) {
      return responder(200, { ok: true });
    }
    if (ruta === '/api/establecimientos/mis-lugares' && metodo === 'GET') {
      return responder(200, misLugares);
    }
    if (ruta === '/api/establecimientos' && metodo === 'POST') {
      return responder(200, { idLugar: 9999, nombre: 'Nuevo establecimiento' });
    }

    // Cualquier otra llamada /api/**: respuesta vacía controlada.
    return responder(200, {});
  });
}

/**
 * Fuerza una detección de cambios completa de Angular.
 *
 * Contexto (entorno dev-server + Playwright): las mutaciones de estado que se
 * producen al resolver una petición HTTP quedan FUERA de la zona de Angular
 * (`provideHttpClient()` usa `FetchBackend`, que ejecuta la petición con
 * `runOutsideAngular`), por lo que `NgZone.onMicrotaskEmpty` no emite y
 * `ApplicationRef.tick()` no se dispara. Lo mismo ocurre con el handler de la
 * propiedad `script.onload` del script de Google Maps. El resultado es un DOM
 * que no refleja el estado real ya cargado en el componente.
 *
 * Este helper usa la utilidad de depuración de Angular `ng.applyChanges`. En
 * este entorno se comprobó (con una sonda sobre el DOM) que aplicar
 * `applyChanges` SOLO al componente raíz (`app-root`) no propagaba el cambio,
 * mientras que aplicarlo al componente enrutado (p.ej. `app-lugares`) sí lo
 * hacía, y los componentes anidados (p.ej. `app-mapa`) requieren su propio
 * refresco. Por eso se recorre cada componente realmente presente en el DOM y
 * se refresca individualmente. Solo se usa en E2E: no modifica producción.
 */
export async function forzarRender(page: Page): Promise<void> {
  await page.evaluate(() => {
    const ng = (window as unknown as { ng?: any }).ng;
    if (!ng || typeof ng.applyChanges !== 'function') return;

    const refrescar = (elemento: Element) => {
      try {
        const componente = ng.getComponent(elemento);
        if (componente) ng.applyChanges(componente);
      } catch {
        // Nodo sin componente Angular asociado: se ignora.
      }
    };

    const raiz = document.querySelector('app-root');
    if (raiz) refrescar(raiz);

    // Componentes enrutados y anidados (app-lugares, app-detalle-lugar,
    // app-mapa, app-propietario-panel, ...). Son los que realmente necesitan
    // refresco explícito en este entorno.
    document.querySelectorAll('app-root *').forEach((elemento) => {
      if (elemento.tagName.startsWith('APP-')) refrescar(elemento);
    });
  });
}

/**
 * Repite `forzarRender` hasta que la condición se cumple o se agota el tiempo.
 * Se usa cuando el disparador no es una única petición HTTP identificable
 * (por ejemplo, la carga asíncrona del script de Google Maps).
 */
export async function esperarRender(
  page: Page,
  condicion: () => Promise<boolean>,
  intentos = 40,
  esperaMs = 150
): Promise<void> {
  for (let i = 0; i < intentos; i++) {
    await forzarRender(page);
    if (await condicion()) return;
    await page.waitForTimeout(esperaMs);
  }
}

/**
 * Registra un manejador de diálogos nativos (alert/confirm) que los acepta.
 *
 * Sin un manejador, Playwright deja el diálogo abierto y bloquea la acción que
 * lo disparó (el `click` nunca resuelve). Devuelve un objeto cuyo campo
 * `mensaje` se rellena con el texto del último diálogo mostrado.
 */
export function aceptarDialogos(page: Page): { mensaje: string } {
  const registro = { mensaje: '' };
  page.on('dialog', async (dialogo) => {
    registro.mensaje = dialogo.message();
    await dialogo.accept();
  });
  return registro;
}

/**
 * Stub controlado del SDK de Google Maps.
 * La app inserta dinámicamente <script src=".../maps/api/js?...">; aquí se
 * responde con constructores mínimos para que el mapa se inicialice sin salir
 * a Internet ni usar la API Key real.
 */
const GOOGLE_MAPS_STUB = `
window.google = {
  maps: {
    Map: function (elemento, opciones) {
      this.setCenter = function () {};
      this.addListener = function () {};
    },
    Marker: function (opciones) {
      this.setPosition = function () {};
      this.addListener = function () {};
    },
    InfoWindow: function (opciones) {
      this.open = function () {};
    },
    Animation: { DROP: 1 }
  }
};
`;

/** Intercepta la carga del script de Google Maps. */
export async function simularGoogleMaps(page: Page): Promise<void> {
  await page.route('**/maps/api/js**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: GOOGLE_MAPS_STUB
    });
  });
}
