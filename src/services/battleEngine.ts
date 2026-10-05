import { supabase } from './supabase';
import type { EnrichedCapturedPokemon } from '../types/inventory';
import type { Move } from '../types/pokemon';

// Matriz de efectividad de tipos de Generación 1
// Multiplicadores: 2.0 (Súper eficaz), 0.5 (Poco eficaz), 0.0 (Inmune), 1.0 (Neutral)
export const TYPE_NAMES: Record<number, string> = {
  1: 'Normal',
  2: 'Fuego',
  3: 'Agua',
  4: 'Planta',
  5: 'Eléctrico',
  6: 'Hielo',
  7: 'Lucha',
  8: 'Veneno',
  9: 'Tierra',
  10: 'Volador',
  11: 'Psíquico',
  12: 'Bicho',
  13: 'Roca',
  14: 'Fantasma',
  15: 'Dragón',
};

export const TYPE_COLORS: Record<number, string> = {
  1: '#A8A77A', // Normal
  2: '#EE8130', // Fuego
  3: '#6390F0', // Agua
  4: '#7AC74C', // Planta
  5: '#F7D02C', // Eléctrico
  6: '#96D9D6', // Hielo
  7: '#C22E28', // Lucha
  8: '#A33EA1', // Veneno
  9: '#E2BF65', // Tierra
  10: '#A98FF3', // Volador
  11: '#F95587', // Psíquico
  12: '#A6B91A', // Bicho
  13: '#B6A136', // Roca
  14: '#735797', // Fantasma
  15: '#6F35FC', // Dragón
};

// Mapa de ventajas de daño (Atacante ID -> Defensor ID -> Multiplicador)
const TYPE_CHART: Record<number, Record<number, number>> = {
  1: { 13: 0.5, 14: 0.0 }, // Normal contra Roca, Fantasma
  2: { 2: 0.5, 3: 0.5, 4: 2.0, 6: 2.0, 12: 2.0, 13: 0.5, 15: 0.5 }, // Fuego
  3: { 2: 2.0, 3: 0.5, 4: 0.5, 9: 2.0, 13: 2.0, 15: 0.5 }, // Agua
  4: { 2: 0.5, 3: 2.0, 4: 0.5, 8: 0.5, 9: 2.0, 10: 0.5, 12: 0.5, 13: 2.0, 15: 0.5 }, // Planta
  5: { 3: 2.0, 4: 0.5, 5: 0.5, 9: 0.0, 10: 2.0, 15: 0.5 }, // Eléctrico
  6: { 2: 0.5, 3: 0.5, 4: 2.0, 6: 0.5, 9: 2.0, 10: 2.0, 15: 2.0 }, // Hielo
  7: { 1: 2.0, 6: 2.0, 8: 0.5, 10: 0.5, 11: 0.5, 12: 0.5, 13: 2.0, 14: 0.0 }, // Lucha
  8: { 4: 2.0, 8: 0.5, 9: 0.5, 13: 0.5, 14: 0.5 }, // Veneno
  9: { 2: 2.0, 5: 2.0, 4: 0.5, 8: 2.0, 10: 0.0, 12: 0.5, 13: 2.0 }, // Tierra
  10: { 4: 2.0, 5: 0.5, 7: 2.0, 12: 2.0, 13: 0.5 }, // Volador
  11: { 7: 2.0, 8: 2.0, 11: 0.5 }, // Psíquico
  12: { 2: 0.5, 4: 2.0, 7: 0.5, 8: 0.5, 10: 0.5, 11: 2.0, 14: 0.5 }, // Bicho
  13: { 2: 2.0, 6: 2.0, 7: 0.5, 9: 0.5, 10: 2.0, 12: 2.0 }, // Roca
  14: { 1: 0.0, 11: 2.0, 14: 2.0 }, // Fantasma
  15: { 15: 2.0 }, // Dragón
};

/**
 * Computa el multiplicador de efectividad elemental acumulada
 */
