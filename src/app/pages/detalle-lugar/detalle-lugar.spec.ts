import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { DetalleLugarComponent } from './detalle-lugar';
import { LugaresService } from '../../services/lugares.service';
import { AuthService } from '../../services/auth';
import { CalificacionesService } from '../../services/calificaciones.service';
import { FavoritosService } from '../../services/favoritos.service';

describe('DetalleLugar', () => {
  let component: DetalleLugarComponent;
  let fixture: ComponentFixture<DetalleLugarComponent>;
  let authStub: any;
  let lugaresStub: any;
  let favoritosStub: any;
  let califStub: any;
  let alertSpy: any;

  const lugarBase = {
    id: 1,
    nombre: 'Lugar de prueba',
    categoria: 'restaurantes',
    calificacion: 4.5,
    direccion: 'Calle 1',
    icono: '🍽️',
    descripcion: '',
    horario: '',
    publicado: true,
    propietarioId: 0,
    fotos: ['f1.jpg', 'f2.jpg']
  };

  beforeEach(async () => {
    authStub = { getUsuario: () => null };
    lugaresStub = {
      lugares$: of([lugarBase]),
      agregarResena: vi.fn()
    };
    favoritosStub = {
      cargarFavoritos: () => of([]),
      esFavorito: () => false,
      toggleFavorito: () => of({})
    };
    califStub = { calificar: vi.fn(() => of({ idLugar: 1 })) };

    await TestBed.configureTestingModule({
      imports: [DetalleLugarComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: '1' }) } }
        },
        { provide: LugaresService, useValue: lugaresStub },
        { provide: AuthService, useValue: authStub },
        { provide: CalificacionesService, useValue: califStub },
        { provide: FavoritosService, useValue: favoritosStub }
      ]
    }).compileComponents();

    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

    fixture = TestBed.createComponent(DetalleLugarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('carga el lugar de la ruta y reinicia el índice de foto', () => {
    expect(component.lugar.nombre).toBe('Lugar de prueba');
    expect(component.lugar.fotos).toEqual(['f1.jpg', 'f2.jpg']);
    expect(component.lugar.etiquetas).toEqual(['Restaurante', 'Verificado']);
    expect(component.indiceFoto).toBe(0);
  });

  it('completa foto y coordenadas por defecto cuando el lugar no las trae', () => {
    const enriquecido = (component as any).enriquecerLugar({
      id: 42,
      nombre: 'X',
      categoria: 'cafes',
      fotos: []
    });

    expect(enriquecido.fotos[0]).toContain('picsum.photos/seed/lugar42');
    expect(enriquecido.latitud).toBe(4.3372);
    expect(enriquecido.longitud).toBe(-74.3640);
    expect(enriquecido.rangoPrecio).toBe(2);
    expect(enriquecido.etiquetas).toEqual(['Cafetería', 'Verificado']);
  });

  it('carga favoritos y marca el lugar como favorito cuando hay sesión', () => {
    authStub.getUsuario = () => ({ id: 7, nombre: 'Ana', rol: 'FINAL' });
    const cargar = vi.fn(() => of([]));
    favoritosStub.cargarFavoritos = cargar;
    favoritosStub.esFavorito = () => true;

    const f2 = TestBed.createComponent(DetalleLugarComponent);
    const c2 = f2.componentInstance;
    f2.detectChanges();

    expect(cargar).toHaveBeenCalled();
    expect(c2.lugar.esFavorito).toBe(true);
  });

  describe('nombreCategoria', () => {
    it('traduce las categorías conocidas', () => {
      expect(component.nombreCategoria('restaurantes')).toBe('Restaurante');
      expect(component.nombreCategoria('cafes')).toBe('Cafetería');
      expect(component.nombreCategoria('bares')).toBe('Bar');
      expect(component.nombreCategoria('entretenimiento')).toBe('Entretenimiento');
      expect(component.nombreCategoria('deportes')).toBe('Deportes');
      expect(component.nombreCategoria('compras')).toBe('Compras');
    });

    it('devuelve el valor original si la categoría es desconocida', () => {
      expect(component.nombreCategoria('otra')).toBe('otra');
    });
  });

  describe('toggleFormularioResena', () => {
    it('avisa al usuario sin sesión que debe iniciar sesión', () => {
      component.usuario = null;
      component.toggleFormularioResena();

      expect(component.mostrarFormularioResena).toBe(false);
      expect(alertSpy).toHaveBeenCalledWith('Debes iniciar sesión para escribir una reseña.');
    });

    it('alterna el formulario cuando hay sesión', () => {
      component.usuario = { id: 1, nombre: 'Ana' };

      component.toggleFormularioResena();
      expect(component.mostrarFormularioResena).toBe(true);

      component.toggleFormularioResena();
      expect(component.mostrarFormularioResena).toBe(false);
    });
  });

  describe('enviarResena', () => {
    it('pide un comentario cuando está vacío', () => {
      component.usuario = { nombre: 'Ana' };
      component.nuevaResena = { estrellas: 5, comentario: '   ' };

      component.enviarResena();

      expect(califStub.calificar).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith('Por favor, escribe un comentario.');
    });

    it('guarda la reseña en el backend, refleja en UI y agradece', () => {
      component.usuario = { nombre: 'Ana' };
      component.nuevaResena = { estrellas: 4, comentario: 'Muy bueno' };

      component.enviarResena();

      expect(califStub.calificar).toHaveBeenCalledWith(component.lugar.id, 4, 'Muy bueno');
      expect(lugaresStub.agregarResena).toHaveBeenCalledTimes(1);
      expect(component.nuevaResena).toEqual({ estrellas: 5, comentario: '' });
      expect(component.mostrarFormularioResena).toBe(false);
      expect(alertSpy).toHaveBeenCalledWith('¡Gracias por tu reseña! Ha sido guardada con éxito.');
    });

    it('usa el respaldo local cuando el backend falla', () => {
      califStub.calificar = () => throwError(() => ({ status: 500 }));
      component.usuario = { nombre: 'Luis' };
      component.nuevaResena = { estrellas: 3, comentario: 'Regular' };

      component.enviarResena();

      expect(lugaresStub.agregarResena).toHaveBeenCalledTimes(1);
      expect(component.nuevaResena).toEqual({ estrellas: 5, comentario: '' });
      expect(alertSpy).toHaveBeenCalledWith('¡Gracias por tu reseña!');
    });
  });

  describe('toggleFavorito', () => {
    it('avisa al usuario sin sesión', () => {
      component.usuario = null;
      component.toggleFavorito();

      expect(alertSpy).toHaveBeenCalledWith('Inicia sesión para guardar este lugar en tus favoritos.');
    });

    it('actualiza el estado cuando el backend responde', () => {
      component.usuario = { id: 1 };
      favoritosStub.esFavorito = () => true;
      const toggle = vi.fn(() => of({}));
      favoritosStub.toggleFavorito = toggle;

      component.toggleFavorito();

      expect(toggle).toHaveBeenCalledWith(component.lugar.id);
      expect(component.lugar.esFavorito).toBe(true);
    });

    it('aplica un cambio optimista cuando el backend falla', () => {
      component.usuario = { id: 1 };
      favoritosStub.toggleFavorito = () => throwError(() => ({ status: 401 }));
      component.lugar.esFavorito = false;

      component.toggleFavorito();

      expect(component.lugar.esFavorito).toBe(true);
    });
  });

  describe('navegación de fotos', () => {
    it('avanza, retrocede y salta de forma circular', () => {
      component.indiceFoto = 0;

      component.siguienteFoto();
      expect(component.indiceFoto).toBe(1);

      component.siguienteFoto();
      expect(component.indiceFoto).toBe(0);

      component.anteriorFoto();
      expect(component.indiceFoto).toBe(1);

      component.irAFoto(0);
      expect(component.indiceFoto).toBe(0);
    });
  });

  describe('formato de precio', () => {
    it('representa el rango con símbolos y etiqueta', () => {
      expect(component.simbolosPrecio(3)).toBe('$$$');
      expect(component.etiquetaPrecio(1)).toBe('Económico');
      expect(component.etiquetaPrecio(2)).toBe('Moderado');
      expect(component.etiquetaPrecio(3)).toBe('Premium');
      expect(component.etiquetaPrecio(9)).toBe('Moderado');
    });
  });
});
