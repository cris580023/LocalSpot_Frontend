import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import {
  AuthService,
  normalizarRol,
  rutaInicialPorRol,
  CREDENCIALES_ADMIN_PRUEBA,
  TOKEN_KEY,
  USUARIO_KEY,
  CUENTAS_MOCK_KEY
} from './auth';
import { environment } from '../../environments/environment';

describe('Auth', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('normalizarRol', () => {
    it('traduce las variantes de administrador', () => {
      expect(normalizarRol('ADMINISTRADOR')).toBe('ADMINISTRADOR');
      expect(normalizarRol('ADMIN')).toBe('ADMINISTRADOR');
      expect(normalizarRol('ROLE_ADMINISTRADOR')).toBe('ADMINISTRADOR');
      expect(normalizarRol(' role_administrador ')).toBe('ADMINISTRADOR');
    });

    it('traduce las variantes de propietario', () => {
      expect(normalizarRol('PROPIETARIO')).toBe('PROPIETARIO');
      expect(normalizarRol('OWNER')).toBe('PROPIETARIO');
      expect(normalizarRol('ROLE_OWNER')).toBe('PROPIETARIO');
    });

    it('devuelve FINAL para valores desconocidos o vacíos', () => {
      expect(normalizarRol('USUARIO')).toBe('FINAL');
      expect(normalizarRol('')).toBe('FINAL');
      expect(normalizarRol(null)).toBe('FINAL');
      expect(normalizarRol(undefined)).toBe('FINAL');
    });
  });

  describe('rutaInicialPorRol', () => {
    it('devuelve la ruta de cada rol', () => {
      expect(rutaInicialPorRol('ADMINISTRADOR')).toBe('/admin/panel');
      expect(rutaInicialPorRol('PROPIETARIO')).toBe('/propietario/panel');
      expect(rutaInicialPorRol('FINAL')).toBe('/lugares');
    });

    it('devuelve la ruta del catálogo cuando el rol es nulo', () => {
      expect(rutaInicialPorRol(null)).toBe('/lugares');
      expect(rutaInicialPorRol(undefined)).toBe('/lugares');
    });
  });

  describe('resolverCredenciales', () => {
    it('valida al administrador de prueba con la contraseña correcta', () => {
      const res = service.resolverCredenciales(
        CREDENCIALES_ADMIN_PRUEBA.correo,
        CREDENCIALES_ADMIN_PRUEBA.password
      );
      expect(res).toEqual({ valido: true, rol: 'ADMINISTRADOR', nombre: 'Administrador' });
    });

    it('rechaza al administrador cuando la contraseña es incorrecta', () => {
      const res = service.resolverCredenciales(CREDENCIALES_ADMIN_PRUEBA.correo, 'incorrecta');
      expect(res.valido).toBe(false);
      expect(res.rol).toBe('ADMINISTRADOR');
    });

    it('devuelve el rol guardado de una cuenta mock', () => {
      localStorage.setItem(
        CUENTAS_MOCK_KEY,
        JSON.stringify({ 'dueno@local.com': { nombre: 'Dueño', rol: 'PROPIETARIO' } })
      );
      const res = service.resolverCredenciales('Dueno@Local.com', 'cualquiera');
      expect(res).toEqual({ valido: true, rol: 'PROPIETARIO', nombre: 'Dueño' });
    });

    it('detecta propietarios con negocios registrados en el almacén', () => {
      let idPropietario = 0;
      service.login('propietario@local.com').subscribe(r => (idPropietario = r.usuario.id));
      localStorage.removeItem(CUENTAS_MOCK_KEY);
      localStorage.setItem(
        'localspot_lugares_mock',
        JSON.stringify([{ id: 10, propietarioId: idPropietario }])
      );

      const res = service.resolverCredenciales('propietario@local.com', 'x');
      expect(res).toEqual({ valido: true, rol: 'PROPIETARIO' });
    });

    it('cae a FINAL cuando el almacén de negocios tiene JSON inválido', () => {
      localStorage.setItem('localspot_lugares_mock', 'esto-no-es-json');
      const res = service.resolverCredenciales('nadie@local.com', 'x');
      expect(res).toEqual({ valido: true, rol: 'FINAL' });
    });

    it('cae a FINAL cuando el almacén de negocios no es un arreglo', () => {
      localStorage.setItem('localspot_lugares_mock', JSON.stringify({ id: 10 }));
      const res = service.resolverCredenciales('nadie2@local.com', 'x');
      expect(res).toEqual({ valido: true, rol: 'FINAL' });
    });

    it('devuelve FINAL para un usuario nuevo sin cuentas ni negocios', () => {
      const res = service.resolverCredenciales('nuevo@local.com', 'x');
      expect(res).toEqual({ valido: true, rol: 'FINAL' });
    });

    it('tolera cuentas mock corruptas y continúa con la resolución', () => {
      localStorage.setItem(CUENTAS_MOCK_KEY, '{{no-json');
      const res = service.resolverCredenciales('corrupto@local.com', 'x');
      expect(res.valido).toBe(true);
      expect(res.rol).toBe('FINAL');
    });
  });

  describe('login', () => {
    it('autentica contra el backend cuando se envía contraseña', () => {
      let emitido: any;
      service.login(' MiXeD@Example.com ', 'FINAL', 'NombreX', 'secreta').subscribe(r => (emitido = r));

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ correo: 'mixed@example.com', contrasena: 'secreta' });
      req.flush({ token: 'token-real', usuario: { id: 9, nombre: 'Admin Nuevo', rol: 'ROLE_ADMINISTRADOR' } });

      expect(emitido.token).toBe('token-real');
      expect(localStorage.getItem(TOKEN_KEY)).toBe('token-real');
      const usuario = JSON.parse(localStorage.getItem(USUARIO_KEY) as string);
      expect(usuario.rol).toBe('ADMINISTRADOR');
      expect(usuario.correo).toBe('mixed@example.com');
      const cuentas = JSON.parse(localStorage.getItem(CUENTAS_MOCK_KEY) as string);
      expect(cuentas['mixed@example.com'].rol).toBe('ADMINISTRADOR');
    });

    it('usa el nombre por defecto (parte local del correo) cuando el backend no lo entrega', () => {
      service.login('sin-nombre@example.com', 'FINAL', undefined, 'pw').subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
      req.flush({ token: 't', usuario: { id: 3, rol: 'USUARIO' } });

      const usuario = JSON.parse(localStorage.getItem(USUARIO_KEY) as string);
      expect(usuario.nombre).toBe('sin-nombre');
      expect(usuario.rol).toBe('FINAL');
      expect(usuario.id).toBe(3);
    });

    it('propaga el error cuando el backend responde 401', () => {
      let error: any;
      service.login('blocked@example.com', 'FINAL', undefined, 'pw').subscribe({ error: e => (error = e) });

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
      req.flush('No autorizado', { status: 401, statusText: 'Unauthorized' });

      expect(error.status).toBe(401);
    });

    it('propaga el error cuando el backend responde 403', () => {
      let error: any;
      service.login('forbidden@example.com', 'FINAL', undefined, 'pw').subscribe({ error: e => (error = e) });

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
      req.flush('Prohibido', { status: 403, statusText: 'Forbidden' });

      expect(error.status).toBe(403);
    });

    it('recurre al login mock cuando el backend falla con otro error', () => {
      let emitido: any;
      service.login('fallback@example.com', 'FINAL', undefined, 'pw').subscribe(r => (emitido = r));

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
      req.flush('caído', { status: 500, statusText: 'Server Error' });

      expect(emitido.token).toBe('mock-jwt-token');
      expect(localStorage.getItem(TOKEN_KEY)).toBe('mock-jwt-token');
    });

    it('usa el login mock cuando no se envía contraseña (sin llamada HTTP)', () => {
      let emitido: any;
      service.login('sin-password@example.com', 'FINAL').subscribe(r => (emitido = r));

      expect(emitido.token).toBe('mock-jwt-token');
      expect(emitido.usuario.nombre).toBe('sin-password');
      expect(localStorage.getItem(TOKEN_KEY)).toBe('mock-jwt-token');
    });
  });

  describe('loginConGoogle', () => {
    it('guarda la sesión al autenticar con Google', () => {
      let emitido: any;
      service.loginConGoogle('id-token-abc').subscribe(r => (emitido = r));

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/google`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ idToken: 'id-token-abc' });
      req.flush({ token: 'google-token', usuario: { correo: 'google@x.com', rol: 'ROLE_OWNER' } });

      expect(emitido.token).toBe('google-token');
      const usuario = JSON.parse(localStorage.getItem(USUARIO_KEY) as string);
      expect(usuario.rol).toBe('PROPIETARIO');
      const cuentas = JSON.parse(localStorage.getItem(CUENTAS_MOCK_KEY) as string);
      expect(cuentas['google@x.com']).toEqual({ nombre: 'Usuario Google', rol: 'PROPIETARIO' });
    });

    it('no registra cuenta mock cuando el usuario de Google no trae correo', () => {
      service.loginConGoogle('id-token-sin-correo').subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/google`);
      req.flush({ token: 'g2', usuario: {} });

      expect(localStorage.getItem(CUENTAS_MOCK_KEY)).toBeNull();
      const usuario = JSON.parse(localStorage.getItem(USUARIO_KEY) as string);
      expect(usuario.nombre).toBe('Usuario Google');
      expect(usuario.correo).toBe('');
    });
  });

  describe('registrar', () => {
    it('envía el registro con el payload normalizado', () => {
      let emitido: any;
      service
        .registrar({ nombre: 'Nueva', correo: ' Nueva@Correo.com ', password: 'pwd' })
        .subscribe(r => (emitido = r));

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/register`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        nombre: 'Nueva',
        correo: 'nueva@correo.com',
        contrasena: 'pwd',
        tipoUsuario: 'FINAL'
      });
      req.flush({ success: true });
      expect(emitido.success).toBe(true);
    });

    it('respeta tipoUsuario/rol cuando se especifica', () => {
      service
        .registrar({ nombre: 'Dueño', correo: 'dueno@correo.com', contrasena: 'p', tipoUsuario: 'PROPIETARIO' })
        .subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/register`);
      expect(req.request.body.tipoUsuario).toBe('PROPIETARIO');
      req.flush({ success: true });
    });

    it('simula el registro en frontend cuando el backend no está disponible', () => {
      const originalLog = console.log;
      console.log = () => undefined;
      let emitido: any;
      service
        .registrar({ nombre: 'Offline', correo: 'offline@correo.com', contrasena: 'p', rol: 'PROPIETARIO' })
        .subscribe(r => (emitido = r));

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/register`);
      req.flush('sin conexión', { status: 503, statusText: 'Service Unavailable' });
      console.log = originalLog;

      expect(emitido.success).toBe(true);
      expect(emitido.usuario.correo).toBe('offline@correo.com');
      expect(emitido.usuario.tipoUsuario).toBe('PROPIETARIO');
    });
  });

  describe('sesión', () => {
    it('logout elimina el token y el usuario', () => {
      localStorage.setItem(TOKEN_KEY, 'tok');
      localStorage.setItem(USUARIO_KEY, JSON.stringify({ rol: 'FINAL' }));

      service.logout();

      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(USUARIO_KEY)).toBeNull();
    });

    it('getToken/getUsuario devuelven null cuando no hay sesión', () => {
      expect(service.getToken()).toBeNull();
      expect(service.getUsuario()).toBeNull();
      expect(service.getRol()).toBeNull();
      expect(service.estaAutenticado()).toBe(false);
      expect(service.getRutaInicio()).toBe('/lugares');
    });

    it('expone el estado de una sesión iniciada', () => {
      localStorage.setItem(TOKEN_KEY, 'tok-admin');
      localStorage.setItem(
        USUARIO_KEY,
        JSON.stringify({ id: 1, nombre: 'Admin', correo: 'a@a.com', rol: 'ADMINISTRADOR' })
      );

      expect(service.getToken()).toBe('tok-admin');
      expect(service.estaAutenticado()).toBe(true);
      expect(service.getUsuario()).toEqual({ id: 1, nombre: 'Admin', correo: 'a@a.com', rol: 'ADMINISTRADOR' });
      expect(service.getRol()).toBe('ADMINISTRADOR');
      expect(service.getRutaInicio()).toBe('/admin/panel');
    });
  });

  describe('recuperación de contraseña', () => {
    it('solicitarRecuperacion normaliza el correo y llama al backend', () => {
      service.solicitarRecuperacion(' Recuperar@Correo.com ').subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/olvide-contrasena`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ correo: 'recuperar@correo.com' });
      req.flush({ ok: true });
    });

    it('restablecerContrasena recorta token y contraseña', () => {
      service.restablecerContrasena('  tok-123  ', '  nueva-clave  ').subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/restablecer-contrasena`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ token: 'tok-123', nuevaContrasena: 'nueva-clave' });
      req.flush({ ok: true });
    });
  });
});
