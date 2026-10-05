/**
 * Utilidades cinemáticas y balísticas para el lanzamiento de Pokéballs en Reanimated.
 * Implementa física parabólica 3D proyectada en perspectiva 2D en el UI Thread (Worklet).
 */

export interface SwipeMetrics {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  durationMs: number;
}

export interface BallTrajectoryState {
  x: number;
  y: number;
  z: number;
  scale: number;
  isHit: boolean;
}

// Constantes físicas del simulador
export const GRAVITY = 9.81; // m/s^2
export const TARGET_Z_DEPTH = 7.5; // Distancia virtual hacia el Pokémon en metros
export const FOCAL_LENGTH = 3.5; // Distancia focal de la cámara virtual para perspectiva
export const HITBOX_RADIUS_PX = 65; // Radio de colisión en pantalla (px)
export const HITBOX_DEPTH_TOLERANCE = 0.6; // Tolerancia en eje Z (m)

/**
 * Calcula el vector de velocidad inicial (vx, vy, vz) a partir del swipe gesture.
 * Ejecuta en Worklet para cero latencia en el UI thread.
 */
export function calculateInitialVelocityWorklet(metrics: SwipeMetrics) {
  'worklet';
  const dx = metrics.endX - metrics.startX;
  const dy = metrics.endY - metrics.startY; // dy negativo significa swipe hacia arriba
  const dtSeconds = Math.max(0.08, Math.min(0.75, metrics.durationMs / 1000));

  // Factores de calibración empírica para adecuar la pantalla al mundo virtual 3D
  const betaX = 0.0055;
  const betaY = 0.016;
  const betaZ = 0.014;

  const vx = (dx / dtSeconds) * betaX;
  const vy = (-dy / dtSeconds) * betaY; // Invertir signo: deslizar hacia arriba = velocidad hacia arriba
  const vz = Math.max(4.0, Math.sqrt(vx * vx + vy * vy) * betaZ);

  const elevationAngleRad = Math.atan2(vy, vz);
  const azimuthAngleRad = Math.atan2(dx, -dy);

  return {
    vx,
    vy,
    vz,
    elevationAngleRad,
    azimuthAngleRad,
  };
}

/**
 * Calcula la posición 3D (X, Y, Z) de la bola en el tiempo t_sec bajo aceleración gravitacional.
 */
export function getBallPosition3DWorklet(
  t: number,
  v0x: number,
  v0y: number,
  v0z: number,
  startX: number = 0,
  startY: number = 0,
  startZ: number = 0
) {
  'worklet';
  // Resistencia aerodinámica simplificada
  const dragFactor = Math.exp(-0.08 * t);

  const x = startX + v0x * t * dragFactor;
  const z = startZ + v0z * t * dragFactor;
  // Ecuación cinemática parabólica clásica: y = y0 + v0y*t - 0.5*g*t^2
  const y = startY + v0y * t * dragFactor - 0.5 * GRAVITY * t * t;

  return { x, y, z };
}

/**
 * Proyecta las coordenadas virtuales 3D a coordenadas de pantalla 2D con reducción de escala en profundidad.
 */
export function project3DtoScreenWorklet(
  x3d: number,
  y3d: number,
  z3d: number,
  screenWidth: number,
  screenHeight: number
) {
  'worklet';
  // Factor de escala cónica en perspectiva
  const scale = FOCAL_LENGTH / (FOCAL_LENGTH + Math.max(0, z3d));

  // Origen en la base de la pantalla (mano del entrenador)
  const screenOriginX = screenWidth / 2;
  const screenOriginY = screenHeight * 0.76;

  const screenX = screenOriginX + x3d * 65 * scale;
  const screenY = screenOriginY - y3d * 55 * scale;

  return {
    screenX,
    screenY,
    scale: Math.max(0.28, Math.min(1.0, scale)),
  };
}

/**
 * Evalúa si la bola impacta la caja de colisión (Hitbox) del Pokémon en el instante t.
 */
export function checkHitboxCollisionWorklet(
  ballScreenX: number,
  ballScreenY: number,
  ballZ: number,
  pokemonScreenX: number,
  pokemonScreenY: number,
  hitboxRadiusPx: number = HITBOX_RADIUS_PX
) {
  'worklet';
  // 1. Verificación en profundidad (eje Z): la bola debe alcanzar la distancia del Pokémon
  const isAtTargetDepth = Math.abs(ballZ - TARGET_Z_DEPTH) <= HITBOX_DEPTH_TOLERANCE;

  // 2. Verificación transversal en el plano 2D de la pantalla
  const dx = ballScreenX - pokemonScreenX;
  const dy = ballScreenY - pokemonScreenY;
  const distancePx = Math.sqrt(dx * dx + dy * dy);

  const isInsideHitbox = distancePx <= hitboxRadiusPx;

  return {
    isHit: isAtTargetDepth && isInsideHitbox,
    distancePx,
    isAtTargetDepth,
  };
}
