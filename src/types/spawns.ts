import type { PokemonBase } from './pokemon';

export interface ActiveSpawn {
  id: string;
  pokemon_id: number;
  latitude: number;
  longitude: number;
  is_test_zone: boolean;
  spawned_at: string;
  expires_at: string;
  iv_attack: number;
  iv_defense: number;
  iv_hp: number;
  cp: number;
  is_active: boolean;
  pokemon?: PokemonBase;
  // Campos calculados en cliente
  distance_meters?: number;
  is_in_range?: boolean; // <= 30m
}

export type SpawnRarityTier = 'common' | 'uncommon' | 'rare' | 'epic';
