import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import type { EnrichedCapturedPokemon } from '../types/inventory';
import type { BattlePhase, BattleRole } from '../types/battle';
import {
  fetchCapturedPokemonCollection,
  updatePokemonHealth,
  DEMO_USER_ID,
} from '../services/inventoryService';
import {
  calculateBattleDamage,
  createGymAIDefender,
  claimGymnasiumVictory,
  TYPE_NAMES,
  TYPE_COLORS,
} from '../services/battleEngine';
import { fetchTrainerProfile } from '../services/playerProfileService';
import { TEAMS, type TrainerTeam } from '../types/battle';
import { BattleRealtimeManager } from '../services/battleRealtime';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type GymBattleScreenProps = NativeStackScreenProps<RootStackParamList, 'GymBattle'>;

export const GymBattleScreen: React.FC<GymBattleScreenProps> = ({ route, navigation }) => {
  const { gymId, gymName, initialTeam, distanceMeters, defender } = route.params;

  // Estados de Combate
  const [phase, setPhase] = useState<BattlePhase>('MATCHMAKING');
  const [collection, setCollection] = useState<EnrichedCapturedPokemon[]>([]);
  const [playerPokemon, setPlayerPokemon] = useState<EnrichedCapturedPokemon | null>(null);
  const [opponentPokemon, setOpponentPokemon] = useState<EnrichedCapturedPokemon | null>(null);
  const [isOpponentAI, setIsOpponentAI] = useState<boolean>(true);
  const [winner, setWinner] = useState<'player' | 'opponent' | null>(null);
  const [opponentFloatingText, setOpponentFloatingText] = useState<{
    title: string;
    subtitle?: string;
    color: string;
    id: number;
  } | null>(null);
  const [playerFloatingText, setPlayerFloatingText] = useState<{
    title: string;
    subtitle?: string;
    color: string;
    id: number;
  } | null>(null);
  const [playerTeam, setPlayerTeam] = useState<TrainerTeam>('mystic');

  // Salud y Energía
  const [playerHp, setPlayerHp] = useState<number>(100);
  const [playerMaxHp, setPlayerMaxHp] = useState<number>(100);
  const [playerEnergy, setPlayerEnergy] = useState<number>(0);

  const [opponentHp, setOpponentHp] = useState<number>(100);
  const [opponentMaxHp, setOpponentMaxHp] = useState<number>(100);

  // Banderas de Esquiva y Tiempo
  const isDodgingRef = useRef<boolean>(false);
  const dodgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiAttackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeRef = useRef<BattleRealtimeManager | null>(null);

  // Valores Animados con Reanimated
  const playerX = useSharedValue<number>(0);
  const playerY = useSharedValue<number>(0);
  const playerFlash = useSharedValue<number>(1);

  const opponentX = useSharedValue<number>(0);
  const opponentY = useSharedValue<number>(0);
  const opponentFlash = useSharedValue<number>(1);

  const countdownNumber = useSharedValue<number>(3);

  // Cargar criaturas del jugador y perfil de entrenador al iniciar
  useEffect(() => {
    (async () => {
      const [coll, profile] = await Promise.all([
        fetchCapturedPokemonCollection(DEMO_USER_ID),
        fetchTrainerProfile(DEMO_USER_ID),
      ]);
      setPlayerTeam(profile.team);
      setCollection(coll);
      // Auto-seleccionar primer Pokémon con salud
      const alive = coll.filter(p => p.current_hp > 0);
      if (alive.length > 0) {
        setPlayerPokemon(alive[0]);
      } else if (coll.length > 0) {
        setPlayerPokemon(coll[0]);
      }
    })();
  }, []);

  // Verificar Geofencing estricto de 40m
  useEffect(() => {
    if (distanceMeters > 40) {
      Alert.alert(
        'Fuera del Radio de Combate',
        `Te encuentras a ${distanceMeters}m del gimnasio. Debes estar a 40 metros o menos para combatir.`,
        [{ text: 'Entendido', onPress: () => navigation.goBack() }]
      );
    }
  }, [distanceMeters, navigation]);

  // Inicializar oponente AI con el defensor real asignado al gimnasio
  const setupAIOpponent = useCallback(() => {
    const aiDefender = createGymAIDefender(gymName, initialTeam, defender);
    setOpponentPokemon(aiDefender);
    setOpponentHp(aiDefender.current_hp);
    setOpponentMaxHp(aiDefender.maxHp);
    setIsOpponentAI(true);
  }, [gymName, initialTeam, defender]);

  // Manejo de Conexión Realtime WebSocket
  useEffect(() => {
    if (!playerPokemon) return;

    setupAIOpponent();

    const manager = new BattleRealtimeManager(gymId, DEMO_USER_ID, {
      onPeerJoined: peer => {
        // Un rival presencial se unió al gimnasio
        setIsOpponentAI(false);
        // Despachar handshake
        manager.sendHandshake(playerPokemon);
      },
      onHandshakeReceived: packet => {
        // Recibir datos del rival en vivo
        const rivalCombatant: any = {
          id: packet.combatant.instanceId,
          user_id: packet.senderId,
          pokemon_id: packet.combatant.pokemonId,
          cp: packet.combatant.cp,
          current_hp: packet.combatant.currentHp,
          maxHp: packet.combatant.maxHp,
          iv_attack: 12,
          iv_defense: 12,
          iv_hp: 12,
          fast_move_id: packet.combatant.fastMove.id,
          charged_move_id: packet.combatant.chargedMove.id,
          captured_at: new Date().toISOString(),
          base: {
            id: packet.combatant.pokemonId,
            name: packet.combatant.name,
            type_primary_id: packet.combatant.types[0] || 1,
            type_secondary_id: packet.combatant.types[1] || null,
            base_hp: 80,
            base_attack: 80,
            base_defense: 80,
            base_sp_attack: 80,
            base_sp_defense: 80,
            base_speed: 80,
            base_cp: packet.combatant.cp,
            base_catch_rate: 0.1,
            sprite_url: packet.combatant.spriteUrl,
            animation_url: packet.combatant.spriteUrl,
          },
          fastMove: packet.combatant.fastMove,
          chargedMove: packet.combatant.chargedMove,
          stats: {
            attack: { statName: 'Ataque', baseValue: 80, ivValue: 12, effectiveValue: 92, maxPossibleEffective: 95, ivPercentage: 80 },
            defense: { statName: 'Defensa', baseValue: 80, ivValue: 12, effectiveValue: 92, maxPossibleEffective: 95, ivPercentage: 80 },
            hp: { statName: 'PS', baseValue: 80, ivValue: 12, effectiveValue: packet.combatant.maxHp, maxPossibleEffective: 200, ivPercentage: 80 },
          },
          appraisal: { totalIV: 36, overallPercentage: 80, stars: 2, isPerfect: false, summaryText: 'Rival en vivo.', badgeColor: '#94A3B8' },
        };
        setOpponentPokemon(rivalCombatant);
        setOpponentHp(packet.combatant.currentHp);
        setOpponentMaxHp(packet.combatant.maxHp);
        setIsOpponentAI(false);
      },
      onAttackReceived: packet => {
        // Ataque recibido del rival (Receiver-Authoritative Damage Resolution)
        handleReceiveAttack(packet.rawPower, packet.moveTypeId, packet.attackerEffectiveAttack, false);
      },
      onDodgeReceived: packet => {
        // Animar esquiva del oponente
        opponentX.value = withSequence(
          withTiming(packet.direction === 'left' ? -40 : 40, { duration: 150 }),
          withTiming(0, { duration: 250 })
        );
      },
      onHpUpdateReceived: packet => {
        // Sincronizar barra del oponente con el valor autoritativo
        setOpponentHp(packet.newHp);
        if (packet.wasDodged) {
          triggerOpponentFloatingText('¡Rival Esquivó! 💨', '#F59E0B', `-${packet.damageTaken} PS (-75%)`);
        } else if (packet.typeMultiplier === 0) {
          triggerOpponentFloatingText('¡Sin efecto! 🚫', '#EF4444', '0 PS (Inmune)');
        } else if (packet.typeMultiplier > 1.0) {
          triggerOpponentFloatingText('¡Súper eficaz! 💥', '#10B981', `-${packet.damageTaken} PS`);
        } else if (packet.typeMultiplier < 1.0) {
          triggerOpponentFloatingText('No muy eficaz... 🛡️', '#94A3B8', `-${packet.damageTaken} PS`);
        } else {
          triggerOpponentFloatingText(`-${packet.damageTaken} PS`, '#38BDF8');
        }
        if (packet.isFainted) {
          handleBattleVictory();
        }
      },
      onForfeitReceived: () => {
        Alert.alert('Rival Desconectado', 'El oponente abandonó el gimnasio. ¡Victoria por abandono!');
        handleBattleVictory();
      },
    });

    realtimeRef.current = manager;

    // Conectar WebSocket
    manager.connect({
      userId: DEMO_USER_ID,
      username: 'Entrenador UniSabana',
      team: playerTeam,
      role: 'challenger',
      status: 'ready',
      combatant: {
        instanceId: playerPokemon.id,
        pokemonId: playerPokemon.pokemon_id,
        name: playerPokemon.nickname || playerPokemon.base.name,
        cp: playerPokemon.cp,
        currentHp: playerPokemon.current_hp,
        maxHp: playerPokemon.maxHp,
        spriteUrl: playerPokemon.base.animation_url || playerPokemon.base.sprite_url,
        types: [playerPokemon.base.type_primary_id, playerPokemon.base.type_secondary_id].filter(Boolean) as number[],
      },
    });

    return () => {
      manager.disconnect();
      if (aiAttackIntervalRef.current) clearInterval(aiAttackIntervalRef.current);
      if (dodgeTimerRef.current) clearTimeout(dodgeTimerRef.current);
    };
  }, [playerPokemon, gymId, initialTeam, setupAIOpponent]);

  // Iniciar conteo regresivo de combate
  const startCombat = useCallback(() => {
    if (!playerPokemon || !opponentPokemon) return;

    if (playerPokemon.current_hp <= 0) {
      Alert.alert(
        'Pokémon Debilitado',
        `Tu ${playerPokemon.nickname || playerPokemon.base.name} tiene 0 PS y no puede combatir. Usa un Revivir en tu Mochila o selecciona otra criatura.`
      );
      return;
    }

    setPlayerHp(playerPokemon.current_hp);
    setPlayerMaxHp(playerPokemon.maxHp);
    setPlayerEnergy(0);

    setPhase('COUNTDOWN');
    countdownNumber.value = 3;

    setTimeout(() => {
      countdownNumber.value = 2;
    }, 1000);

    setTimeout(() => {
      countdownNumber.value = 1;
    }, 2000);

    setTimeout(() => {
      setPhase('ACTIVE_COMBAT');
      // Si el oponente es un bot AI, iniciar su ciclo de ataque automático
      if (isOpponentAI) {
        startAIBattleLoop();
      }
    }, 3000);
  }, [playerPokemon, opponentPokemon, isOpponentAI]);

  // Ciclo de Ataque y Acciones del Bot AI Defensor
  const startAIBattleLoop = () => {
    if (aiAttackIntervalRef.current) clearInterval(aiAttackIntervalRef.current);

    aiAttackIntervalRef.current = setInterval(() => {
      if (phase === 'FINISHED' || winner !== null) return;

      // El bot ejecuta su ataque rápido cada 1.8 segundos
      opponentY.value = withSequence(withTiming(20, { duration: 100 }), withTiming(0, { duration: 150 }));

      if (opponentPokemon) {
        handleReceiveAttack(
          opponentPokemon.fastMove.power,
          opponentPokemon.fastMove.type_id,
          opponentPokemon.stats.attack.effectiveValue,
          false
        );
      }
    }, 1800);
  };

  // Notificación flotante sobre el oponente (daño infligido por el jugador)
  const triggerOpponentFloatingText = (title: string, color: string, subtitle?: string) => {
    setOpponentFloatingText({ title, subtitle, color, id: Date.now() });
    setTimeout(() => {
      setOpponentFloatingText(prev => (prev?.title === title ? null : prev));
    }, 1200);
  };

  // Notificación flotante sobre el jugador (daño recibido o esquiva propia)
  const triggerPlayerFloatingText = (title: string, color: string, subtitle?: string) => {
    setPlayerFloatingText({ title, subtitle, color, id: Date.now() });
    setTimeout(() => {
      setPlayerFloatingText(prev => (prev?.title === title ? null : prev));
    }, 1200);
  };

  // Procesar Ataque Recibido (Receiver-Authoritative)
  const handleReceiveAttack = (
    rawPower: number,
    moveTypeId: number,
    attackerAttack: number,
    isCharged: boolean
  ) => {
    if (!playerPokemon) return;

    const damageResult = calculateBattleDamage({
      rawPower,
      attackerEffectiveAttack: attackerAttack,
      defenderEffectiveDefense: playerPokemon.stats.defense.effectiveValue,
      moveTypeId,
      attackerPrimaryTypeId: moveTypeId,
      defenderPrimaryTypeId: playerPokemon.base.type_primary_id,
      defenderSecondaryTypeId: playerPokemon.base.type_secondary_id,
      isDodging: isDodgingRef.current,
    });

    // Animar vibración de impacto en el jugador
    playerFlash.value = withSequence(withTiming(0.2, { duration: 80 }), withTiming(1, { duration: 150 }));

    setPlayerHp(prev => {
      const nextHp = Math.max(0, prev - damageResult.finalDamage);

      if (damageResult.wasDodged) {
        triggerPlayerFloatingText('¡Ataque Esquivado! 💨', '#38BDF8', `-${damageResult.finalDamage} PS (-75%)`);
      } else if (damageResult.isImmune) {
        triggerPlayerFloatingText('¡Sin efecto! 🛡️', '#10B981', '0 PS (Inmune)');
      } else if (damageResult.isSuperEffective) {
        triggerPlayerFloatingText('¡Daño Súper eficaz! ⚠️', '#EF4444', `-${damageResult.finalDamage} PS`);
      } else if (damageResult.isNotVeryEffective) {
        triggerPlayerFloatingText('Daño poco eficaz 🛡️', '#94A3B8', `-${damageResult.finalDamage} PS`);
      } else {
        triggerPlayerFloatingText(`-${damageResult.finalDamage} PS`, '#F8FAFC');
      }

      // Si estamos en P2P, reportar nueva salud autoritativa al rival
      if (!isOpponentAI && realtimeRef.current) {
        realtimeRef.current.sendHpUpdate(
          DEMO_USER_ID,
          prev,
          nextHp,
          damageResult.finalDamage,
          damageResult.wasDodged,
          damageResult.typeMultiplier,
          nextHp <= 0
        );
      }

      if (nextHp <= 0) {
        handleBattleDefeat();
      }

      return nextHp;
    });
  };

  // Acción: Ataque Rápido del Jugador (Tap continuo)
  const handlePlayerFastAttack = () => {
    if (phase !== 'ACTIVE_COMBAT' || !playerPokemon || !opponentPokemon) return;

    // Animación de impulso hacia adelante
    playerY.value = withSequence(withTiming(-25, { duration: 100 }), withTiming(0, { duration: 120 }));

    // Cargar energía
    setPlayerEnergy(prev => Math.min(100, prev + playerPokemon.fastMove.energy_delta));

    if (isOpponentAI) {
      // Impactar contra el Bot AI
      const damageResult = calculateBattleDamage({
        rawPower: playerPokemon.fastMove.power,
        attackerEffectiveAttack: playerPokemon.stats.attack.effectiveValue,
        defenderEffectiveDefense: opponentPokemon.stats.defense.effectiveValue,
        moveTypeId: playerPokemon.fastMove.type_id,
        attackerPrimaryTypeId: playerPokemon.base.type_primary_id,
        attackerSecondaryTypeId: playerPokemon.base.type_secondary_id,
        defenderPrimaryTypeId: opponentPokemon.base.type_primary_id,
        defenderSecondaryTypeId: opponentPokemon.base.type_secondary_id,
        isDodging: false,
      });

      opponentFlash.value = withSequence(withTiming(0.2, { duration: 80 }), withTiming(1, { duration: 120 }));

      setOpponentHp(prev => {
        const next = Math.max(0, prev - damageResult.finalDamage);
        if (damageResult.isImmune) {
          triggerOpponentFloatingText('¡Sin efecto! 🚫', '#EF4444', '0 PS (Inmune)');
        } else if (damageResult.isSuperEffective) {
          triggerOpponentFloatingText('¡Súper eficaz! 💥', '#10B981', `-${damageResult.finalDamage} PS`);
        } else if (damageResult.isNotVeryEffective) {
          triggerOpponentFloatingText('No muy eficaz... 🛡️', '#94A3B8', `-${damageResult.finalDamage} PS`);
        } else {
          triggerOpponentFloatingText(`-${damageResult.finalDamage} PS`, '#38BDF8');
        }
        if (next <= 0) {
          handleBattleVictory();
        }
        return next;
      });
    } else {
      // Enviar ataque rápido por WebSocket
      realtimeRef.current?.sendFastAttack(
        playerPokemon.fastMove.id,
        playerPokemon.fastMove.name,
        playerPokemon.fastMove.type_id,
        playerPokemon.fastMove.power,
        playerPokemon.stats.attack.effectiveValue
      );
    }
  };

  // Acción: Ataque Cargado del Jugador
  const handlePlayerChargedAttack = () => {
    if (phase !== 'ACTIVE_COMBAT' || !playerPokemon || !opponentPokemon) return;
    const cost = Math.abs(playerPokemon.chargedMove.energy_delta);
    if (playerEnergy < cost) return;

    // Consumir energía
    setPlayerEnergy(prev => Math.max(0, prev - cost));

    // Animación de impacto devastador
    playerY.value = withSequence(
      withTiming(-40, { duration: 150 }),
      withSpring(0, { damping: 6 })
    );

    if (isOpponentAI) {
      const damageResult = calculateBattleDamage({
        rawPower: playerPokemon.chargedMove.power,
        attackerEffectiveAttack: playerPokemon.stats.attack.effectiveValue,
        defenderEffectiveDefense: opponentPokemon.stats.defense.effectiveValue,
        moveTypeId: playerPokemon.chargedMove.type_id,
        attackerPrimaryTypeId: playerPokemon.base.type_primary_id,
        attackerSecondaryTypeId: playerPokemon.base.type_secondary_id,
        defenderPrimaryTypeId: opponentPokemon.base.type_primary_id,
        defenderSecondaryTypeId: opponentPokemon.base.type_secondary_id,
        isDodging: false,
      });

      opponentFlash.value = withSequence(withTiming(0.1, { duration: 100 }), withTiming(1, { duration: 200 }));

      setOpponentHp(prev => {
        const next = Math.max(0, prev - damageResult.finalDamage);
        const moveName = playerPokemon.chargedMove.name.toUpperCase();
        if (damageResult.isImmune) {
          triggerOpponentFloatingText(`¡${moveName}! ⚡`, '#EF4444', '¡Sin efecto! (Inmune)');
        } else if (damageResult.isSuperEffective) {
          triggerOpponentFloatingText(`¡${moveName}! ⚡`, '#F59E0B', `¡SÚPER EFICAZ! -${damageResult.finalDamage} PS`);
        } else if (damageResult.isNotVeryEffective) {
          triggerOpponentFloatingText(`¡${moveName}! ⚡`, '#94A3B8', `No muy eficaz... -${damageResult.finalDamage} PS`);
        } else {
          triggerOpponentFloatingText(`¡${moveName}! ⚡`, '#F59E0B', `-${damageResult.finalDamage} PS`);
        }
        if (next <= 0) {
          handleBattleVictory();
        }
        return next;
      });
    } else {
      realtimeRef.current?.sendChargedAttack(
        playerPokemon.chargedMove.id,
        playerPokemon.chargedMove.name,
        playerPokemon.chargedMove.type_id,
        playerPokemon.chargedMove.power,
        playerPokemon.stats.attack.effectiveValue
      );
    }
  };

  // Acción: Esquiva del Jugador (Swipe Horizontal)
  const handleDodge = useCallback((direction: 'left' | 'right') => {
    if (phase !== 'ACTIVE_COMBAT') return;

    // Desplazar sprite
    const targetOffset = direction === 'left' ? -65 : 65;
    playerX.value = withSequence(
      withTiming(targetOffset, { duration: 120, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 250, easing: Easing.inOut(Easing.quad) })
    );

    // Activar ventana de esquiva de 500 ms
    isDodgingRef.current = true;
    if (dodgeTimerRef.current) clearTimeout(dodgeTimerRef.current);
    dodgeTimerRef.current = setTimeout(() => {
      isDodgingRef.current = false;
    }, 500);

    triggerPlayerFloatingText('⚡ ¡Esquiva Activa!', '#38BDF8');

    // Notificar al rival por WebSocket
    if (!isOpponentAI) {
      realtimeRef.current?.sendDodge(direction);
    }
  }, [phase, isOpponentAI, playerX]);

  // Gesto Pan para detectar swipe lateral ejecutado en el hilo de JS
  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-20, 20])
    .onEnd(event => {
      if (Math.abs(event.translationX) > 25) {
        const dir = event.translationX > 0 ? 'right' : 'left';
        handleDodge(dir);
      }
    });

  // Finalización del Combate: Victoria
  const handleBattleVictory = async () => {
    setWinner('player');
    setPhase('FINISHED');
    if (aiAttackIntervalRef.current) clearInterval(aiAttackIntervalRef.current);

    // 1. Guardar la salud REAL remanente del Pokémon del jugador en su Pokédex (no se cura mágicamente)
    if (playerPokemon) {
      await updatePokemonHealth(playerPokemon.id, playerHp);
    }

    // 2. Reclamar el gimnasio en Supabase con el equipo del jugador (crea un guardián clon al 100% de PS)
    const res = await claimGymnasiumVictory(gymId, DEMO_USER_ID, playerTeam, playerPokemon?.id);
    const teamInfo = TEAMS[playerTeam];

    const newDefenderName = playerPokemon?.nickname || playerPokemon?.base.name || 'Tu Pokémon';

    Alert.alert(
      '🏆 ¡VICTORIA EN EL GIMNASIO!',
      `Has derrotado al defensor de ${gymName}.\n\n${res.message || 'El gimnasio ahora ondea la bandera de tu equipo.'}\n\nLiderazgo transferido a: ${teamInfo.badge} ${teamInfo.name}\n🛡️ Nuevo Defensor Asignado: ${newDefenderName} (Guardián Clon al 100% PS)\n❤️ Tu Pokémon en la Pokédex conserva ${playerHp}/${playerMaxHp} PS.\nTransacción RPC (finalize_gym_battle): ${res.success ? 'Ejecutada con éxito ✅' : 'Error: ' + res.error}`,
      [{ text: '¡Excelente!', onPress: () => navigation.goBack() }]
    );
  };

  // Finalización del Combate: Derrota
  const handleBattleDefeat = async () => {
    setWinner('opponent');
    setPhase('FINISHED');
    if (aiAttackIntervalRef.current) clearInterval(aiAttackIntervalRef.current);

    // Persistir salud a 0 PS (debilitado) en la base de datos
    if (playerPokemon) {
      await updatePokemonHealth(playerPokemon.id, 0);
    }

    Alert.alert(
      '💀 Pokémon Debilitado',
      `Tu ${playerPokemon?.nickname || playerPokemon?.base.name || 'Pokémon'} ha caído en combate (0 PS).\nUsa un Revivir en la Mochila para reanimarlo.`,
      [{ text: 'Volver al Mapa', onPress: () => navigation.goBack() }]
    );
  };

  // Estilos Reanimated para sprites
  const animatedPlayerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: playerX.value }, { translateY: playerY.value }],
    opacity: playerFlash.value,
  }));

  const animatedOpponentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: opponentX.value }, { translateY: opponentY.value }],
    opacity: opponentFlash.value,
  }));

  const canUseCharged =
    playerPokemon && playerEnergy >= Math.abs(playerPokemon.chargedMove.energy_delta);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Barra de Título Superior con Nombre del Gimnasio y Distancia */}
      <View style={styles.topHud}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>✕ Salir</Text>
        </TouchableOpacity>
        <View style={styles.gymInfoCenter}>
          <Text style={styles.gymHeaderTitle}>{gymName}</Text>
          <Text style={styles.gymHeaderSubtitle}>
            {isOpponentAI ? '🤖 Oponente: Defensor Guardián' : '👥 Combate PvP en Tiempo Real'}
          </Text>
        </View>
        <View style={styles.rangePill}>
          <Text style={styles.rangeText}>{distanceMeters}m</Text>
        </View>
      </View>

      {/* Fase 1: Selección de Combatiente */}
      {phase === 'MATCHMAKING' && (
        <View style={styles.matchmakingOverlay}>
          <Text style={styles.matchmakingTitle}>Selecciona tu Criatura de Combate</Text>
          <Text style={styles.matchmakingSubtitle}>
            Elige un Pokémon con PS disponibles para entrar a la arena del gimnasio:
          </Text>

          {/* Indicador del Equipo del Jugador */}
          <View style={[styles.teamIndicatorPill, { borderColor: TEAMS[playerTeam].color }]}>
            <Text style={styles.teamIndicatorEmoji}>{TEAMS[playerTeam].badge}</Text>
            <Text style={[styles.teamIndicatorText, { color: TEAMS[playerTeam].accentColor }]}>
              Representando al {TEAMS[playerTeam].name}
            </Text>
          </View>

          {/* Lista de Selección Rápida */}
          <View style={styles.combatantList}>
            {collection.map(p => {
              const isSelected = playerPokemon?.id === p.id;
              const isFainted = p.current_hp <= 0;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.combatantCard,
                    isSelected && styles.selectedCombatantCard,
                    isFainted && styles.faintedCombatantCard,
                  ]}
                  onPress={() => {
                    if (isFainted) {
                      Alert.alert(
                        'Pokémon Debilitado',
                        `${p.nickname || p.base.name} tiene 0 PS y no puede combatir. Usa un Revivir en la Mochila.`
                      );
                      return;
                    }
                    setPlayerPokemon(p);
                  }}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{
                      uri:
                        p.base.animation_url ||
                        `https://img.pokemondb.net/sprites/black-white/anim/normal/${p.base.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.gif`,
                    }}
                    style={styles.combatantSprite}
                    contentFit="contain"
                  />
                  <Text style={styles.combatantName} numberOfLines={1}>
                    {p.nickname || p.base.name}
                  </Text>
                  <Text style={styles.combatantCp}>CP {p.cp}</Text>
                  <Text style={[styles.combatantHp, isFainted && styles.combatantHpFainted]}>
                    {isFainted ? '💀 0 PS' : `${p.current_hp}/${p.maxHp} PS`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.startBattleButton} onPress={startCombat} activeOpacity={0.85}>
            <Text style={styles.startBattleText}>⚔️ Entrar a la Arena</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Fase 2: Conteo Regresivo */}
      {phase === 'COUNTDOWN' && (
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownTitle}>¡PREPÁRATE!</Text>
          <Text style={styles.countdownNumber}>3... 2... 1...</Text>
          <Text style={styles.countdownSubtitle}>Haz tap para atacar y swipe para esquivar</Text>
        </View>
      )}

      {/* Fase 3 & 4: Arena de Combate Activa */}
      {(phase === 'ACTIVE_COMBAT' || phase === 'FINISHED') && (
        <GestureDetector gesture={panGesture}>
          <TouchableOpacity
            style={styles.arenaContainer}
            activeOpacity={1}
            onPress={handlePlayerFastAttack}
          >
            {/* Rótulo Flotante del Oponente (Daño recibido por el Rival) */}
            {opponentFloatingText && (
              <View style={styles.opponentFloatingTextWrapper} pointerEvents="none">
                <View style={[styles.floatingBanner, { borderColor: opponentFloatingText.color }]}>
                  <Text style={[styles.floatingTitle, { color: opponentFloatingText.color }]}>
                    {opponentFloatingText.title}
                  </Text>
                  {opponentFloatingText.subtitle ? (
                    <Text style={styles.floatingSubtitle}>{opponentFloatingText.subtitle}</Text>
                  ) : null}
                </View>
              </View>
            )}

            {/* Rótulo Flotante del Jugador (Daño recibido por el Jugador / Esquivas) */}
            {playerFloatingText && (
              <View style={styles.playerFloatingTextWrapper} pointerEvents="none">
                <View style={[styles.floatingBanner, { borderColor: playerFloatingText.color }]}>
                  <Text style={[styles.floatingTitle, { color: playerFloatingText.color }]}>
                    {playerFloatingText.title}
                  </Text>
                  {playerFloatingText.subtitle ? (
                    <Text style={styles.floatingSubtitle}>{playerFloatingText.subtitle}</Text>
                  ) : null}
                </View>
              </View>
            )}

            {/* ZONA SUPERIOR: Pokémon Defensor Oponente */}
            <View style={styles.opponentZone}>
              {/* Barra de Vida del Oponente */}
              <View style={styles.statusBox}>
                <View style={styles.statusNameRow}>
                  <Text style={styles.statusName}>{opponentPokemon?.base.name}</Text>
                  <Text style={styles.statusCp}>CP {opponentPokemon?.cp}</Text>
                </View>
                <View style={styles.hpTrack}>
                  <View
                    style={[
                      styles.hpFill,
                      {
                        width: `${Math.max(0, Math.min(100, (opponentHp / opponentMaxHp) * 100))}%`,
                        backgroundColor:
                          opponentHp / opponentMaxHp > 0.5
                            ? '#10B981'
                            : opponentHp / opponentMaxHp > 0.2
                            ? '#F59E0B'
                            : '#EF4444',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.hpNumber}>
                  {opponentHp} / {opponentMaxHp} PS
                </Text>
              </View>

              {/* Sprite del Oponente */}
              <Animated.View style={[styles.opponentSpriteContainer, animatedOpponentStyle]}>
                <Image
                  source={{
                    uri:
                      opponentPokemon?.base.animation_url ||
                      `https://img.pokemondb.net/sprites/black-white/anim/normal/${opponentPokemon?.base.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.gif`,
                  }}
                  style={styles.opponentSprite}
                  contentFit="contain"
                />
              </Animated.View>
            </View>

            {/* ZONA INFERIOR: Pokémon del Jugador */}
            <View style={styles.playerZone}>
              {/* Sprite del Jugador */}
              <Animated.View style={[styles.playerSpriteContainer, animatedPlayerStyle]}>
                <Image
                  source={{
                    uri:
                      playerPokemon?.base.animation_url ||
                      `https://img.pokemondb.net/sprites/black-white/anim/normal/${playerPokemon?.base.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.gif`,
                  }}
                  style={styles.playerSprite}
                  contentFit="contain"
                />
              </Animated.View>

              {/* Barra de Vida y Energía del Jugador */}
              <View style={[styles.statusBox, styles.playerStatusBox]}>
                <View style={styles.statusNameRow}>
                  <Text style={styles.statusName}>{playerPokemon?.base.name}</Text>
                  <Text style={styles.statusCp}>CP {playerPokemon?.cp}</Text>
                </View>

                {/* Barra de PS */}
                <View style={styles.hpTrack}>
                  <View
                    style={[
                      styles.hpFill,
                      {
                        width: `${Math.max(0, Math.min(100, (playerHp / playerMaxHp) * 100))}%`,
                        backgroundColor:
                          playerHp / playerMaxHp > 0.5
                            ? '#10B981'
                            : playerHp / playerMaxHp > 0.2
                            ? '#F59E0B'
                            : '#EF4444',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.hpNumber}>
                  {playerHp} / {playerMaxHp} PS
                </Text>

                {/* Barra de Energía para Ataque Cargado */}
                <View style={styles.energyHeader}>
                  <Text style={styles.energyLabel}>⚡ Energía</Text>
                  <Text style={styles.energyValue}>{playerEnergy}%</Text>
                </View>
                <View style={styles.energyTrack}>
                  <View style={[styles.energyFill, { width: `${playerEnergy}%` }]} />
                </View>
              </View>

              {/* Botón Flotante de Ataque Cargado con Tipo Elemental */}
              <View style={styles.chargedButtonWrapper}>
                {(() => {
                  const moveTypeId = playerPokemon?.chargedMove.type_id || 1;
                  const typeName = TYPE_NAMES[moveTypeId] || 'Normal';
                  const typeColor = TYPE_COLORS[moveTypeId] || '#64748B';
                  return (
                    <TouchableOpacity
                      style={[
                        styles.chargedButton,
                        canUseCharged
                          ? [styles.chargedButtonReady, { borderColor: typeColor, shadowColor: typeColor }]
                          : styles.chargedButtonDisabled,
                      ]}
                      disabled={!canUseCharged}
                      onPress={handlePlayerChargedAttack}
                      activeOpacity={0.8}
                    >
                      <View style={styles.chargedButtonInner}>
                        <View style={styles.chargedButtonTopRow}>
                          <View style={[styles.chargedTypeBadge, { backgroundColor: typeColor }]}>
                            <Text style={styles.chargedTypeBadgeText}>{typeName.toUpperCase()}</Text>
                          </View>
                          <Text style={styles.chargedButtonText}>
                            {playerPokemon?.chargedMove.name}
                          </Text>
                        </View>
                        <Text style={styles.chargedCostText}>
                          ⚡ {Math.abs(playerPokemon?.chargedMove.energy_delta || 50)} Energía • {playerEnergy}% acumulado
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })()}
              </View>

              {/* Guía Táctil Rápida */}
              <View style={styles.hintBar}>
                <Text style={styles.hintText}>
                  👉 Tap continuo: Ataque Rápido | ↔️ Swipe: Esquivar daño (-75%)
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </GestureDetector>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  topHud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  gymInfoCenter: {
    alignItems: 'center',
  },
  gymHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  gymHeaderSubtitle: {
    fontSize: 11,
    color: '#38BDF8',
    marginTop: 2,
  },
  rangePill: {
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rangeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  matchmakingOverlay: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchmakingTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 6,
    textAlign: 'center',
  },
  matchmakingSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  combatantList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  combatantCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    width: 100,
    borderWidth: 2,
    borderColor: '#334155',
  },
  selectedCombatantCard: {
    borderColor: '#38BDF8',
    backgroundColor: '#1E3A8A',
  },
  combatantSprite: {
    width: 50,
    height: 50,
    marginBottom: 6,
  },
  combatantName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  combatantCp: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
  },
  combatantHp: {
    fontSize: 10,
    color: '#10B981',
    marginTop: 2,
  },
  combatantHpFainted: {
    color: '#EF4444',
    fontWeight: '800',
  },
  faintedCombatantCard: {
    opacity: 0.55,
    borderColor: '#7F1D1D',
  },
  teamIndicatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    alignSelf: 'center',
    marginBottom: 16,
  },
  teamIndicatorEmoji: {
    fontSize: 16,
  },
  teamIndicatorText: {
    fontSize: 12,
    fontWeight: '700',
  },
  startBattleButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 16,
    shadowColor: '#2563EB',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  startBattleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  countdownOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#F59E0B',
    marginBottom: 10,
  },
  countdownNumber: {
    fontSize: 36,
    fontWeight: '900',
    color: '#F8FAFC',
    marginBottom: 12,
  },
  countdownSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
  },
  arenaContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  opponentFloatingTextWrapper: {
    position: 'absolute',
    top: '20%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  playerFloatingTextWrapper: {
    position: 'absolute',
    bottom: '26%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  floatingBanner: {
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  floatingSubtitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 2,
  },
  opponentZone: {
    alignItems: 'flex-start',
    width: '100%',
  },
  playerZone: {
    alignItems: 'flex-end',
    width: '100%',
  },
  statusBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.90)',
    borderRadius: 14,
    padding: 10,
    width: 220,
    borderWidth: 1,
    borderColor: '#334155',
  },
  playerStatusBox: {
    alignSelf: 'flex-end',
    marginBottom: 10,
  },
  statusNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  statusName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  statusCp: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38BDF8',
  },
  hpTrack: {
    height: 8,
    backgroundColor: '#0F172A',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 2,
  },
  hpFill: {
    height: '100%',
    borderRadius: 4,
  },
  hpNumber: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'right',
  },
  energyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  energyLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F59E0B',
  },
  energyValue: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  energyTrack: {
    height: 6,
    backgroundColor: '#0F172A',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 2,
  },
  energyFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 3,
  },
  opponentSpriteContainer: {
    alignSelf: 'center',
    marginVertical: 12,
  },
  opponentSprite: {
    width: 140,
    height: 140,
  },
  playerSpriteContainer: {
    alignSelf: 'center',
    marginVertical: 10,
  },
  playerSprite: {
    width: 140,
    height: 140,
  },
  chargedButtonWrapper: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
  },
  chargedButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 2,
    minWidth: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chargedButtonReady: {
    backgroundColor: '#1E293B',
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 6,
  },
  chargedButtonDisabled: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    opacity: 0.5,
  },
  chargedButtonInner: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  chargedButtonTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  chargedTypeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 8,
  },
  chargedTypeBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  chargedButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  chargedCostText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  hintBar: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 4,
  },
  hintText: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
  },
});
