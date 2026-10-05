export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface GymDefenderInfo {
  instance_id: string;
  nickname?: string | null;
  name: string;
  pokemon_id: number;
  cp: number;
  current_hp: number;
  max_hp: number;
  sprite_url: string;
  animation_url?: string | null;
  trainer_name?: string;
  types: number[];
  base_attack?: number;
  base_defense?: number;
  base_hp?: number;
  iv_attack?: number;
  iv_defense?: number;
  iv_hp?: number;
  fast_move_id?: number | null;
  charged_move_id?: number | null;
}

export interface CampusPOIMarker {
  id: string;
  name: string;
  type: 'pokestop' | 'gym';
  latitude: number;
  longitude: number;
  current_team?: 'mystic' | 'valor' | 'instinct' | 'neutral';
  defending_instance_id?: string | null;
  defender?: GymDefenderInfo | null;
}

export interface MapViewportState {
  userLocation: Coordinate | null;
  heading: number; // Grados azimut (0 - 360)
  isInsideGeofence: boolean;
  isLoadingGPS: boolean;
  gpsError: string | null;
  isMockedLocation: boolean;
}
