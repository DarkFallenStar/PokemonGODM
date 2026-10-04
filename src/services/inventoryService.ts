import { supabase } from './supabase';
import type { InventoryItemType, PokestopRewardItem } from '../types/interaction';

export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

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
 * Consulta el inventario actual del usuario en Supabase
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
 * Agrega los objetos entregados por la Poképarada al inventario en Supabase
 */
export async function addItemsToInventory(
  rewards: PokestopRewardItem[],
  userId: string = DEMO_USER_ID
): Promise<boolean> {
  try {
    // 1. Obtener cantidades actuales
    const current = await fetchUserInventory(userId);

    // 2. Preparar los upserts
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
 * Verifica el estado de enfriamiento (cooldown) de una Poképarada
 * Cooldown reglamentario: 300 segundos (5 minutos)
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

/**
 * Registra el giro de una Poképarada e inicia el temporizador de 5 minutos
 */
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
