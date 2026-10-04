import type { Coordinate } from '../types/map';

const EARTH_RADIUS_METERS = 6371000; // Radio medio de la Tierra en metros

/**
 * Calcula la distancia geodésica entre dos coordenadas en metros
 * mediante la Fórmula de Haversine.
 *
 * Marcado con la directiva 'worklet' para ejecutarse directamente en el
 * runtime de C++ de Reanimated a 60/120 FPS sin bloquear el JavaScript thread.
 *
 * @param coord1 Coordenada de origen { latitude, longitude }
 * @param coord2 Coordenada de destino { latitude, longitude }
 * @returns Distancia en metros (número flotante positivo)
 */
export function calculateHaversineDistanceWorklet(
  coord1: Coordinate,
  coord2: Coordinate
): number {
  'worklet';
  const toRad = Math.PI / 180;
  const lat1Rad = coord1.latitude * toRad;
  const lat2Rad = coord2.latitude * toRad;
  const deltaLatRad = (coord2.latitude - coord1.latitude) * toRad;
  const deltaLonRad = (coord2.longitude - coord1.longitude) * toRad;

  const a =
    Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLonRad / 2) *
      Math.sin(deltaLonRad / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Valida si dos puntos se encuentran a una distancia menor o igual a un umbral en metros.
 *
 * @param p1 Primer punto
 * @param p2 Segundo punto
 * @param thresholdMeters Distancia máxima permitida en metros
 * @returns true si d <= thresholdMeters
 */
export function isWithinDistanceWorklet(
  p1: Coordinate,
  p2: Coordinate,
  thresholdMeters: number
): boolean {
  'worklet';
  return calculateHaversineDistanceWorklet(p1, p2) <= thresholdMeters;
}
