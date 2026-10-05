import { supabase } from './supabase';
import type { PokestopRewardItem } from '../types/interaction';
import type {
  InventoryItemType,
  InventoryItemView,
  ConsumableItemMetadata,
  EnrichedCapturedPokemon,
  AppraisalRating,
} from '../types/inventory';
import type { Move, PokemonBase } from '../types/pokemon';

export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

export const CONSUMABLE_METADATA_MAP: Record<InventoryItemType, ConsumableItemMetadata> = {
  pokeball: {
    type: 'pokeball',
    name: 'Pokéball',
    category: 'ball',
    description: 'Dispositivo esférico estándar para capturar criaturas salvajes.',
    iconEmoji: '🔴',
    badgeColor: '#EF4444',
  },
  greatball: {
    type: 'greatball',
    name: 'Superball',
    category: 'ball',
    description: 'Cápsula de alta precisión con tasa de éxito incrementada (+50%).',
    iconEmoji: '🔵',
    badgeColor: '#3B82F6',
  },
  ultraball: {
    type: 'ultraball',
    name: 'Ultraball',
    category: 'ball',
    description: 'Cápsula ultra resistente diseñada para criaturas esquivas (+100%).',
    iconEmoji: '🟡',
    badgeColor: '#EAB308',
  },
  potion: {
    type: 'potion',
    name: 'Poción',
    category: 'medicine',
    description: 'Medicina tipo aerosol que restaura 20 PS a un Pokémon herido.',
    iconEmoji: '🧪',
    badgeColor: '#A855F7',
    healAmount: 20,
  },
  superpotion: {
    type: 'superpotion',
    name: 'Superpoción',
    category: 'medicine',
    description: 'Medicina avanzada que restaura 50 PS a un Pokémon herido.',
    iconEmoji: '💊',
    badgeColor: '#EC4899',
    healAmount: 50,
  },
  revive: {
    type: 'revive',
    name: 'Revivir',
    category: 'medicine',
    description: 'Reanima a un Pokémon debilitado (0 PS) y recupera el 50% de sus PS máximos.',
    iconEmoji: '💎',
    badgeColor: '#F59E0B',
    reviveHealthPercentage: 0.5,
  },
};

const REWARD_TABLE: {
  type: InventoryItemType;
  label: string;
  emoji: string;
  weight: number;
}[] = [
  { type: 'pokeball', label: 'Pokéball', emoji: '🔴', weight: 45 },
  { type: 'greatball', label: 'Superball', emoji: '🔵', weight: 20 },
  { type: 'ultraball', label: 'Ultraball', emoji: '🟡', weight: 10 },
  { type: 'potion', label: 'Poción', emoji: '🧪', weight: 15 },
  { type: 'superpotion', label: 'Superpoción', emoji: '💊', weight: 7 },
  { type: 'revive', label: 'Revivir', emoji: '💎', weight: 3 },
];

/**
 * Genera entre 2 y 4 objetos aleatorios ponderados por probabilidad
 * al girar una Poképarada.
 */
export function generatePokestopRewards(): PokestopRewardItem[] {
  const count = Math.floor(Math.random() * 3) + 2; // 2 a 4 items
  const rewardsMap = new Map<InventoryItemType, PokestopRewardItem>();

  const totalWeight = REWARD_TABLE.reduce((sum, item) => sum + item.weight, 0);

  for (let i = 0; i < count; i++) {
    const roll = Math.random() * totalWeight;
    let accumulated = 0;
    let selected = REWARD_TABLE[0];

    for (const item of REWARD_TABLE) {
      accumulated += item.weight;
      if (roll <= accumulated) {
        selected = item;
        break;
      }
    }

    if (rewardsMap.has(selected.type)) {
      const existing = rewardsMap.get(selected.type)!;
      existing.quantity += 1;
    } else {
      rewardsMap.set(selected.type, {
        item_type: selected.type,
        quantity: 1,
        label: selected.label,
        emoji: selected.emoji,
      });
    }
  }

  return Array.from(rewardsMap.values());
}

/**
 * Consulta el inventario actual del usuario en Supabase (Mapa plano de cantidades)
 */
