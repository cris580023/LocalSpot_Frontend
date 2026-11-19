import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { LoginComponent } from './login';
import { AuthService } from '../../services/auth';

describe('Login', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authStub: any;

  beforeEach(async () => {
    authStub = {
      resolverCredenciales: () => ({ valido: true, rol: 'FINAL' }),
      login: () => of({}),
      loginConGoogle: () => of({}),
      getRol: () => 'FINAL'
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: authStub }]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('onLogin', () => {
    it('muestra error y no navega cuando las credenciales son inválidas', () => {
      let loginLlamado = false;
      authStub.resolverCredenciales = () => ({ valido: false, rol: 'FINAL' });
      authStub.login = () => {
        loginLlamado = true;
        return of({});
      };
      component.credenciales = { correo: 'x@x.com', password: 'mala' };

      component.onLogin();

      expect(component.error).toBe('Correo o contraseña incorrectos.');
      expect(component.cargando).toBe(false);
      expect(loginLlamado).toBe(false);
    });

    it('navega a la ruta del rol cuando el acceso es válido', () => {
      const router = TestBed.inject(Router);
      const nav: string[] = [];
      router.navigateByUrl = ((url: any) => {
        nav.push(url);
        return Promise.resolve(true);
      }) as any;

      authStub.resolverCredenciales = () => ({ valido: true, rol: 'ADMINISTRADOR', nombre: 'Admin' });
      authStub.getRol = () => 'ADMINISTRADOR';
      component.credenciales = { correo: 'admin@x.com', password: 'ok' };

      component.onLogin();

      expect(component.error).toBe('');
      expect(component.cargando).toBe(false);
      expect(nav).toContain('/admin/panel');
    });

    it('muestra el mensaje del backend cuando el login falla', () => {
      authStub.login = () => throwError(() => ({ error: { mensaje: 'Credenciales malas' } }));
      component.credenciales = { correo: 'x@x.com', password: 'ok' };

      component.onLogin();

      expect(component.error).toBe('Credenciales malas');
      expect(component.cargando).toBe(false);
    });

    it('usa un mensaje por defecto cuando el error no trae mensaje', () => {
      authStub.login = () => throwError(() => ({ status: 500 }));
      component.credenciales = { correo: 'x@x.com', password: 'ok' };

      component.onLogin();

      expect(component.error).toBe('Correo o contraseña incorrectos.');
    });
  });

  describe('onGoogleResponse', () => {
    it('ignora respuestas vacías o sin credencial', () => {
      component.cargando = false;
      (component as any).onGoogleResponse(null);
      (component as any).onGoogleResponse({});
      expect(component.cargando).toBe(false);
    });

    it('navega cuando Google responde con credencial', () => {
      const router = TestBed.inject(Router);
      const nav: string[] = [];
      router.navigateByUrl = ((url: any) => {
        nav.push(url);
        return Promise.resolve(true);
      }) as any;

      authStub.loginConGoogle = () => of({ token: 't' });
      authStub.getRol = () => 'PROPIETARIO';

      (component as any).onGoogleResponse({ credential: 'id-token' });

      expect(component.cargando).toBe(false);
      expect(nav).toContain('/propietario/panel');
    });

    it('muestra un error cuando el login con Google falla', () => {
      authStub.loginConGoogle = () => throwError(() => ({ error: { message: 'Fallo Google' } }));

      (component as any).onGoogleResponse({ credential: 'id-token' });

      expect(component.cargando).toBe(false);
      expect(component.error).toBe('Fallo Google');
    });

    it('usa un mensaje por defecto cuando el error de Google no trae detalle', () => {
      authStub.loginConGoogle = () => throwError(() => ({}));

      (component as any).onGoogleResponse({ credential: 'id-token' });

      expect(component.error).toBe('No se pudo iniciar sesión con Google');
    });
  });

  describe('iniciarGoogleBtn', () => {
    afterEach(() => {
      delete (globalThis as any).google;
      vi.useRealTimers();
    });

    it('inicializa y renderiza el botón de Google cuando la API está disponible', () => {
      vi.useFakeTimers();
      const initialize = vi.fn();
      const renderButton = vi.fn();
      (globalThis as any).google = { accounts: { id: { initialize, renderButton } } };
      (component as any).googleBtn = { nativeElement: { tag: 'div' } };

      (component as any).iniciarGoogleBtn();
      vi.advanceTimersByTime(150);

      expect(initialize).toHaveBeenCalledTimes(1);
      expect(renderButton).toHaveBeenCalledTimes(1);
      expect(renderButton.mock.calls[0][1].text).toBe('continue_with');

      vi.advanceTimersByTime(5000);
    });

    it('registra una advertencia si la inicialización de Google falla', () => {
      vi.useFakeTimers();
      const warn = console.warn;
      const avisos: any[] = [];
      console.warn = (...args: any[]) => avisos.push(args);
      (globalThis as any).google = {
        accounts: {
          id: {
            initialize: () => {
              throw new Error('boom');
            },
            renderButton: vi.fn()
          }
        }
      };
      (component as any).googleBtn = { nativeElement: {} };

      (component as any).iniciarGoogleBtn();
      vi.advanceTimersByTime(150);
      console.warn = warn;

      expect(avisos.length).toBe(1);
      expect(avisos[0][0]).toContain('Error inicializando botón de Google');
    });
  });
});
