import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import type { BallType, CaptureScreenState } from '../types/capture';

interface PokeballThrowerProps {
  ballType: BallType;
  state: CaptureScreenState;
  targetOffset?: { x: number; y: number };
  onThrowStart?: () => void;
  onHit?: (metrics: { distancePx: number; hitX: number; hitY: number }) => void;
  onMiss?: () => void;
  disabled?: boolean;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BALL_BASE_SIZE = 68;

export const PokeballThrower: React.FC<PokeballThrowerProps> = ({
  ballType,
  state,
  targetOffset = { x: 0, y: 0 },
  onThrowStart,
  onHit,
  onMiss,
  disabled = false,
}) => {
  // Referencia mutable para evitar que el estado de React interrumpa el gesto
  const isFlightActive = useRef<boolean>(false);

  // Valores compartidos de Reanimated en UI Thread
  const ballX = useSharedValue(0);
  const ballY = useSharedValue(0);
  const ballScale = useSharedValue(1.0);
  const ballRotation = useSharedValue(0);

  // Resetear la Pokéball a la mano del jugador
  const resetBall = () => {
    isFlightActive.current = false;
    ballX.value = withTiming(0, { duration: 240 });
    ballY.value = withTiming(0, { duration: 240 });
    ballScale.value = withTiming(1.0, { duration: 240 });
    ballRotation.value = withTiming(0, { duration: 240 });
  };

  // Reaccionar a cambios de estado del ciclo de captura
  useEffect(() => {
    if (state === 'ball_hit') {
      // La bola cae al suelo tras absorber al Pokémon y rebota
      const currentY = ballY.value;
      ballY.value = withSequence(
        withTiming(currentY + 110, { duration: 320, easing: Easing.in(Easing.quad) }),
        withTiming(currentY + 95, { duration: 130, easing: Easing.out(Easing.quad) }),
        withTiming(currentY + 110, { duration: 110, easing: Easing.in(Easing.quad) })
      );
    } else if (state === 'shaking_1' || state === 'shaking_2' || state === 'shaking_3') {
      // Secuencia de sacudida lateral clásica de Pokéball (Wobble)
      ballRotation.value = withSequence(
        withTiming(-22, { duration: 110, easing: Easing.linear }),
        withTiming(22, { duration: 220, easing: Easing.linear }),
        withTiming(-14, { duration: 180, easing: Easing.linear }),
        withTiming(14, { duration: 150, easing: Easing.linear }),
        withTiming(0, { duration: 110, easing: Easing.linear })
      );
    } else if (state === 'aiming') {
      resetBall();
    }
  }, [state]);

  const handleImpact = (distancePx: number, hitX: number, hitY: number) => {
    onHit?.({ distancePx, hitX, hitY });
  };

  const handleMiss = () => {
    onMiss?.();
    setTimeout(() => {
      resetBall();
    }, 600);
  };

  // Simulación cinemática del vuelo balístico hacia el objetivo
  const launchBall = (
    transX: number,
    transY: number,
    velX: number,
    velY: number
  ) => {
    // Coordenadas objetivo en pantalla del Pokémon (centro + offset AR)
    const pokeScreenX = SCREEN_WIDTH / 2 + targetOffset.x;
    const pokeScreenY = SCREEN_HEIGHT * 0.38 + targetOffset.y;

    // Distancia y velocidad hacia arriba (positivas)
    const upwardDistance = Math.max(30, -transY);
    const upwardSpeed = Math.max(80, -velY);

    // Potencia del tiro calibrada: swipe de ~170px o ~1100px/s equivale a potencia 1.0 (centro)
    const powerFromDist = upwardDistance / 170;
    const powerFromSpeed = upwardSpeed / 1100;
    const rawPower = powerFromDist * 0.45 + powerFromSpeed * 0.55;
    const throwPower = Math.min(1.35, Math.max(0.68, rawPower));

    // Desviación horizontal del tiro (ángulo y velocidad transversal)
    const horizontalLead = velX * 0.05;
    const targetX = SCREEN_WIDTH / 2 + transX + horizontalLead;

    // Altura de llegada en pantalla (potencia 1.0 llega al centro del Pokémon)
    const targetY = pokeScreenY + (1.0 - throwPower) * 150;

    const flightTimeMs = 760;

    // Desplazamiento relativo desde el origen de la Pokéball (SCREEN_HEIGHT * 0.76)
    const deltaTargetX = targetX - SCREEN_WIDTH / 2;
    const deltaTargetY = targetY - SCREEN_HEIGHT * 0.76;
    const apexRelativeY = Math.min(deltaTargetY, 0) - 80;

    // 1. Animación X
    ballX.value = withTiming(deltaTargetX, {
      duration: flightTimeMs,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });

    // 2. Parábola balística Y (sube al apex y desciende bajo aceleración hacia el objetivo)
    ballY.value = withSequence(
      withTiming(apexRelativeY, {
        duration: flightTimeMs * 0.44,
        easing: Easing.out(Easing.quad),
      }),
      withTiming(deltaTargetY, {
        duration: flightTimeMs * 0.56,
        easing: Easing.in(Easing.quad),
      })
    );

    // 3. Perspectiva cónica en profundidad (reducción de tamaño)
    ballScale.value = withTiming(0.38, {
      duration: flightTimeMs,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
    });

    // 4. Giro balístico
    ballRotation.value = withTiming(ballRotation.value + 720, {
      duration: flightTimeMs,
      easing: Easing.linear,
    });

    // Verificación de impacto con Hitbox al culminar la parábola
    setTimeout(() => {
      const dx = targetX - pokeScreenX;
      const dy = targetY - pokeScreenY;
      const distancePx = Math.sqrt(dx * dx + dy * dy);

      // Hitbox amigable de 85px de radio sobre el Pokémon
      const HITBOX_RADIUS = 85;

      if (distancePx <= HITBOX_RADIUS) {
        handleImpact(distancePx, targetX, targetY);
      } else {
        handleMiss();
      }
    }, flightTimeMs);
  };

  // Gesto Pan con área de toque ampliada (hitSlop) y seguimiento instantáneo
  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .enabled(!disabled && state === 'aiming')
    .hitSlop({ top: 90, bottom: 60, left: 90, right: 90 })
    .onStart(() => {
      if (isFlightActive.current) return;
      onThrowStart?.();
    })
    .onUpdate(e => {
      if (isFlightActive.current) return;
      // Arrastre 1:1 con el dedo
      ballX.value = e.translationX;
      ballY.value = e.translationY;
      ballRotation.value = e.translationX * 0.35;
    })
    .onEnd(e => {
      if (isFlightActive.current) return;

      // Lanzamiento válido: swipe hacia arriba mayor a 35px o velocidad mayor a 100px/s
      const isUpwardSwipe = e.translationY < -35 || e.velocityY < -100;

      if (isUpwardSwipe) {
        isFlightActive.current = true;
        launchBall(e.translationX, e.translationY, e.velocityX, e.velocityY);
      } else {
        // Gesto cancelado o insuficiente -> resorte elástico de regreso al origen
        ballX.value = withSpring(0);
        ballY.value = withSpring(0);
        ballRotation.value = withSpring(0);
      }
    });

  // Estilo animado de la bola
  const animatedBallStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: ballX.value },
        { translateY: ballY.value },
        { scale: ballScale.value },
        { rotate: `${ballRotation.value}deg` },
      ],
    };
  });

  return (
    <View style={styles.container} pointerEvents="box-none">
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.ballWrapper, animatedBallStyle]}>
          <PokeballGraphic ballType={ballType} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

