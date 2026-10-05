import type { ActiveSpawn } from './spawns';

export type BallType = 'pokeball' | 'greatball' | 'ultraball';

export interface BallInventoryCount {
  pokeball: number;
  greatball: number;
  ultraball: number;
}

export type ThrowGrade = 'normal' | 'nice' | 'great' | 'excellent';

export interface ThrowMetrics {
  velocity_x: number;
  velocity_y: number;
  velocity_z: number;
  elevation_angle_rad: number;
  is_curve_ball: boolean;
  throw_grade: ThrowGrade;
  target_ring_ratio: number;
  hitbox_distance: number;
}

export type CaptureScreenState =
  | 'initializing'
  | 'aiming'
  | 'throwing'
  | 'ball_flying'
  | 'ball_hit'
  | 'ball_miss'
  | 'shaking_1'
  | 'shaking_2'
  | 'shaking_3'
  | 'captured'
  | 'escaped'
  | 'fled';

export interface CaptureResultPayload {
  success: boolean;
  spawn_id: string;
  pokemon_id: number;
  nickname: string;
  cp: number;
  iv_attack: number;
  iv_defense: number;
  iv_hp: number;
  balls_used: Record<BallType, number>;
  throw_grade: ThrowGrade;
  captured_at: string;
}

export interface CaptureScreenRouteParams {
  spawn: ActiveSpawn;
}
