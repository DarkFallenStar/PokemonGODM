export type InventoryItemType =
  | 'pokeball'
  | 'greatball'
  | 'ultraball'
  | 'potion'
  | 'superpotion'
  | 'revive';

export interface InventoryItem {
  id?: string;
  user_id: string;
  item_type: InventoryItemType;
  quantity: number;
}

export interface PokestopCooldown {
  pokestop_id: string;
  last_spun_at: string;
  remaining_seconds: number;
  can_spin: boolean;
}

export interface PokestopRewardItem {
  item_type: InventoryItemType;
  quantity: number;
  label: string;
  emoji: string;
}

export interface GymDetails {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  is_test_zone: boolean;
  current_team: 'mystic' | 'valor' | 'instinct' | 'neutral';
  interaction_radius_meters: number;
  defending_instance?: {
    pokemon_name: string;
    sprite_url: string;
    cp: number;
    current_hp: number;
    trainer_name?: string;
  } | null;
}
