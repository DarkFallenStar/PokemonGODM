import { supabase } from './supabase';
import type { Coordinate } from '../types/map';
import type { ActiveSpawn } from '../types/spawns';
import { calculateHaversineDistanceWorklet } from '../utils/haversine';
import {
  UNISABANA_POLYGON,
  HOME_CAJICA_POLYGON,
  CAMPUS_CENTER_COORDINATE,
  HOME_CAJICA_CENTER,
  isPointInPolygonWorklet,
} from '../utils/geofence';
import { getPokemonDbAnimatedSprite, getPokemonDbStaticSprite } from '../utils/pokemonAssets';

// Distribución oficial de los 151 Pokémon de Kanto según niveles de rareza
export const RARITY_POKEMON_IDS = {
  // Comunes (60% de probabilidad): 49 especies básicas habituales
  common: [
    1, 4, 7, 10, 11, 13, 14, 16, 19, 21, 23, 25, 27, 29, 32, 41, 43, 46, 48, 50,
    52, 54, 56, 60, 63, 66, 69, 72, 74, 77, 79, 81, 83, 84, 86, 88, 90, 92, 96, 98,
    100, 102, 104, 109, 111, 116, 118, 120, 129
  ],
  // Poco Comunes (25% de probabilidad): 54 especies intermedias y básicos destacados
  uncommon: [
    2, 5, 8, 12, 15, 17, 20, 22, 24, 28, 30, 33, 35, 37, 39, 42, 44, 47, 49, 51,
    53, 55, 57, 58, 61, 64, 67, 70, 73, 75, 78, 82, 85, 87, 93, 95, 97, 99, 101, 105,
    106, 107, 108, 114, 117, 119, 121, 122, 124, 132, 133, 138, 140, 147
  ],
  // Raros (12% de probabilidad): 42 terceras evoluciones y Pokémon únicos poderosos
  rare: [
    3, 6, 9, 18, 26, 31, 34, 36, 38, 40, 45, 59, 62, 65, 68, 71, 76, 80, 89, 91,
    94, 103, 110, 112, 113, 115, 123, 125, 126, 127, 128, 130, 131, 134, 135, 136, 137, 139, 141, 142, 143, 148
  ],
  // Épicos / Legendarios (3% de probabilidad): 6 criaturas míticas y legendarias
  epic: [
    144, 145, 146, 149, 150, 151
  ],
};

/**
 * Selecciona un ID de Pokémon basado en la distribución de probabilidad reglamentaria:
 * Común 60%, Poco Común 25%, Raro 12%, Épico 3%
 */
