import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { vi } from 'vitest';
import { MapaComponent } from './mapa.component';

interface InstanciasGoogle {
  map: any[];
  marker: any[];
  info: any[];
}

/**
 * Stub del SDK de Google Maps. Usa funciones constructoras reales (no arrow
 * functions) para que `new window.google.maps.Map(...)` funcione en jsdom.
 * Registra las instancias creadas para poder verificar sus interacciones.
 */
function montarGoogle(options: { mapImpl?: any } = {}): InstanciasGoogle {
  const instancias: InstanciasGoogle = { map: [], marker: [], info: [] };

  function MapaFalso(this: any, el: any, opts: any) {
    this.el = el;
    this.opts = opts;
    this.setCenter = vi.fn();
    this.addListener = vi.fn();
    instancias.map.push(this);
  }

  function MarcadorFalso(this: any, opts: any) {
    this.opts = opts;
    this.setPosition = vi.fn();
    this.addListener = vi.fn();
    instancias.marker.push(this);
  }

  function InfoFalso(this: any, opts: any) {
    this.opts = opts;
    this.open = vi.fn();
    instancias.info.push(this);
  }

  (window as any).google = {
    maps: {
      Map: options.mapImpl || MapaFalso,
      Marker: MarcadorFalso,
      InfoWindow: InfoFalso,
      Animation: { DROP: 'DROP' }
    }
  };

  return instancias;
}

describe('MapaComponent', () => {
  let component: MapaComponent;
  let fixture: ComponentFixture<MapaComponent>;

  const limpiar = () => {
    delete (window as any).google;
    delete (window as any).__googleMapsLoading;
    delete (window as any).__googleMapsCallbacks;
    document.head.querySelectorAll('script[src*="maps.googleapis.com"]').forEach(s => s.remove());
  };

  const crear = () => {
    fixture = TestBed.createComponent(MapaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    return component;
  };

  beforeEach(() => {
    limpiar();
  });

  afterEach(() => {
    limpiar();
  });

  it('should create', () => {
    expect(crear()).toBeTruthy();
    expect(component.cargando).toBe(true);
  });

  it('construye la URL de "cómo llegar" con las coordenadas actuales', () => {
    crear();
    component.lat = 4.5;
    component.lng = -74.1;

    expect(component.getUrlComoLlegar()).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=4.5,-74.1'
    );
  });

  it('inyecta el script de Google Maps cuando la API no está cargada', () => {
    crear();

    const script = document.head.querySelector(
      'script[src*="maps.googleapis.com"]'
    ) as HTMLScriptElement;

    expect(script).toBeTruthy();
    expect((window as any).__googleMapsLoading).toBe(true);
    expect(component.cargando).toBe(true);

    montarGoogle();
    script.onload!(new Event('load'));

    expect((window as any).__googleMapsLoading).toBe(false);
    expect(component.cargando).toBe(false);
  });

  it('muestra un error si el script falla al cargar y detiene la carga', () => {
    crear();

    const script = document.head.querySelector(
      'script[src*="maps.googleapis.com"]'
    ) as HTMLScriptElement;

    script.onerror!(new Event('error'));

    expect(component.cargando).toBe(false);
    expect(component.error).toContain('No se pudo cargar Google Maps');
  });

  it('encola la inicialización si ya hay una carga de Google Maps en curso', () => {
    (window as any).__googleMapsLoading = true;
    (window as any).__googleMapsCallbacks = [];

    crear();

    expect((window as any).__googleMapsCallbacks.length).toBe(1);
  });

  it('inicializa el mapa cuando google.maps ya está disponible', () => {
    crear();

    const instancias = montarGoogle();
    (component as any).inicializarMapa();

    const map = instancias.map[0];
    const marker = instancias.marker[0];

    expect(component.cargando).toBe(false);
    expect(component.error).toBe('');
    expect(instancias.map.length).toBe(1);
    expect(instancias.marker.length).toBe(1);
    expect(instancias.info.length).toBe(1);
    expect(component.map).toBe(map);
    expect(component.marker).toBe(marker);
    expect(marker.addListener).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('no registra listeners de edición cuando editable es false', () => {
    crear();

    const instancias = montarGoogle();
    (component as any).inicializarMapa();

    const eventos = instancias.marker[0].addListener.mock.calls.map((c: any[]) => c[0]);
    expect(eventos).toContain('click');
    expect(eventos).not.toContain('dragend');
  });

  it('abre la ventana de información al hacer clic en el marcador', () => {
    crear();

    const instancias = montarGoogle();
    (component as any).inicializarMapa();

    const clickHandler = instancias.marker[0].addListener.mock.calls.find(
      (c: any[]) => c[0] === 'click'
    )![1];
    clickHandler();

    expect(instancias.info[0].open).toHaveBeenCalledWith(component.map, component.marker);
  });

  it('permite mover el marcador y emite coordenadas cuando editable es true', () => {
    crear();

    const instancias = montarGoogle();
    component.editable = true;

    const emitidos: any[] = [];
    component.coordenadasCambio.subscribe(c => emitidos.push(c));

    (component as any).inicializarMapa();

    const marker = instancias.marker[0];
    const map = instancias.map[0];

    const dragHandler = marker.addListener.mock.calls.find(
      (c: any[]) => c[0] === 'dragend'
    )![1];
    dragHandler({ latLng: { lat: () => 1.1, lng: () => 2.2 } });

    const clickHandler = map.addListener.mock.calls.find((c: any[]) => c[0] === 'click')![1];
    const clickLatLng = { lat: () => 3.3, lng: () => 4.4 };
    clickHandler({ latLng: clickLatLng });

    expect(emitidos).toEqual([
      { lat: 1.1, lng: 2.2 },
      { lat: 3.3, lng: 4.4 }
    ]);
    expect(component.lat).toBe(3.3);
    expect(component.lng).toBe(4.4);
    expect(marker.setPosition).toHaveBeenCalledWith(clickLatLng);
  });

  it('no crea el mapa si falta el contenedor', () => {
    crear();

    const instancias = montarGoogle();
    (component as any).mapContainer = undefined;
    (component as any).inicializarMapa();

    expect(instancias.map.length).toBe(0);
    expect(component.cargando).toBe(false);
  });

  it('captura el error cuando falla la construcción del mapa', () => {
    crear();

    function MapaQueFalla(this: any) {
      throw new Error('boom');
    }
    montarGoogle({ mapImpl: MapaQueFalla });
    (component as any).inicializarMapa();

    expect(component.cargando).toBe(false);
    expect(component.error).toBe('Error inicializando el mapa.');
  });

  it('recentra el mapa y mueve el marcador cuando cambian las coordenadas', () => {
    crear();

    const instancias = montarGoogle();
    (component as any).inicializarMapa();

    component.lat = 5;
    component.lng = -70;
    component.ngOnChanges({ lat: new SimpleChange(4.3372, 5, false) } as any);

    expect(instancias.map[0].setCenter).toHaveBeenCalledWith({ lat: 5, lng: -70 });
    expect(instancias.marker[0].setPosition).toHaveBeenCalledWith({ lat: 5, lng: -70 });
  });

  it('no recentra si el mapa aún no está listo', () => {
    crear();
    component.map = undefined;
    component.marker = undefined;
    component.lat = 5;
    component.lng = -70;

    expect(() =>
      component.ngOnChanges({ lat: new SimpleChange(4.3372, 5, false) } as any)
    ).not.toThrow();
  });
});
