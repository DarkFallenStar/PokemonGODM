export interface PokemonType {
  id: number;
  name: string;
  color_hex: string;
}

export interface TypeEffectiveness {
  attacking_type_id: number;
  defending_type_id: number;
  multiplier: number;
}

export interface Move {
  id: number;
  name: string;
  type_id: number;
  category: 'fast' | 'charged';
  power: number;
  energy_delta: number;
  duration_ms: number;
}

export interface PokemonBase {
  id: number;
  name: string;
  type_primary_id: number;
  type_secondary_id: number | null;
  base_hp: number;
  base_attack: number;
  base_defense: number;
  base_sp_attack: number;
  base_sp_defense: number;
  base_speed: number;
  base_cp: number;
  base_catch_rate: number;
  sprite_url: string;
  sprite_shiny_url?: string | null;
  animation_url?: string | null;
  animation_shiny_url?: string | null;
}

export interface UserInventory {
  id: string;
  user_id: string;
  item_type: 'pokeball' | 'greatball' | 'ultraball' | 'potion' | 'superpotion' | 'revive';
  quantity: number;
  updated_at: string;
}

export interface CapturedInstance {
  id: string;
  user_id: string;
  pokemon_id: number;
  iv_attack: number;
  iv_defense: number;
  iv_hp: number;
  cp: number;
  current_hp: number;
  fast_move_id?: number | null;
  charged_move_id?: number | null;
  captured_at: string;
  pokemon_base?: PokemonBase;
}

export interface PokeStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  interaction_radius_meters: number;
  cooldown_seconds: number;
}

export interface Gymnasium {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  interaction_radius_meters: number;
  current_team: 'mystic' | 'valor' | 'instinct' | 'neutral';
  defending_instance_id?: string | null;
  updated_at: string;
}
