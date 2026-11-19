import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import {
  LugaresService,
  iconoDeOpcion,
  horariosPorDefecto,
  generarResumenHorario,
  METODOS_PAGO,
  PROPIETARIO_LEGACY_ID
} from './lugares.service';
import { environment } from '../../environments/environment';

describe('LugaresService (Unit Tests)', () => {
  let service: LugaresService;
  let httpMock: HttpTestingController;
  const LUGARES_KEY = 'localspot_lugares_mock';

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('helpers', () => {
    it('iconoDeOpcion devuelve el icono del catálogo o un check por defecto', () => {
      expect(iconoDeOpcion(METODOS_PAGO, 'Efectivo')).toBe('💵');
      expect(iconoDeOpcion(METODOS_PAGO, 'NoExiste')).toBe('✓');
    });

    it('horariosPorDefecto marca días laborables abiertos y fin de semana cerrado', () => {
      const horarios = horariosPorDefecto();
      expect(horarios.length).toBe(7);
      expect(horarios[0]).toEqual({ dia: 'Lunes', abierto: true, apertura: '08:00', cierre: '18:00' });
      expect(horarios[5].abierto).toBe(false);
      expect(horarios[6].abierto).toBe(false);
    });

    it('generarResumenHorario indica cierre cuando no hay días abiertos', () => {
      expect(generarResumenHorario([])).toBe('Cerrado temporalmente');
      expect(generarResumenHorario(horariosPorDefecto().map(h => ({ ...h, abierto: false })))).toBe(
        'Cerrado temporalmente'
      );
    });

    it('generarResumenHorario agrupa días contiguos con el mismo horario', () => {
      expect(generarResumenHorario(horariosPorDefecto())).toBe('Lunes a Viernes: 08:00 - 18:00');
    });

    it('generarResumenHorario separa segmentos con horarios distintos', () => {
      const horarios = [
        { dia: 'Lunes', abierto: true, apertura: '08:00', cierre: '18:00' },
        { dia: 'Martes', abierto: false, apertura: '08:00', cierre: '18:00' },
        { dia: 'Miércoles', abierto: true, apertura: '09:00', cierre: '17:00' }
      ];
      expect(generarResumenHorario(horarios)).toBe('Lunes: 08:00 - 18:00 · Miércoles: 09:00 - 17:00');
    });
  });

  describe('cargarLugares', () => {
    it('adapta la respuesta del backend y la persiste en el almacén', () => {
      service = TestBed.inject(LugaresService);
      let resultado: any;
      service.cargarLugares().subscribe(r => (resultado = r));

      const req = httpMock.expectOne(`${environment.apiUrl}/lugares?size=50`);
      expect(req.request.method).toBe('GET');
      req.flush({
        content: [
          {
            idLugar: 1,
            nombre: 'Con precio alto',
            nombreCategoria: 'cafeteria',
            promedioCalificacion: 0,
            fotos: [{ urlFoto: 'u1.jpg' }],
            precioMax: 60000,
            latitud: '4.5',
            longitud: '-74',
            idPropietario: 7
          },
          { idLugar: 2, nombre: 'Precio medio', nombreCategoria: 'bar', fotos: ['u2.jpg'], precioMax: 30000 },
          { idLugar: 3, nombre: 'Precio bajo', nombreCategoria: 'cine', fotos: [], precioMax: 10000 },
          { idLugar: 4, nombre: 'Sin extras', nombreCategoria: 'deportes' },
          { idLugar: 5, nombre: 'Por idCategoria', idCategoria: '5' }
        ]
      });

      expect(resultado.length).toBe(5);
      expect(resultado[0].id).toBe(1);
      expect(resultado[0].categoria).toBe('cafes');
      expect(resultado[0].calificacion).toBe(4.5); // promedioCalificacion 0 es falsy -> 4.5
      expect(resultado[0].rangoPrecio).toBe(3);
      expect(resultado[0].fotos).toEqual(['u1.jpg']);
      expect(resultado[0].latitud).toBe(4.5);
      expect(resultado[0].propietarioId).toBe(7);
      expect(resultado[1].rangoPrecio).toBe(2);
      expect(resultado[1].fotos).toEqual(['u2.jpg']);
      expect(resultado[2].rangoPrecio).toBe(1);
      expect(resultado[2].fotos[0]).toContain('picsum.photos/seed/lugar3');
      expect(resultado[3].rangoPrecio).toBe(2);
      expect(resultado[4].categoria).toBe('compras');
      expect(JSON.parse(localStorage.getItem(LUGARES_KEY) as string).length).toBe(5);
    });

    it('devuelve los publicados cuando el backend responde con content vacío', () => {
      service = TestBed.inject(LugaresService);
      let resultado: any;
      service.cargarLugares().subscribe(r => (resultado = r));

      httpMock.expectOne(`${environment.apiUrl}/lugares?size=50`).flush({ content: [] });

      expect(resultado.length).toBe(6);
    });

    it('devuelve los publicados ante un error del backend', () => {
      service = TestBed.inject(LugaresService);
      let resultado: any;
      service.cargarLugares().subscribe(r => (resultado = r));

      httpMock
        .expectOne(`${environment.apiUrl}/lugares?size=50`)
        .flush('caído', { status: 500, statusText: 'Server Error' });

      expect(resultado.length).toBe(6);
    });
  });

  describe('buscarConIa', () => {
    it('adapta los resultados de la búsqueda con IA', () => {
      service = TestBed.inject(LugaresService);
      let resultado: any;
      service.buscarConIa('café').subscribe(r => (resultado = r));

      const req = httpMock.expectOne(`${environment.apiUrl}/lugares/buscar-ia`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ consulta: 'café' });
      req.flush([
        {
          lugar: { idLugar: 5, nombre: 'X', nombreCategoria: 'cafe', fotos: [{ urlFoto: 'u' }], precioMax: 15000 },
          motivoIa: 'cerca'
        }
      ]);

      expect(resultado.length).toBe(1);
      expect(resultado[0].lugar.categoria).toBe('cafes');
      expect(resultado[0].lugar.rangoPrecio).toBe(1);
      expect(resultado[0].motivoIa).toBe('cerca');
    });

    it('devuelve [] cuando la respuesta no es un arreglo', () => {
      service = TestBed.inject(LugaresService);
      let resultado: any;
      service.buscarConIa('x').subscribe(r => (resultado = r));

      httpMock.expectOne(`${environment.apiUrl}/lugares/buscar-ia`).flush({ no: 'array' });

      expect(resultado).toEqual([]);
    });

    it('devuelve [] ante un error', () => {
      const warn = console.warn;
      console.warn = () => undefined;
      service = TestBed.inject(LugaresService);
      let resultado: any;
      service.buscarConIa('x').subscribe(r => (resultado = r));

      httpMock
        .expectOne(`${environment.apiUrl}/lugares/buscar-ia`)
        .flush('err', { status: 500, statusText: 'Server Error' });
      console.warn = warn;

      expect(resultado).toEqual([]);
    });
  });

  describe('mapearCategoria', () => {
    it('traduce todas las categorías conocidas y cae a restaurantes', () => {
      service = TestBed.inject(LugaresService);
      const m = (valor: any) => (service as any).mapearCategoria(valor);

      expect(m('Restaurante')).toBe('restaurantes');
      expect(m('1')).toBe('restaurantes');
      expect(m('Cafetería')).toBe('cafes');
      expect(m('cafe')).toBe('cafes');
      expect(m('Bar')).toBe('bares');
      expect(m('Entretenimiento')).toBe('entretenimiento');
      expect(m('Cine')).toBe('entretenimiento');
      expect(m('2')).toBe('entretenimiento');
      expect(m('Deportes')).toBe('deportes');
      expect(m('Compras')).toBe('compras');
      expect(m('Tienda')).toBe('compras');
      expect(m('5')).toBe('compras');
      expect(m('Cultural')).toBe('entretenimiento');
      expect(m('3')).toBe('entretenimiento');
      expect(m('Naturaleza')).toBe('entretenimiento');
      expect(m('4')).toBe('entretenimiento');
      expect(m(null)).toBe('restaurantes');
    });
  });

  describe('carga inicial (loadLugares)', () => {
    it('usa las semillas cuando no hay nada guardado', () => {
      service = TestBed.inject(LugaresService);
      const todos = service.getTodosLosLugares();
      expect(todos.length).toBe(6);
      expect(todos[0].nombre).toBe('Restaurante El Mirador');
    });

    it('devuelve las semillas cuando el JSON guardado es inválido', () => {
      localStorage.setItem(LUGARES_KEY, 'no-es-json');
      service = TestBed.inject(LugaresService);
      expect(service.getTodosLosLugares().length).toBe(6);
    });

    it('devuelve las semillas cuando el almacén no es un arreglo', () => {
      localStorage.setItem(LUGARES_KEY, JSON.stringify({ foo: 'bar' }));
      service = TestBed.inject(LugaresService);
      expect(service.getTodosLosLugares().length).toBe(6);
    });

    it('re-fusiona las semillas por id, conserva las nuevas y agrega las faltantes', () => {
      localStorage.setItem(
        LUGARES_KEY,
        JSON.stringify([
          { id: 1, nombre: 'Modificado', categoria: 'restaurantes', publicado: true },
          { id: 99, nombre: 'Negocio Propio', categoria: 'bares', publicado: false, propietarioId: 7 },
          { id: 100, nombre: 'Sin extras', categoria: 'cafes' }
        ])
      );
      service = TestBed.inject(LugaresService);
      const todos = service.getTodosLosLugares();

      expect(todos.find(l => l.id === 1)?.nombre).toBe('Restaurante El Mirador');
      expect(todos.find(l => l.id === 99)?.nombre).toBe('Negocio Propio');
      expect(todos.find(l => l.id === 100)?.publicado).toBe(true);
      expect(todos.find(l => l.id === 100)?.propietarioId).toBe(PROPIETARIO_LEGACY_ID);
      expect(todos.length).toBe(8);
      const ids = todos.map(l => l.id);
      expect(ids).toEqual([...ids].sort((a, b) => a - b));
    });
  });

  describe('agregarResena', () => {
    it('añade la reseña y recalcula el promedio', () => {
      service = TestBed.inject(LugaresService);
      service.agregarResena(1, { usuario: 'Ana', estrellas: 5, fecha: 'hoy', comentario: 'ok' });
      expect(service.getLugarById(1)!.calificacion).toBe(5);
      expect(service.getLugarById(1)!.calificaciones?.length).toBe(1);

      service.agregarResena(1, { usuario: 'Luis', estrellas: 3, fecha: 'hoy', comentario: 'bien' });
      expect(service.getLugarById(1)!.calificacion).toBe(4);
      expect(service.getLugarById(1)!.calificaciones?.length).toBe(2);
    });

    it('no modifica nada si el id no existe', () => {
      service = TestBed.inject(LugaresService);
      const antes = service.getTodosLosLugares().length;
      service.agregarResena(9999, { usuario: 'x', estrellas: 4, fecha: 'hoy', comentario: 'x' });
      expect(service.getTodosLosLugares().length).toBe(antes);
    });
  });

  describe('reclamarNegociosHeredados', () => {
    it('no hace nada con id inválido o legacy', () => {
      service = TestBed.inject(LugaresService);
      expect(service.reclamarNegociosHeredados(0)).toBe(0);
      expect(service.reclamarNegociosHeredados(PROPIETARIO_LEGACY_ID)).toBe(0);
    });

    it('reasigna los negocios con id legacy > 6 y es idempotente', () => {
      service = TestBed.inject(LugaresService);
      service.agregarLugar({ nombre: 'Heredado', categoria: 'bares', propietarioId: PROPIETARIO_LEGACY_ID });

      expect(service.reclamarNegociosHeredados(55)).toBe(1);
      expect(service.getTodosLosLugares().find(l => l.nombre === 'Heredado')!.propietarioId).toBe(55);
      expect(service.reclamarNegociosHeredados(55)).toBe(0);
    });

    it('no reasigna las semillas (id <= 6)', () => {
      service = TestBed.inject(LugaresService);
      service.actualizarLugar(1, { propietarioId: PROPIETARIO_LEGACY_ID });

      expect(service.reclamarNegociosHeredados(77)).toBe(0);
      expect(service.getLugarById(1)!.propietarioId).toBe(PROPIETARIO_LEGACY_ID);
    });
  });

  describe('consultas y mutaciones', () => {
    it('getLugaresPublicados filtra por publicado y getTodosLosLugares los expone todos', () => {
      service = TestBed.inject(LugaresService);
      expect(service.getTodosLosLugares().length).toBe(6);
      expect(service.getLugaresPublicados().length).toBe(6);

      service.agregarLugar({ nombre: 'Borrador', categoria: 'cafes' });
      expect(service.getTodosLosLugares().length).toBe(7);
      expect(service.getLugaresPublicados().length).toBe(6);
    });

    it('getLugaresPorPropietario devuelve [] sin id y filtra por propietario e id > 6', () => {
      service = TestBed.inject(LugaresService);
      expect(service.getLugaresPorPropietario(0)).toEqual([]);

      service.agregarLugar({ nombre: 'Mío', categoria: 'cafes', propietarioId: 8 });
      const mios = service.getLugaresPorPropietario(8);
      expect(mios.length).toBe(1);
      expect(mios[0].nombre).toBe('Mío');
    });

    it('getLugarById encuentra por id o devuelve undefined', () => {
      service = TestBed.inject(LugaresService);
      expect(service.getLugarById(1)?.nombre).toBe('Restaurante El Mirador');
      expect(service.getLugarById(9999)).toBeUndefined();
    });

    it('agregarLugar crea un borrador con valores por defecto', () => {
      service = TestBed.inject(LugaresService);
      service.agregarLugar({});
      const nuevo = service.getTodosLosLugares().slice(-1)[0];

      expect(nuevo.publicado).toBe(false);
      expect(nuevo.categoria).toBe('restaurantes');
      expect(nuevo.rangoPrecio).toBe(2);
      expect(nuevo.horarios?.length).toBe(7);
      expect(nuevo.pagos).toEqual(['Efectivo', 'Tarjeta']);
      expect(nuevo.icono).toBe('📍');
    });

    it('agregarLugar asigna el icono según la categoría', () => {
      service = TestBed.inject(LugaresService);
      service.agregarLugar({ nombre: 'Café', categoria: 'cafes' });
      expect(service.getTodosLosLugares().find(l => l.nombre === 'Café')!.icono).toBe('☕');
    });

    it('actualizarLugar aplica cambios solo al id indicado', () => {
      service = TestBed.inject(LugaresService);
      service.actualizarLugar(1, { nombre: 'Cambiado' });
      expect(service.getLugarById(1)!.nombre).toBe('Cambiado');
      expect(service.getLugarById(2)!.nombre).toBe('Café Central');
    });
  });

  describe('getIconoPorCategoria', () => {
    it('devuelve el icono de la categoría o un pin por defecto', () => {
      service = TestBed.inject(LugaresService);
      expect((service as any).getIconoPorCategoria('bares')).toBe('🍸');
      expect((service as any).getIconoPorCategoria('desconocida')).toBe('📍');
    });
  });
});
