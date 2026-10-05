import { supabase } from './supabase';
import { DEMO_USER_ID } from './inventoryService';
import type { TrainerTeam } from '../types/battle';
import type { TrainerProfile } from '../types/inventory';

let cachedProfile: TrainerProfile = {
  userId: DEMO_USER_ID,
  team: 'mystic',
  trainerName: 'Entrenador UniSabana',
  updatedAt: new Date().toISOString(),
};

/**
 * Consulta el perfil del entrenador desde Supabase con fallback a caché en memoria.
 */
export async function fetchTrainerProfile(
  userId: string = DEMO_USER_ID
): Promise<TrainerProfile> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('user_id, team, trainer_name, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Error consultando user_profiles:', error.message);
      return cachedProfile;
    }

    if (data) {
      cachedProfile = {
        userId: data.user_id,
        team: (data.team as TrainerTeam) || 'mystic',
        trainerName: data.trainer_name || 'Entrenador UniSabana',
        updatedAt: data.updated_at,
      };
    } else {
      // Si no existe, crear registro por defecto
      await supabase.from('user_profiles').upsert({
        user_id: userId,
        team: 'mystic',
        trainer_name: 'Entrenador UniSabana',
        updated_at: new Date().toISOString(),
      });
    }

    return cachedProfile;
  } catch (err) {
    console.warn('Excepción al obtener perfil del entrenador:', err);
    return cachedProfile;
  }
}

/**
 * Actualiza el equipo del entrenador en Supabase y actualiza la caché local.
 */
export async function updateTrainerTeam(
  newTeam: TrainerTeam,
  userId: string = DEMO_USER_ID
): Promise<{ success: boolean; error?: string }> {
  try {
    // Actualización optimista en memoria
    cachedProfile = {
      ...cachedProfile,
      team: newTeam,
      updatedAt: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        team: newTeam,
        trainer_name: cachedProfile.trainerName,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.warn('Error actualizando equipo en user_profiles:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.warn('Excepción al actualizar equipo:', err);
    return { success: false, error: err?.message || 'Error de red.' };
  }
}