export function getTypeMultiplier(
  moveTypeId: number,
  defenderPrimaryTypeId: number,
  defenderSecondaryTypeId?: number | null
): number {
  const attackingMap = TYPE_CHART[moveTypeId] || {};
  let mult1 = attackingMap[defenderPrimaryTypeId];
  if (mult1 === undefined) mult1 = 1.0;

  let mult2 = 1.0;
  if (defenderSecondaryTypeId && defenderSecondaryTypeId !== defenderPrimaryTypeId) {
    const m = attackingMap[defenderSecondaryTypeId];
    if (m !== undefined) mult2 = m;
  }

  return mult1 * mult2;
}

/**
 * Verifica si aplica bonificación de ataque por mismo tipo (STAB = 1.2x)
 */
export function hasSTAB(
  moveTypeId: number,
  attackerPrimaryTypeId: number,
  attackerSecondaryTypeId?: number | null
): boolean {
  return (
    moveTypeId === attackerPrimaryTypeId ||
    (!!attackerSecondaryTypeId && moveTypeId === attackerSecondaryTypeId)
  );
}

export interface DamageCalculationParams {
  rawPower: number;
  attackerEffectiveAttack: number;
  defenderEffectiveDefense: number;
  moveTypeId: number;
  attackerPrimaryTypeId: number;
  attackerSecondaryTypeId?: number | null;
  defenderPrimaryTypeId: number;
  defenderSecondaryTypeId?: number | null;
  isDodging: boolean;
}

export interface DamageResult {
  finalDamage: number;
  baseDamage: number;
  typeMultiplier: number;
  wasDodged: boolean;
  isSuperEffective: boolean;
  isNotVeryEffective: boolean;
  isImmune: boolean;
}

/**
 * Fórmula de daño determinística y sincronizada:
 * Daño Base = Piso(0.5 * Potencia * (Ataque / Defensa) * STAB * MultiplicadorTipo) + 1
 * Si Esquiva activa: Daño Final = Max(1, Piso(Daño Base * 0.25)) [75% mitigado]
 */
export function calculateBattleDamage(params: DamageCalculationParams): DamageResult {
  const {
    rawPower,
    attackerEffectiveAttack,
    defenderEffectiveDefense,
    moveTypeId,
    attackerPrimaryTypeId,
    attackerSecondaryTypeId,
    defenderPrimaryTypeId,
    defenderSecondaryTypeId,
    isDodging,
  } = params;

  const typeMult = getTypeMultiplier(
    moveTypeId,
    defenderPrimaryTypeId,
    defenderSecondaryTypeId
  );

  const stab = hasSTAB(moveTypeId, attackerPrimaryTypeId, attackerSecondaryTypeId) ? 1.2 : 1.0;
  const attackDefRatio = attackerEffectiveAttack / Math.max(1, defenderEffectiveDefense);

  const baseDamage = Math.floor(0.5 * rawPower * attackDefRatio * stab * typeMult) + 1;

  let finalDamage = baseDamage;
  if (isDodging) {
    // 75% de reducción por esquiva
    finalDamage = Math.max(1, Math.floor(baseDamage * 0.25));
  }

  return {
    finalDamage,
    baseDamage,
    typeMultiplier: typeMult,
    wasDodged: isDodging,
    isSuperEffective: typeMult > 1.0,
    isNotVeryEffective: typeMult < 1.0 && typeMult > 0.0,
    isImmune: typeMult === 0.0,
  };
}

/**
 * Genera un combatiente bot defensor para el gimnasio en caso de entrenamiento en solitario
 */
