import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  BattlePresencePayload,
  BattleHandshakePacket,
  BattleAttackPacket,
  BattleDodgePacket,
  BattleHpUpdatePacket,
  BattleForfeitPacket,
} from '../types/battle';
import type { EnrichedCapturedPokemon } from '../types/inventory';

export interface BattleRealtimeCallbacks {
  onPeerPresenceSync?: (presences: BattlePresencePayload[]) => void;
  onPeerJoined?: (presence: BattlePresencePayload) => void;
  onPeerLeft?: (userId: string) => void;
  onHandshakeReceived?: (packet: BattleHandshakePacket) => void;
  onAttackReceived?: (packet: BattleAttackPacket) => void;
  onDodgeReceived?: (packet: BattleDodgePacket) => void;
  onHpUpdateReceived?: (packet: BattleHpUpdatePacket) => void;
  onForfeitReceived?: (packet: BattleForfeitPacket) => void;
}

export class BattleRealtimeManager {
  private channel: RealtimeChannel | null = null;
  private gymId: string;
  private userId: string;
  private seqCounter: number = 0;
  private processedPacketIds: Set<string> = new Set();
  private callbacks: BattleRealtimeCallbacks;

  constructor(gymId: string, userId: string, callbacks: BattleRealtimeCallbacks) {
    this.gymId = gymId;
    this.userId = userId;
    this.callbacks = callbacks;
  }

