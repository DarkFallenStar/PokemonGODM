import type { Coordinate } from '../types/map';

// Coordenadas perimetrales de alta precisión del Campus Universidad de La Sabana (Chía, Cundinamarca)
export const UNISABANA_POLYGON: Coordinate[] = [
  { latitude: 4.86300, longitude: -74.03550 }, // 1. Entrada Peatonal Cerca de la Rotonda
  { latitude: 4.86073, longitude: -74.03600 }, // 2. Abajo del 1, Parqueaderos
  { latitude: 4.85975, longitude: -74.03510 }, // 3. Costado Occidental / Parqueaderos
  { latitude: 4.86000, longitude: -74.03355 }, // 4. Canchas Deportivas / Pistas (Suroeste)
  { latitude: 4.85825, longitude: -74.03450 }, // 5.
  { latitude: 4.85770, longitude: -74.03410 }, // 6. Edificio O / Zona Río (Sur)
  { latitude: 4.85970, longitude: -74.03090 }, // 7. Zona del Lago / Costado Oriental
  { latitude: 4.86240, longitude: -74.03050 }, // 8. Biblioteca / Plazoleta Central (Noreste)
  { latitude: 4.86330, longitude: -74.03120 }, // 9. Cierre del polígono al vértice inicial
];

// Punto céntrico de referencia del Campus (Biblioteca Octavio Arizmendi)
export const CAMPUS_CENTER_COORDINATE: Coordinate = {
  latitude: 4.86082,
  longitude: -74.03264,
};

// Coordenadas perimetrales del Sector Buena Suerte (Cajicá, Cundinamarca)
export const HOME_CAJICA_POLYGON: Coordinate[] = [
  { latitude: 4.89120, longitude: -74.03400 }, // 1. Noroeste
  { latitude: 4.89150, longitude: -74.03175 }, // 2. Norte
  { latitude: 4.89120, longitude: -74.02950 }, // 3. Noreste
  { latitude: 4.88885, longitude: -74.02920 }, // 4. Este
  { latitude: 4.88650, longitude: -74.02950 }, // 5. Sureste
  { latitude: 4.88620, longitude: -74.03175 }, // 6. Sur
  { latitude: 4.88650, longitude: -74.03400 }, // 7. Suroeste
  { latitude: 4.88885, longitude: -74.03430 }, // 8. Oeste
  { latitude: 4.89120, longitude: -74.03400 }, // Cierre
];

export const HOME_CAJICA_CENTER: Coordinate = {
  latitude: 4.8888463,
  longitude: -74.0317459,
};

/**
 * Algoritmo de Punto en Polígono (Ray-Casting Algorithm / Even-Odd Rule).
 * Marcado con la directiva 'worklet' para ejecutarse en el runtime de C++ de Reanimated
 * garantizando cero bloqueos del Main Thread (UI Thread).
 *
 * Complejidad temporal: O(N) donde N es el número de vértices del polígono.
 * Complejidad espacial: O(1) memoria auxiliar constante.
 */
export function isPointInPolygonWorklet(
  point: Coordinate,
  polygon: Coordinate[]
): boolean {
  'worklet';
  const x = point.longitude;
  const y = point.latitude;
  let inside = false;

  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;

    // Condición de intersección horizontal del rayo proyectado hacia +infinito
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

export const isTestZoneEnabled = (): boolean => {
  return process.env.EXPO_PUBLIC_ENABLE_TEST_ZONE === 'true';
};

/**
 * Evalúa si un punto se encuentra en las zonas autorizadas.
 * - Si enableTestZone es true: Evalúa tanto UniSabana como Cajicá.
 * - Si enableTestZone es false: Evalúa ESTRICTAMENTE el Campus UniSabana (Modo Oficial).
 */
export function isPointInAuthorizedZonesWorklet(
  point: Coordinate,
  enableTestZone: boolean = false
): boolean {
  'worklet';
  const inUniSabana = isPointInPolygonWorklet(point, UNISABANA_POLYGON);
  if (inUniSabana) {
    return true;
  }
  if (enableTestZone) {
    return isPointInPolygonWorklet(point, HOME_CAJICA_POLYGON);
  }
  return false;
}

/**
 * Genera una estructura GeoJSON FeatureCollection para dibujar los polígonos
 * perimetrales autorizados en Mapbox ShapeSource según el modo de entorno.
 */
export function getGeofenceGeoJSON(enableTestZone: boolean = false) {
  const sabanaCoords = UNISABANA_POLYGON.map(p => [p.longitude, p.latitude]);

  const features: any[] = [
    {
      type: 'Feature' as const,
      properties: {
        id: 'unisabana',
        name: 'Campus Universidad de La Sabana',
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [sabanaCoords],
      },
    },
  ];

  if (enableTestZone) {
    const cajicaCoords = HOME_CAJICA_POLYGON.map(p => [p.longitude, p.latitude]);
    features.push({
      type: 'Feature' as const,
      properties: {
        id: 'cajica-buena-suerte',
        name: 'Sector Buena Suerte (Cajicá - Modo Pruebas)',
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [cajicaCoords],
      },
    });
  }

  return {
    type: 'FeatureCollection' as const,
    features,
  };
}