export function createGymAIDefender(
  gymName: string,
  gymTeam: 'mystic' | 'valor' | 'instinct' | 'neutral'
): EnrichedCapturedPokemon {
  // Snorlax o Dragonite guardián del campus
  const isDragonite = gymName.includes('Portas') || gymName.includes('Biblioteca');
  const pokemonId = isDragonite ? 149 : 143; // Dragonite o Snorlax
  const name = isDragonite ? 'Dragonite Guardián' : 'Snorlax Defensor';
  const cp = isDragonite ? 2980 : 2750;
  const baseHp = isDragonite ? 91 : 160;
  const baseAttack = isDragonite ? 134 : 110;
  const baseDefense = isDragonite ? 95 : 65;
  const ivHp = 14;
  const ivAttack = 13;
  const ivDefense = 15;

  const maxHp = (baseHp * 2) + ivHp + 50;

  const fastMove: Move = isDragonite
    ? { id: 40, name: 'Dragon Breath', type_id: 15, category: 'fast', power: 6, energy_delta: 4, duration_ms: 500 }
    : { id: 1, name: 'Tackle', type_id: 1, category: 'fast', power: 5, energy_delta: 5, duration_ms: 500 };

  const chargedMove: Move = isDragonite
    ? { id: 41, name: 'Dragon Claw', type_id: 15, category: 'charged', power: 50, energy_delta: -33, duration_ms: 1700 }
    : { id: 4, name: 'Body Slam', type_id: 1, category: 'charged', power: 50, energy_delta: -33, duration_ms: 1900 };

  return {
    id: `ai-defender-${pokemonId}`,
    user_id: '00000000-0000-0000-0000-000000000099',
    pokemon_id: pokemonId,
    cp,
    current_hp: maxHp,
    iv_attack: ivAttack,
    iv_defense: ivDefense,
    iv_hp: ivHp,
    fast_move_id: fastMove.id,
    charged_move_id: chargedMove.id,
    captured_at: new Date().toISOString(),
    maxHp,
    base: {
      id: pokemonId,
      name,
      type_primary_id: isDragonite ? 15 : 1,
      type_secondary_id: isDragonite ? 10 : null,
      base_hp: baseHp,
      base_attack: baseAttack,
      base_defense: baseDefense,
      base_sp_attack: 100,
      base_sp_defense: 100,
      base_speed: 80,
      base_cp: cp,
      base_catch_rate: 0.1,
      sprite_url: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`,
      animation_url: `https://img.pokemondb.net/sprites/black-white/anim/normal/${isDragonite ? 'dragonite' : 'snorlax'}.gif`,
    },
    fastMove,
    chargedMove,
    stats: {
      attack: {
        statName: 'Ataque',
        baseValue: baseAttack,
        ivValue: ivAttack,
        effectiveValue: baseAttack + ivAttack,
        maxPossibleEffective: baseAttack + 15,
        ivPercentage: Math.round((ivAttack / 15) * 100),
      },
      defense: {
        statName: 'Defensa',
        baseValue: baseDefense,
        ivValue: ivDefense,
        effectiveValue: baseDefense + ivDefense,
        maxPossibleEffective: baseDefense + 15,
        ivPercentage: Math.round((ivDefense / 15) * 100),
      },
      hp: {
        statName: 'Salud (HP)',
        baseValue: baseHp,
        ivValue: ivHp,
        effectiveValue: maxHp,
        maxPossibleEffective: (baseHp * 2) + 15 + 50,
        ivPercentage: Math.round((ivHp / 15) * 100),
      },
    },
    appraisal: {
      totalIV: ivAttack + ivDefense + ivHp,
      overallPercentage: Math.round(((ivAttack + ivDefense + ivHp) / 45) * 100),
      stars: 3,
      isPerfect: false,
      summaryText: 'Líder de Gimnasio Defensor con alta resiliencia.',
      badgeColor: '#EAB308',
    },
  };
}

/**
 * Conquista final del gimnasio tras la victoria en el combate
 */
export async function claimGymnasiumVictory(
  gymId: string,
  winnerUserId: string,
  winnerTeam: 'mystic' | 'valor' | 'instinct',
  defendingInstanceId?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('finalize_gym_battle', {
      p_gym_id: gymId,
      p_winner_user_id: winnerUserId,
      p_winner_team: winnerTeam,
      p_new_defending_instance_id: defendingInstanceId || null,
    });

    if (error) {
      console.warn('Error en RPC finalize_gym_battle:', error.message);
      return { success: false, error: error.message };
    }

    if (data && typeof data === 'object') {
      return {
        success: !!data.success,
        message: data.message || 'Gimnasio reclamado.',
        error: data.error,
      };
    }

    return { success: false, error: 'Respuesta inválida del servidor.' };
  } catch (err: any) {
    console.warn('Excepción al reclamar gimnasio:', err);
    return { success: false, error: err?.message || 'Error de red.' };
  }
}
