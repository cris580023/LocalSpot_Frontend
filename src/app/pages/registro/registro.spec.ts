import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { RegistroComponent } from './registro';
import { AuthService } from '../../services/auth';

describe('Registro', () => {
  let component: RegistroComponent;
  let fixture: ComponentFixture<RegistroComponent>;
  let authStub: any;

  beforeEach(async () => {
    authStub = {
      registrar: () => of({ success: true }),
      loginConGoogle: () => of({}),
      getRol: () => 'FINAL'
    };

    await TestBed.configureTestingModule({
      imports: [RegistroComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: authStub }]
    }).compileComponents();

    fixture = TestBed.createComponent(RegistroComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('onRegistro', () => {
    it('no registra si falta el nombre', () => {
      let llamado = false;
      authStub.registrar = () => {
        llamado = true;
        return of({});
      };
      component.nuevoUsuario = { nombre: '', correo: 'a@a.com', password: 'p' };

      component.onRegistro();

      expect(llamado).toBe(false);
      expect(component.cargando).toBe(false);
    });

    it('no registra si falta el correo', () => {
      component.nuevoUsuario = { nombre: 'Nombre', correo: '', password: 'p' };
      component.onRegistro();
      expect(component.cargando).toBe(false);
    });

    it('no registra si falta la contraseña', () => {
      component.nuevoUsuario = { nombre: 'Nombre', correo: 'a@a.com', password: '' };
      component.onRegistro();
      expect(component.cargando).toBe(false);
    });

    it('navega al login cuando el registro es exitoso', () => {
      const router = TestBed.inject(Router);
      const nav: any[] = [];
      router.navigate = ((cmds: any) => {
        nav.push(cmds);
        return Promise.resolve(true);
      }) as any;

      component.nuevoUsuario = { nombre: 'Nuevo', correo: 'nuevo@x.com', password: 'secret' };

      component.onRegistro();

      expect(component.cargando).toBe(false);
      expect(nav).toEqual([['/login']]);
    });

    it('muestra el mensaje del backend cuando el registro falla', () => {
      authStub.registrar = () => throwError(() => ({ error: { mensaje: 'Correo ya existe' } }));
      component.nuevoUsuario = { nombre: 'Nuevo', correo: 'nuevo@x.com', password: 'secret' };

      component.onRegistro();

      expect(component.error).toBe('Correo ya existe');
      expect(component.cargando).toBe(false);
    });

    it('usa un mensaje por defecto cuando el error no trae mensaje', () => {
      authStub.registrar = () => throwError(() => ({ status: 500 }));
      component.nuevoUsuario = { nombre: 'Nuevo', correo: 'nuevo@x.com', password: 'secret' };

      component.onRegistro();

      expect(component.error).toBe('Error al registrar el usuario.');
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
      authStub.getRol = () => 'FINAL';

      (component as any).onGoogleResponse({ credential: 'id-token' });

      expect(component.cargando).toBe(false);
      expect(nav).toContain('/lugares');
    });

    it('muestra un error cuando el registro con Google falla', () => {
      authStub.loginConGoogle = () => throwError(() => ({ error: { mensaje: 'Correo en uso' } }));

      (component as any).onGoogleResponse({ credential: 'id-token' });

      expect(component.error).toBe('Correo en uso');
      expect(component.cargando).toBe(false);
    });

    it('usa un mensaje por defecto cuando el error de Google no trae detalle', () => {
      authStub.loginConGoogle = () => throwError(() => ({}));

      (component as any).onGoogleResponse({ credential: 'id-token' });

      expect(component.error).toBe('No se pudo registrar con Google');
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
      expect(renderButton.mock.calls[0][1].text).toBe('signup_with');

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
      expect(avisos[0][0]).toContain('Error inicializando botón de Google en registro');
    });
  });
});
