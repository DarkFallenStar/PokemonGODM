import type { Coordinate } from '../types/map';

// Coordenadas perimetrales de alta precisión del Campus Universidad de La Sabana (Chía, Cundinamarca)
export const UNISABANA_POLYGON: Coordinate[] = [
  { latitude: 4.86430, longitude: -74.03520 }, // 1. Puente del Común (Norte)
  { latitude: 4.86310, longitude: -74.03600 }, // 2. Edificio Ad Portas (Noroeste)
  { latitude: 4.86050, longitude: -74.03550 }, // 3. Costado Occidental / Parqueaderos
  { latitude: 4.85680, longitude: -74.03620 }, // 4. Canchas Deportivas / Pistas (Suroeste)
  { latitude: 4.85620, longitude: -74.03380 }, // 5. Edificio O / Zona Río (Sur)
  { latitude: 4.85900, longitude: -74.03150 }, // 6. Zona del Lago / Costado Oriental
  { latitude: 4.86200, longitude: -74.03180 }, // 7. Biblioteca / Plazoleta Central (Noreste)
  { latitude: 4.86430, longitude: -74.03520 }, // 8. Cierre del polígono al vértice inicial
];

// Punto céntrico de referencia del Campus (Biblioteca Octavio Arizmendi)
export const CAMPUS_CENTER_COORDINATE: Coordinate = {
  latitude: 4.86082,
  longitude: -74.03264,
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

/**
 * Genera una estructura GeoJSON FeatureCollection para dibujar el polígono perimetral
 * en Mapbox ShapeSource.
 */
export function getGeofenceGeoJSON(polygon: Coordinate[]) {
  // GeoJSON espera coordenadas en formato [longitud, latitud]
  const coordinates = polygon.map(p => [p.longitude, p.latitude]);

  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: {
          name: 'Campus Universidad de La Sabana',
        },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [coordinates],
        },
      },
    ],
  };
}