export async function fetchUserInventory(
  userId: string = DEMO_USER_ID
): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabase
      .from('user_inventory')
      .select('item_type, quantity')
      .eq('user_id', userId);

    if (error) {
      console.warn('Error consultando inventario:', error.message);
      return {};
    }

    const inventory: Record<string, number> = {};
    if (data) {
      for (const row of data) {
        inventory[row.item_type] = row.quantity;
      }
    }
    return inventory;
  } catch (err) {
    console.warn('Fallo de red consultando inventario:', err);
    return {};
  }
}

/**
 * Consulta detallada de todos los consumibles para la vista de la Mochila
 */
export async function fetchInventoryItemsDetailed(
  userId: string = DEMO_USER_ID
): Promise<InventoryItemView[]> {
  const rawInventory = await fetchUserInventory(userId);

  const itemTypes: InventoryItemType[] = [
    'pokeball',
    'greatball',
    'ultraball',
    'potion',
    'superpotion',
    'revive',
  ];

  return itemTypes.map(type => ({
    itemType: type,
    quantity: rawInventory[type] || 0,
    metadata: CONSUMABLE_METADATA_MAP[type],
  }));
}

/**
 * Agrega los objetos entregados por la Poképarada al inventario en Supabase
 */
export async function addItemsToInventory(
  rewards: PokestopRewardItem[],
  userId: string = DEMO_USER_ID
): Promise<boolean> {
  try {
    const current = await fetchUserInventory(userId);

    const updates = rewards.map(r => ({
      user_id: userId,
      item_type: r.item_type,
      quantity: (current[r.item_type] || 0) + r.quantity,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('user_inventory')
      .upsert(updates, { onConflict: 'user_id,item_type' });

    if (error) {
      console.warn('Error actualizando inventario en Supabase:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('Excepción al persistir items en inventario:', err);
    return false;
  }
}

/**
 * Calcula la valoración de estrellas (Appraisal) a partir de los 3 IVs individuales (0-15)
 */
export function calculateAppraisal(ivAttack: number, ivDefense: number, ivHp: number): AppraisalRating {
  const totalIV = Math.max(0, Math.min(45, (ivAttack || 0) + (ivDefense || 0) + (ivHp || 0)));
  const overallPercentage = Math.round((totalIV / 45) * 100);

  if (totalIV === 45) {
    return {
      totalIV,
      overallPercentage: 100,
      stars: 3,
      isPerfect: true,
      summaryText: '¡100% Perfecto (Hundo)! Estadísticas genéticas legendarias.',
      badgeColor: '#EC4899', // Pink / Magenta brillante
    };
  }

  if (overallPercentage >= 82) {
    return {
      totalIV,
      overallPercentage,
      stars: 3,
      isPerfect: false,
      summaryText: '¡Maravilloso! Ejemplar sobresaliente para combate.',
      badgeColor: '#EAB308', // Dorado
    };
  }

  if (overallPercentage >= 66) {
    return {
      totalIV,
      overallPercentage,
      stars: 2,
      isPerfect: false,
      summaryText: 'Excelente potencial. Por encima del promedio.',
      badgeColor: '#94A3B8', // Plata
    };
  }

  if (overallPercentage >= 50) {
    return {
      totalIV,
      overallPercentage,
      stars: 1,
      isPerfect: false,
      summaryText: 'Estadísticas aceptables para entrenamiento.',
      badgeColor: '#D97706', // Bronce
    };
  }

  return {
    totalIV,
    overallPercentage,
    stars: 0,
    isPerfect: false,
    summaryText: 'Estadísticas bajas. Puede mejorar con entrenamiento.',
    badgeColor: '#64748B', // Pizarra
  };
}

/**
 * Movimientos por defecto en caso de registros incompletos
 */
const DEFAULT_FAST_MOVE: Move = {
  id: 1,
  name: 'Tackle',
  type_id: 1,
  category: 'fast',
  power: 5,
  energy_delta: 5,
  duration_ms: 500,
};

const DEFAULT_CHARGED_MOVE: Move = {
  id: 4,
  name: 'Body Slam',
  type_id: 1,
  category: 'charged',
  power: 50,
  energy_delta: -33,
  duration_ms: 1900,
};

/**
 * Consulta la colección completa de criaturas capturadas del usuario,
 * enriquecida con estadísticas base, IVs individuales, movimientos y appraisal.
 */
export async function fetchCapturedPokemonCollection(
  userId: string = DEMO_USER_ID
): Promise<EnrichedCapturedPokemon[]> {
  try {
    const { data, error } = await supabase
      .from('captured_instances')
      .select(`
        id,
        user_id,
        pokemon_id,
        iv_attack,
        iv_defense,
        iv_hp,
        cp,
        current_hp,
        nickname,
        ball_used,
        fast_move_id,
        charged_move_id,
        captured_at,
        pokemon_base:pokemon_base (*),
        fast_move:moves!fast_move_id (*),
        charged_move:moves!charged_move_id (*)
      `)
      .eq('user_id', userId)
      .order('captured_at', { ascending: false });

    if (error) {
      console.warn('Error consultando colección de capturas:', error.message);
      return [];
    }

    if (!data) return [];

    return data.map((row: any): EnrichedCapturedPokemon => {
      const base: PokemonBase = row.pokemon_base || {
        id: row.pokemon_id,
        name: `Pokémon #${row.pokemon_id}`,
        type_primary_id: 1,
        type_secondary_id: null,
        base_hp: 50,
        base_attack: 50,
        base_defense: 50,
        base_sp_attack: 50,
        base_sp_defense: 50,
        base_speed: 50,
        base_cp: row.cp,
        base_catch_rate: 0.2,
        sprite_url: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${row.pokemon_id}.png`,
      };

      const ivAttack = row.iv_attack ?? 8;
      const ivDefense = row.iv_defense ?? 8;
      const ivHp = row.iv_hp ?? 8;

      const maxHp = (base.base_hp * 2) + ivHp + 50;
      const currentHp = row.current_hp !== null && row.current_hp !== undefined
        ? Math.min(row.current_hp, maxHp)
        : maxHp;

      const fastMove: Move = row.fast_move || DEFAULT_FAST_MOVE;
      const chargedMove: Move = row.charged_move || DEFAULT_CHARGED_MOVE;

      return {
        id: row.id,
        user_id: row.user_id,
        pokemon_id: row.pokemon_id,
        cp: row.cp,
        current_hp: currentHp,
        iv_attack: ivAttack,
        iv_defense: ivDefense,
        iv_hp: ivHp,
        nickname: row.nickname || null,
        ball_used: row.ball_used || null,
        fast_move_id: row.fast_move_id,
        charged_move_id: row.charged_move_id,
        captured_at: row.captured_at,
        base,
        fastMove,
        chargedMove,
        maxHp,
        stats: {
          attack: {
            statName: 'Ataque',
            baseValue: base.base_attack,
            ivValue: ivAttack,
            effectiveValue: base.base_attack + ivAttack,
            maxPossibleEffective: base.base_attack + 15,
            ivPercentage: Math.round((ivAttack / 15) * 100),
          },
          defense: {
            statName: 'Defensa',
            baseValue: base.base_defense,
            ivValue: ivDefense,
            effectiveValue: base.base_defense + ivDefense,
            maxPossibleEffective: base.base_defense + 15,
            ivPercentage: Math.round((ivDefense / 15) * 100),
          },
          hp: {
            statName: 'PS',
            baseValue: base.base_hp,
            ivValue: ivHp,
            effectiveValue: maxHp,
            maxPossibleEffective: (base.base_hp * 2) + 15 + 50,
            ivPercentage: Math.round((ivHp / 15) * 100),
          },
        },
        appraisal: calculateAppraisal(ivAttack, ivDefense, ivHp),
      };
    });
  } catch (err) {
    console.warn('Excepción consultando colección de Pokémon:', err);
    return [];
  }
}

/**
 * Aplica una poción o revivir a una criatura capturada mediante la RPC de PostgreSQL
 */
export async function applyMedicineToPokemon(
  instanceId: string,
  itemType: 'potion' | 'superpotion' | 'revive',
  userId: string = DEMO_USER_ID
): Promise<{ success: boolean; newHp?: number; maxHp?: number; remainingQuantity?: number; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('apply_item_to_pokemon', {
      p_user_id: userId,
      p_instance_id: instanceId,
      p_item_type: itemType,
    });

    if (error) {
      console.warn('Error en RPC apply_item_to_pokemon:', error.message);
      return { success: false, error: error.message };
    }

    if (data && typeof data === 'object') {
      return {
        success: !!data.success,
        newHp: data.new_hp,
        maxHp: data.max_hp,
        remainingQuantity: data.remaining_quantity,
        error: data.error,
      };
    }

    return { success: false, error: 'Respuesta inválida del servidor.' };
  } catch (err: any) {
    console.warn('Excepción aplicando medicina:', err);
    return { success: false, error: err?.message || 'Error de conexión.' };
  }
}

/**
 * Cooldown de Poképaradas
 */
export async function checkPokestopCooldown(
  pokestopId: string,
  userId: string = DEMO_USER_ID
): Promise<{ canSpin: boolean; remainingSeconds: number }> {
  try {
    const { data, error } = await supabase
      .from('user_pokestop_cooldowns')
      .select('last_spun_at')
      .eq('user_id', userId)
      .eq('pokestop_id', pokestopId)
      .maybeSingle();

    if (error || !data) {
      return { canSpin: true, remainingSeconds: 0 };
    }

    const lastSpunTime = new Date(data.last_spun_at).getTime();
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - lastSpunTime) / 1000);
    const cooldownSeconds = 300; // 5 minutos

    if (elapsedSeconds >= cooldownSeconds) {
      return { canSpin: true, remainingSeconds: 0 };
    }

    return {
      canSpin: false,
      remainingSeconds: cooldownSeconds - elapsedSeconds,
    };
  } catch (err) {
    return { canSpin: true, remainingSeconds: 0 };
  }
}

export async function recordPokestopSpin(
  pokestopId: string,
  userId: string = DEMO_USER_ID
): Promise<boolean> {
  try {
    const { error } = await supabase.from('user_pokestop_cooldowns').upsert(
      {
        user_id: userId,
        pokestop_id: pokestopId,
        last_spun_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,pokestop_id' }
    );

    return !error;
  } catch (err) {
    console.warn('Error registrando cooldown de Poképarada:', err);
    return false;
  }
}

/**
 * Actualiza la salud (PS) actual de una criatura tras combate o daño.
 */
export async function updatePokemonHealth(
  instanceId: string,
  newHp: number
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('captured_instances')
      .update({ current_hp: Math.max(0, Math.floor(newHp)) })
      .eq('id', instanceId);

    if (error) {
      console.warn('Error actualizando PS de criatura:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Excepción en updatePokemonHealth:', err);
    return false;
  }
}

/**
 * Transfiere (elimina) un Pokémon de la colección hacia el Profesor Oak de forma atómica.
 * Valida que la criatura no se encuentre actualmente asignada como defensor en un gimnasio.
 */
export async function transferPokemonInstance(
  instanceId: string,
  userId: string = DEMO_USER_ID
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // 1. Intentar mediante la función almacenada transaccional en PostgreSQL
    const { data, error } = await supabase.rpc('transfer_pokemon_instance', {
      p_user_id: userId,
      p_instance_id: instanceId,
    });

    if (!error && data && typeof data === 'object') {
      return {
        success: !!data.success,
        message: data.message || 'Pokémon transferido al Profesor.',
        error: data.error,
      };
    }

    // 2. Fallback: verificación defensiva y eliminación directa
    const { data: gymDef } = await supabase
      .from('gymnasiums')
      .select('name')
      .eq('defending_instance_id', instanceId)
      .maybeSingle();

    if (gymDef) {
      return {
        success: false,
        error: `No puedes transferir a este Pokémon porque está defendiendo el ${gymDef.name}.`,
      };
    }

    const { error: deleteError } = await supabase
      .from('captured_instances')
      .delete()
      .eq('id', instanceId)
      .eq('user_id', userId);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    return { success: true, message: 'Pokémon transferido al Profesor con éxito.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error de red al transferir Pokémon.' };
  }
}
