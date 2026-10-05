import { supabase } from './supabase';
import { DEMO_USER_ID, fetchUserInventory } from './inventoryService';
import type { BallType, BallInventoryCount, CaptureResultPayload } from '../types/capture';
import type { ActiveSpawn } from '../types/spawns';

/**
 * Consulta la cantidad disponible de cada tipo de Pokéball en el inventario.
 */
export async function getBallInventory(
  userId: string = DEMO_USER_ID
): Promise<BallInventoryCount> {
  try {
    const rawInv = await fetchUserInventory(userId);
    return {
      pokeball: Math.max(0, rawInv['pokeball'] ?? 50),
      greatball: Math.max(0, rawInv['greatball'] ?? 25),
      ultraball: Math.max(0, rawInv['ultraball'] ?? 10),
    };
  } catch (err) {
    console.warn('Fallo consultando inventario de Pokéballs:', err);
    return {
      pokeball: 50,
      greatball: 25,
      ultraball: 10,
    };
  }
}

/**
 * Descuenta 1 bola utilizada en el inventario del usuario en Supabase.
 */
export async function consumeBall(
  ballType: BallType,
  userId: string = DEMO_USER_ID
): Promise<boolean> {
  try {
    const { data: invRows } = await supabase
      .from('user_inventory')
      .select('quantity')
      .eq('user_id', userId)
      .eq('item_type', ballType)
      .maybeSingle();

    const currentQty = invRows?.quantity ?? 0;
    const newQty = Math.max(0, currentQty - 1);

    const { error } = await supabase.from('user_inventory').upsert(
      {
        user_id: userId,
        item_type: ballType,
        quantity: newQty,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,item_type' }
    );

    return !error;
  } catch (err) {
    console.warn('Error descontando bola del inventario:', err);
    return false;
  }
}

/**
 * Registra formalmente la captura del Pokémon en Supabase y desactiva el spawn.
 */
export async function recordSuccessfulCapture(
  spawn: ActiveSpawn,
  ballUsed: BallType,
  nickname?: string,
  userId: string = DEMO_USER_ID
): Promise<{ success: boolean; captureId?: string }> {
  try {
    const pokemonId = spawn.pokemon_id || spawn.pokemon?.id || 1;
    const pokemonName = spawn.pokemon?.name || 'Pokémon';
    const finalNickname = nickname?.trim() || pokemonName;

    // Intentar primero a través de la función SQL transaccional
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'execute_pokemon_capture',
      {
        p_user_id: userId,
        p_spawn_id: spawn.id,
        p_pokemon_id: pokemonId,
        p_cp: spawn.cp,
        p_iv_attack: spawn.iv_attack ?? 10,
        p_iv_defense: spawn.iv_defense ?? 10,
        p_iv_hp: spawn.iv_hp ?? 10,
        p_ball_used: ballUsed,
        p_nickname: finalNickname,
      }
    );

    if (!rpcError && rpcData) {
      return { success: true, captureId: rpcData };
    }

    // Fallback: Inserción directa en captured_instances
    const { data: insertData, error: insertError } = await supabase
      .from('captured_instances')
      .insert({
        user_id: userId,
        pokemon_id: pokemonId,
        cp: spawn.cp,
        current_hp: Math.max(10, Math.floor(spawn.cp / 10)),
        iv_attack: spawn.iv_attack ?? 10,
        iv_defense: spawn.iv_defense ?? 10,
        iv_hp: spawn.iv_hp ?? 10,
        nickname: finalNickname,
        ball_used: ballUsed,
      })
      .select('id')
      .single();

    if (insertError) {
      console.warn('Error en inserción fallback de captura:', insertError.message);
      return { success: false };
    }

    // Desactivar el spawn en active_spawns
    await supabase
      .from('active_spawns')
      .update({ is_active: false })
      .eq('id', spawn.id);

    return { success: true, captureId: insertData?.id };
  } catch (err) {
    console.warn('Excepción registrando captura:', err);
    return { success: false };
  }
}