  /**
   * Conecta y suscribe al canal de WebSockets del gimnasio
   */
  public async connect(presenceData: BattlePresencePayload): Promise<boolean> {
    const channelName = `gym:battle:${this.gymId}`;

    this.channel = supabase.channel(channelName, {
      config: {
        broadcast: { ack: false, self: false },
        presence: { key: this.userId },
      },
    });

    // 1. Manejo de Presencia (Presence)
    this.channel
      .on('presence', { event: 'sync' }, () => {
        if (!this.channel) return;
        const state = this.channel.presenceState();
        const activePresences: BattlePresencePayload[] = [];

        Object.keys(state).forEach(key => {
          const list = state[key] as any[];
          if (list && list.length > 0) {
            // Filtrar presencia propia para detectar al oponente
            if (key !== this.userId) {
              activePresences.push(list[0] as BattlePresencePayload);
            }
          }
        });

        this.callbacks.onPeerPresenceSync?.(activePresences);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        if (newPresences && newPresences.length > 0) {
          const p = newPresences[0] as any;
          if (p.userId && p.userId !== this.userId) {
            this.callbacks.onPeerJoined?.(p as BattlePresencePayload);
          }
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        if (leftPresences && leftPresences.length > 0) {
          const p = leftPresences[0] as any;
          if (p.userId && p.userId !== this.userId) {
            this.callbacks.onPeerLeft?.(p.userId);
          }
        }
      });

    // 2. Manejo de Mensajes Broadcast de Baja Latencia
    this.channel
      .on('broadcast', { event: 'battle:handshake' }, ({ payload }) => {
        if (this.isDuplicateOrSelf(payload)) return;
        this.callbacks.onHandshakeReceived?.(payload as BattleHandshakePacket);
      })
      .on('broadcast', { event: 'battle:fast_attack' }, ({ payload }) => {
        if (this.isDuplicateOrSelf(payload)) return;
        this.callbacks.onAttackReceived?.(payload as BattleAttackPacket);
      })
      .on('broadcast', { event: 'battle:charged_attack' }, ({ payload }) => {
        if (this.isDuplicateOrSelf(payload)) return;
        this.callbacks.onAttackReceived?.(payload as BattleAttackPacket);
      })
      .on('broadcast', { event: 'battle:dodge' }, ({ payload }) => {
        if (this.isDuplicateOrSelf(payload)) return;
        this.callbacks.onDodgeReceived?.(payload as BattleDodgePacket);
      })
      .on('broadcast', { event: 'battle:hp_update' }, ({ payload }) => {
        if (this.isDuplicateOrSelf(payload)) return;
        this.callbacks.onHpUpdateReceived?.(payload as BattleHpUpdatePacket);
      })
      .on('broadcast', { event: 'battle:forfeit' }, ({ payload }) => {
        if (this.isDuplicateOrSelf(payload)) return;
        this.callbacks.onForfeitReceived?.(payload as BattleForfeitPacket);
      });

    return new Promise(resolve => {
      if (!this.channel) return resolve(false);

      this.channel.subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          // Registrar datos en Presence
          await this.channel?.track(presenceData);
          resolve(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          resolve(false);
        }
      });
    });
  }

  /**
   * Genera el encabezado estándar monotónico para cada paquete
   */
  private createHeader(): { seqId: number; packetId: string; senderId: string; timestamp: number } {
    this.seqCounter += 1;
    const packetId = `${this.userId}-${this.seqCounter}-${Date.now()}`;
    return {
      seqId: this.seqCounter,
      packetId,
      senderId: this.userId,
      timestamp: Date.now(),
    };
  }

  /**
   * Deduplica paquetes y filtra ecos propios
   */
  private isDuplicateOrSelf(payload: any): boolean {
    if (!payload || !payload.packetId || !payload.senderId) return true;
    if (payload.senderId === this.userId) return true;
    if (this.processedPacketIds.has(payload.packetId)) return true;

    this.processedPacketIds.add(payload.packetId);
    // Limitar tamaño de la memoria de deduplicación
    if (this.processedPacketIds.size > 200) {
      const firstKey = this.processedPacketIds.values().next().value;
      if (firstKey) this.processedPacketIds.delete(firstKey);
    }
    return false;
  }

  /**
   * Envía Handshake inicial con datos de la criatura seleccionada
   */
  public async sendHandshake(combatant: EnrichedCapturedPokemon): Promise<void> {
    if (!this.channel) return;
    const packet: BattleHandshakePacket = {
      ...this.createHeader(),
      combatant: {
        instanceId: combatant.id,
        pokemonId: combatant.pokemon_id,
        name: combatant.base.name,
        cp: combatant.cp,
        currentHp: combatant.current_hp,
        maxHp: combatant.maxHp,
        spriteUrl: combatant.base.animation_url || combatant.base.sprite_url,
        types: [combatant.base.type_primary_id, combatant.base.type_secondary_id].filter(Boolean) as number[],
        fastMove: {
          id: combatant.fastMove.id,
          name: combatant.fastMove.name,
          power: combatant.fastMove.power,
          energyDelta: combatant.fastMove.energy_delta,
          typeId: combatant.fastMove.type_id,
        },
        chargedMove: {
          id: combatant.chargedMove.id,
          name: combatant.chargedMove.name,
          power: combatant.chargedMove.power,
          energyDelta: combatant.chargedMove.energy_delta,
          typeId: combatant.chargedMove.type_id,
        },
      },
    };

    await this.channel.send({
      type: 'broadcast',
      event: 'battle:handshake',
      payload: packet,
    });
  }

  /**
   * Despacha un ataque rápido por WebSocket
   */
  public async sendFastAttack(
    moveId: number,
    moveName: string,
    moveTypeId: number,
    rawPower: number,
    attackerEffectiveAttack: number
  ): Promise<void> {
    if (!this.channel) return;
    const packet: BattleAttackPacket = {
      ...this.createHeader(),
      type: 'FAST_ATTACK',
      moveId,
      moveName,
      moveTypeId,
      rawPower,
      attackerEffectiveAttack,
    };

    await this.channel.send({
      type: 'broadcast',
      event: 'battle:fast_attack',
      payload: packet,
    });
  }

  /**
   * Despacha un ataque cargado por WebSocket
   */
  public async sendChargedAttack(
    moveId: number,
    moveName: string,
    moveTypeId: number,
    rawPower: number,
    attackerEffectiveAttack: number
  ): Promise<void> {
    if (!this.channel) return;
    const packet: BattleAttackPacket = {
      ...this.createHeader(),
      type: 'CHARGED_ATTACK',
      moveId,
      moveName,
      moveTypeId,
      rawPower,
      attackerEffectiveAttack,
    };

    await this.channel.send({
      type: 'broadcast',
      event: 'battle:charged_attack',
      payload: packet,
    });
  }

  /**
   * Despacha una esquiva por WebSocket
   */
  public async sendDodge(direction: 'left' | 'right'): Promise<void> {
    if (!this.channel) return;
    const packet: BattleDodgePacket = {
      ...this.createHeader(),
      direction,
      dodgeWindowMs: 500,
    };

    await this.channel.send({
      type: 'broadcast',
      event: 'battle:dodge',
      payload: packet,
    });
  }

  /**
   * Despacha una actualización autoritativa de Puntos de Salud
   */
  public async sendHpUpdate(
    targetUserId: string,
    previousHp: number,
    newHp: number,
    damageTaken: number,
    wasDodged: boolean,
    typeMultiplier: number,
    isFainted: boolean
  ): Promise<void> {
    if (!this.channel) return;
    const packet: BattleHpUpdatePacket = {
      ...this.createHeader(),
      targetUserId,
      previousHp,
      newHp,
      damageTaken,
      wasDodged,
      typeMultiplier,
      isFainted,
    };

    await this.channel.send({
      type: 'broadcast',
      event: 'battle:hp_update',
      payload: packet,
    });
  }

  /**
   * Despacha abandono voluntario o por desconexión
   */
  public async sendForfeit(reason: 'timeout' | 'surrender' | 'out_of_bounds'): Promise<void> {
    if (!this.channel) return;
    const packet: BattleForfeitPacket = {
      ...this.createHeader(),
      reason,
    };

    await this.channel.send({
      type: 'broadcast',
      event: 'battle:forfeit',
      payload: packet,
    });
  }

  /**
   * Cierra el canal y libera los recursos en memoria
   */
  public async disconnect(): Promise<void> {
    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }
    this.processedPacketIds.clear();
  }
}