/**
 * Gráfico vectorial nativo para Pokéball, Greatball y Ultraball
 */
const PokeballGraphic: React.FC<{ ballType: BallType }> = ({ ballType }) => {
  const topColor =
    ballType === 'ultraball'
      ? '#F59E0B' // Amarillo/Dorado Ultra Ball
      : ballType === 'greatball'
      ? '#2563EB' // Azul Great Ball
      : '#EF4444'; // Rojo Pokéball clásica

  return (
    <View style={styles.ballCircle}>
      {/* Mitad superior */}
      <View style={[styles.ballTop, { backgroundColor: topColor }]}>
        {ballType === 'ultraball' && <View style={styles.ultraStripe} />}
        {ballType === 'greatball' && (
          <View style={styles.greatBallMarks}>
            <View style={styles.greatMark} />
            <View style={styles.greatMark} />
          </View>
        )}
      </View>

      {/* Franja central negra */}
      <View style={styles.ballCenterBelt} />

      {/* Mitad inferior blanca */}
      <View style={styles.ballBottom} />

      {/* Botón central interactivo */}
      <View style={styles.centerButtonOuter}>
        <View style={styles.centerButtonInner} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: SCREEN_HEIGHT * 0.14,
  },
  ballWrapper: {
    width: BALL_BASE_SIZE,
    height: BALL_BASE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ballCircle: {
    width: BALL_BASE_SIZE,
    height: BALL_BASE_SIZE,
    borderRadius: BALL_BASE_SIZE / 2,
    borderWidth: 3,
    borderColor: '#0F172A',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
  },
  ballTop: {
    flex: 1,
    borderBottomWidth: 2,
    borderBottomColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ballCenterBelt: {
    position: 'absolute',
    top: '47%',
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: '#0F172A',
  },
  ballBottom: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 2,
    borderTopColor: '#0F172A',
  },
  centerButtonOuter: {
    position: 'absolute',
    alignSelf: 'center',
    top: '36%',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#94A3B8',
  },
  ultraStripe: {
    position: 'absolute',
    top: 2,
    width: '75%',
    height: 8,
    backgroundColor: '#0F172A',
    borderRadius: 4,
  },
  greatBallMarks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '70%',
  },
  greatMark: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
});
