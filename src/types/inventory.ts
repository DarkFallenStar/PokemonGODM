import type { PokemonBase, CapturedInstance, Move } from './pokemon';
import type { InventoryItemType } from './interaction';

export type { InventoryItemType };

export interface ConsumableItemMetadata {
  type: InventoryItemType;
  name: string;
  category: 'ball' | 'medicine';
  description: string;
  iconEmoji: string;
  badgeColor: string;
  healAmount?: number; // Poción: 20 PS, Superpoción: 50 PS
  reviveHealthPercentage?: number; // Revivir: 50% de PS Máximos
}

export interface InventoryItemView {
  itemType: InventoryItemType;
  quantity: number;
  metadata: ConsumableItemMetadata;
}

// Desglose analítico de estadísticas: Base vs. IVs
export interface PokemonStatBreakdown {
  statName: 'Ataque' | 'Defensa' | 'PS';
  baseValue: number;
  ivValue: number; // 0 a 15
  effectiveValue: number; // baseValue + ivValue
  maxPossibleEffective: number; // baseValue + 15
  ivPercentage: number; // (ivValue / 15) * 100
}

export interface AppraisalRating {
  totalIV: number; // 0 a 45
  overallPercentage: number; // (totalIV / 45) * 100
  stars: 0 | 1 | 2 | 3;
  isPerfect: boolean; // totalIV === 45 (100% IVs)
  summaryText: string;
  badgeColor: string;
}

// Instancia enriquecida para visualización en Pokédex / Mochila
export interface EnrichedCapturedPokemon extends CapturedInstance {
  base: PokemonBase;
  fastMove: Move;
  chargedMove: Move;
  stats: {
    attack: PokemonStatBreakdown;
    defense: PokemonStatBreakdown;
    hp: PokemonStatBreakdown;
  };
  maxHp: number;
  appraisal: AppraisalRating;
}
