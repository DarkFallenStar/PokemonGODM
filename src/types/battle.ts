import type { EnrichedCapturedPokemon } from './inventory';

// Estados de la máquina de combate
export type BattlePhase =
  | 'CONNECTING'      // Conectando al canal WebSocket
  | 'MATCHMAKING'     // Esperando rival presencial o activando bot AI
  | 'COUNTDOWN'       // Conteo inicial sincronizado (3, 2, 1, ¡LUCHA!)
  | 'ACTIVE_COMBAT'   // Intercambio táctil en tiempo real
  | 'FINISHED';       // Criatura derrotada / Reclamación de Gimnasio

// Rol del jugador en la arena
export type BattleRole = 'challenger' | 'defender';

// Equipos Oficiales de Entrenadores
export type TrainerTeam = 'mystic' | 'valor' | 'instinct';

export interface TeamMetadata {
  id: TrainerTeam;
  name: string;
  leader: string;
  badge: string;
  color: string;
  accentColor: string;
  motto: string;
}

export const TEAMS: Record<TrainerTeam, TeamMetadata> = {
  mystic: {
    id: 'mystic',
    name: 'Equipo Sabiduría (Místico)',
    leader: 'Blanche',
    badge: '🦅',
    color: '#2563EB',
    accentColor: '#93C5FD',
    motto: 'La sabiduría y el análisis guían la victoria.',
  },
  valor: {
    id: 'valor',
    name: 'Equipo Valor',
    leader: 'Candela',
    badge: '🔥',
    color: '#DC2626',
    accentColor: '#FCA5A5',
    motto: 'La fuerza y la pasión encienden nuestro espíritu.',
  },
  instinct: {
    id: 'instinct',
    name: 'Equipo Instinto',
    leader: 'Spark',
    badge: '⚡',
    color: '#CA8A04',
    accentColor: '#FDE047',
    motto: 'Confía en tu instinto e intuición para triunfar.',
  },
};

// Mensaje de Presencia en el Gimnasio
export interface BattlePresencePayload {
  userId: string;
  username: string;
  team: 'mystic' | 'valor' | 'instinct' | 'neutral';
  combatant: {
    instanceId: string;
    pokemonId: number;
    name: string;
    cp: number;
    currentHp: number;
    maxHp: number;
    spriteUrl: string;
    types: number[];
  };
  role: BattleRole;
  status: 'ready' | 'battling';
}

// Paquetes transmitidos por Supabase Broadcast en el canal 'gym:battle:<gym_id>'
export type BattleBroadcastEvent =
  | 'battle:handshake'
  | 'battle:fast_attack'
  | 'battle:charged_attack'
  | 'battle:dodge'
  | 'battle:hp_update'
  | 'battle:forfeit';

// Encabezado estándar para control de concurrencia y orden de llegada
export interface BattlePacketHeader {
  seqId: number;         // Número de secuencia monotónico creciente (1, 2, 3...)
  packetId: string;      // UUID para deduplicación estricta
  senderId: string;      // UUID del usuario emisor
  timestamp: number;     // Milisegundos epoch UTC
}

// Paquete: Handshake inicial con datos del Pokémon
export interface BattleHandshakePacket extends BattlePacketHeader {
  combatant: {
    instanceId: string;
    pokemonId: number;
    name: string;
    cp: number;
    currentHp: number;
    maxHp: number;
    spriteUrl: string;
    types: number[];
    fastMove: {
      id: number;
      name: string;
      power: number;
      energyDelta: number;
      typeId: number;
    };
    chargedMove: {
      id: number;
      name: string;
      power: number;
      energyDelta: number;
      typeId: number;
    };
  };
}

// Paquete: Ataque Rápido o Ataque Cargado
export interface BattleAttackPacket extends BattlePacketHeader {
  type: 'FAST_ATTACK' | 'CHARGED_ATTACK';
  moveId: number;
  moveName: string;
  moveTypeId: number;
  rawPower: number;
  attackerEffectiveAttack: number;
}

// Paquete: Esquiva
export interface BattleDodgePacket extends BattlePacketHeader {
  direction: 'left' | 'right';
  dodgeWindowMs: number; // 500 ms de duración
}

// Paquete: Actualización autoritativa de Salud (emitido por el receptor del daño)
export interface BattleHpUpdatePacket extends BattlePacketHeader {
  targetUserId: string;
  previousHp: number;
  newHp: number;
  damageTaken: number;
  wasDodged: boolean;       // true si la esquiva estaba activa (mitigación del 75%)
  typeMultiplier: number;   // 2.0x, 0.5x, 0.0x o 1.0x
  isFainted: boolean;
}

// Paquete: Rendición o Pérdida de Conexión
export interface BattleForfeitPacket extends BattlePacketHeader {
  reason: 'timeout' | 'surrender' | 'out_of_bounds';
}

// Modelo de estado de combate en memoria
export interface BattleParticipantState {
  userId: string;
  username: string;
  isAI: boolean;
  pokemon: EnrichedCapturedPokemon;
  currentHp: number;
  maxHp: number;
  energy: number; // 0 a 100
  isDodging: boolean;
  dodgeUntil: number; // timestamp UTC
}