function pickRandomPokemonId(): number {
  const roll = Math.random();
  let pool: number[];

  if (roll < 0.60) {
    pool = RARITY_POKEMON_IDS.common;
  } else if (roll < 0.85) {
    pool = RARITY_POKEMON_IDS.uncommon;
  } else if (roll < 0.97) {
    pool = RARITY_POKEMON_IDS.rare;
  } else {
    pool = RARITY_POKEMON_IDS.epic;
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Genera una coordenada aleatoria garantizada dentro de un polígono delimitado
 */
function getRandomCoordinateInPolygon(
  polygon: Coordinate[],
  fallbackCenter: Coordinate
): Coordinate {
  let minLat = 90,
    maxLat = -90,
    minLon = 180,
    maxLon = -180;

  for (const p of polygon) {
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
    if (p.longitude < minLon) minLon = p.longitude;
    if (p.longitude > maxLon) maxLon = p.longitude;
  }

  // Hasta 15 intentos de muestreo por rechazo (Rejection Sampling)
  for (let i = 0; i < 15; i++) {
    const lat = minLat + Math.random() * (maxLat - minLat);
    const lon = minLon + Math.random() * (maxLon - minLon);
    const candidate: Coordinate = { latitude: lat, longitude: lon };

    if (isPointInPolygonWorklet(candidate, polygon)) {
      return candidate;
    }
  }

  // Fallback con jitter suave de 20 metros si el muestreo no converge
  const jitterLat = (Math.random() - 0.5) * 0.0003;
  const jitterLon = (Math.random() - 0.5) * 0.0003;
  return {
    latitude: fallbackCenter.latitude + jitterLat,
    longitude: fallbackCenter.longitude + jitterLon,
  };
}

/**
 * Calcula los Puntos de Combate (CP) con la fórmula matemática oficial
 */
function calculateCombatPower(
  baseAtk: number,
  baseDef: number,
  baseHp: number,
  ivAtk: number,
  ivDef: number,
  ivHp: number
): number {
  const atk = baseAtk + ivAtk;
  const def = baseDef + ivDef;
  const hp = baseHp + ivHp;
  const cpCalc = Math.floor((atk * Math.sqrt(def) * Math.sqrt(hp)) / 10);
  return Math.max(10, cpCalc);
}

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Genera spawns salvajes en Supabase si el número de criaturas activas es bajo
 */
export async function seedWildSpawnsIfLow(
  isTestZone: boolean,
  userId: string = DEMO_USER_ID
): Promise<void> {
  try {
    const nowIso = new Date().toISOString();

    // 0. Recolector de basura: purgar criaturas caducadas por TTL (10-15 minutos)
    await supabase.rpc('purge_expired_spawns');

    // 1. Contar spawns vigentes no caducados disponibles para este entrenador
    let query = supabase
      .from('active_spawns')
      .select('id')
      .gt('expires_at', nowIso);

    if (!isTestZone) {
      query = query.eq('is_test_zone', false);
    }

    const [spawnsRes, interactionsRes] = await Promise.all([
      query,
      supabase
        .from('user_spawn_interactions')
        .select('spawn_id')
        .eq('user_id', userId),
    ]);

    if (spawnsRes.error || !spawnsRes.data) {
      return;
    }

    const interactedIds = new Set((interactionsRes.data || []).map(i => i.spawn_id));
    const availableForUser = spawnsRes.data.filter(s => !interactedIds.has(s.id));

    // Mantener un mínimo de 6 criaturas simultáneas disponibles para el entrenador en el campus
    const currentActive = availableForUser.length;
    if (currentActive >= 6) {
      return;
    }

    const needed = 6 - currentActive;
    const newSpawns: any[] = [];

    // Cargar estadísticas base de los Pokémon disponibles
    const { data: baseList } = await supabase
      .from('pokemon_base')
      .select('id, base_attack, base_defense, base_hp');

    if (!baseList || baseList.length === 0) return;
    const baseMap = new Map<number, any>(baseList.map(b => [b.id, b]));

    for (let i = 0; i < needed; i++) {
      const pokemonId = pickRandomPokemonId();
      const baseStats = baseMap.get(pokemonId) || {
        base_attack: 100,
        base_defense: 100,
        base_hp: 100,
      };

      const ivAtk = Math.floor(Math.random() * 16);
      const ivDef = Math.floor(Math.random() * 16);
      const ivHp = Math.floor(Math.random() * 16);
      const cp = calculateCombatPower(
        baseStats.base_attack,
        baseStats.base_defense,
        baseStats.base_hp,
        ivAtk,
        ivDef,
        ivHp
      );

      // Decidir zona de spawn
      const inCajica = isTestZone && Math.random() > 0.4;
      const coords = inCajica
        ? getRandomCoordinateInPolygon(HOME_CAJICA_POLYGON, HOME_CAJICA_CENTER)
        : getRandomCoordinateInPolygon(UNISABANA_POLYGON, CAMPUS_CENTER_COORDINATE);

      // TTL de 10 a 15 minutos (600 a 900 segundos)
      const ttlMinutes = 10 + Math.floor(Math.random() * 6);
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

      newSpawns.push({
        pokemon_id: pokemonId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        is_test_zone: inCajica,
        spawned_at: nowIso,
        expires_at: expiresAt,
        iv_attack: ivAtk,
        iv_defense: ivDef,
        iv_hp: ivHp,
        cp,
        is_active: true,
      });
    }

    if (newSpawns.length > 0) {
      await supabase.from('active_spawns').insert(newSpawns);
    }
  } catch (err) {
    console.warn('Error sembrando criaturas salvajes:', err);
  }
}

/**
 * Consulta las criaturas salvajes activas en el mundo y filtra aquellas
 * con las que el entrenador actual ya interactuó (capturó o huyeron).
 * Evalúa proximidad a 30 metros del entrenador.
 */
export async function fetchNearbySpawns(
  userCoords: Coordinate,
  isTestZone: boolean,
  userId: string = DEMO_USER_ID
): Promise<ActiveSpawn[]> {
  try {
    const nowIso = new Date().toISOString();

    // 1. Spawns activos en el mundo no caducados
    let query = supabase
      .from('active_spawns')
      .select(`
        id,
        pokemon_id,
        latitude,
        longitude,
        is_test_zone,
        spawned_at,
        expires_at,
        iv_attack,
        iv_defense,
        iv_hp,
        cp,
        is_active,
        pokemon_base:pokemon_id (
          id,
          name,
          sprite_url,
          animation_url,
          base_attack,
          base_defense,
          base_hp
        )
      `)
      .gt('expires_at', nowIso);

    if (!isTestZone) {
      query = query.eq('is_test_zone', false);
    }

    const [spawnsRes, interactionsRes] = await Promise.all([
      query,
      supabase
        .from('user_spawn_interactions')
        .select('spawn_id')
        .eq('user_id', userId),
    ]);

    if (spawnsRes.error || !spawnsRes.data) {
      return [];
    }

    const interactedIds = new Set((interactionsRes.data || []).map(i => i.spawn_id));
    const result: ActiveSpawn[] = [];

    for (const item of spawnsRes.data) {
      // Si el usuario ya atrapó esta criatura o ya le huyó, no se renderiza en su cliente
      if (interactedIds.has(item.id)) {
        continue;
      }
      const spawnCoord: Coordinate = {
        latitude: item.latitude,
        longitude: item.longitude,
      };

      // Cálculo geodésico de alta precisión con Worklet de Haversine
      const distance = calculateHaversineDistanceWorklet(userCoords, spawnCoord);

      result.push({
        id: item.id,
        pokemon_id: item.pokemon_id,
        latitude: item.latitude,
        longitude: item.longitude,
        is_test_zone: item.is_test_zone,
        spawned_at: item.spawned_at,
        expires_at: item.expires_at,
        iv_attack: item.iv_attack,
        iv_defense: item.iv_defense,
        iv_hp: item.iv_hp,
        cp: item.cp,
        is_active: item.is_active,
        pokemon: item.pokemon_base as any,
        distance_meters: Math.round(distance),
        // REGLA ESTRICTA: Solo visible si está a 30 metros o menos del jugador
        is_in_range: distance <= 30,
      });
    }

    return result;
  } catch (err) {
    console.warn('Error consultando spawns cercanos:', err);
    return [];
  }
}

/**
 * Genera una criatura salvaje inmediatamente cerca del jugador (entre 8 y 16 metros)
 * para pruebas y debug en vivo sin requerir desplazamiento físico.
 */
export async function spawnPokemonNearPlayer(
  userCoords: Coordinate,
  isTestZone: boolean
): Promise<ActiveSpawn | null> {
  try {
    const pokemonId = pickRandomPokemonId();

    const { data: baseList } = await supabase
      .from('pokemon_base')
      .select('id, name, sprite_url, animation_url, base_attack, base_defense, base_hp')
      .eq('id', pokemonId)
      .limit(1);

    const baseStats =
      baseList && baseList[0]
        ? baseList[0]
        : {
            id: pokemonId,
            name: 'Pikachu',
            sprite_url: getPokemonDbStaticSprite('pikachu', 25),
            animation_url: getPokemonDbAnimatedSprite('pikachu', 25),
            base_attack: 112,
            base_defense: 96,
            base_hp: 111,
          };

    const ivAtk = Math.floor(Math.random() * 16);
    const ivDef = Math.floor(Math.random() * 16);
    const ivHp = Math.floor(Math.random() * 16);
    const cp = calculateCombatPower(
      baseStats.base_attack,
      baseStats.base_defense,
      baseStats.base_hp,
      ivAtk,
      ivDef,
      ivHp
    );

    // Desplazamiento garantizado entre 8 y 16 metros (dentro del radio visual de 30m)
    const distanceMeters = 8 + Math.random() * 8;
    const angleRad = Math.random() * 2 * Math.PI;

    const deltaLat = (distanceMeters * Math.cos(angleRad)) / 111139;
    const deltaLon =
      (distanceMeters * Math.sin(angleRad)) /
      (111139 * Math.cos((userCoords.latitude * Math.PI) / 180));

    const spawnLat = userCoords.latitude + deltaLat;
    const spawnLon = userCoords.longitude + deltaLon;

    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutos

    // Purgar cualquier spawn vencido previo
    await supabase
      .from('active_spawns')
      .delete()
      .or(`expires_at.lt.${nowIso},is_active.eq.false`);

    const newSpawnPayload = {
      pokemon_id: pokemonId,
      latitude: spawnLat,
      longitude: spawnLon,
      is_test_zone: isTestZone,
      spawned_at: nowIso,
      expires_at: expiresAt,
      iv_attack: ivAtk,
      iv_defense: ivDef,
      iv_hp: ivHp,
      cp,
      is_active: true,
    };

    const { data: inserted, error } = await supabase
      .from('active_spawns')
      .insert([newSpawnPayload])
      .select()
      .single();

    if (error || !inserted) {
      console.warn('Error insertando spawn de debug en Supabase:', error);
      return null;
    }

    const distActual = Math.round(
      calculateHaversineDistanceWorklet(userCoords, { latitude: spawnLat, longitude: spawnLon })
    );

    return {
      id: inserted.id,
      pokemon_id: inserted.pokemon_id,
      latitude: inserted.latitude,
      longitude: inserted.longitude,
      is_test_zone: inserted.is_test_zone,
      spawned_at: inserted.spawned_at,
      expires_at: inserted.expires_at,
      iv_attack: inserted.iv_attack,
      iv_defense: inserted.iv_defense,
      iv_hp: inserted.iv_hp,
      cp: inserted.cp,
      is_active: inserted.is_active,
      pokemon: baseStats as any,
      distance_meters: distActual,
      is_in_range: true, // Garantizado <= 30m
    };
  } catch (err) {
    console.warn('Error en spawnPokemonNearPlayer:', err);
    return null;
  }
}
