import React, { useState } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import type { BallType, CaptureScreenState } from '../types/capture';
import {
  calculateInitialVelocityWorklet,
  getBallPosition3DWorklet,
  project3DtoScreenWorklet,
  checkHitboxCollisionWorklet,
  TARGET_Z_DEPTH,
} from '../utils/ballPhysics';

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
  const [isThrowing, setIsThrowing] = useState<boolean>(false);

  // Posición inicial y de vuelo de la bola
  const ballX = useSharedValue(0); // Offset horizontal
  const ballY = useSharedValue(0); // Offset vertical
  const ballZ = useSharedValue(0); // Profundidad
  const ballScale = useSharedValue(1.0);
  const ballRotation = useSharedValue(0);

  // Resetear bola a la posición de origen
  const resetBall = () => {
    ballX.value = withTiming(0, { duration: 250 });
    ballY.value = withTiming(0, { duration: 250 });
    ballZ.value = 0;
    ballScale.value = withTiming(1.0, { duration: 250 });
    ballRotation.value = 0;
    setIsThrowing(false);
  };

  const handleImpact = (distancePx: number, hitX: number, hitY: number) => {
    setIsThrowing(false);
    onHit?.({ distancePx, hitX, hitY });
  };

  const handleMiss = () => {
    setIsThrowing(false);
    onMiss?.();
    resetBall();
  };

  // Simulación del vuelo cinemático y animación parabólica
  const runFlightSimulation = (
    v0x: number,
    v0y: number,
    v0z: number
  ) => {
    const totalFlightTime = Math.min(1.2, TARGET_Z_DEPTH / v0z);

    // Calcular posición final proyectada en el plano del Pokémon
    const posFinal3D = getBallPosition3DWorklet(totalFlightTime, v0x, v0y, v0z);
    const projFinal = project3DtoScreenWorklet(
      posFinal3D.x,
      posFinal3D.y,
      posFinal3D.z,
      SCREEN_WIDTH,
      SCREEN_HEIGHT
    );

    // Coordenadas en pantalla del Pokémon (centro de la pantalla + compensación AR)
    const pokeScreenX = SCREEN_WIDTH / 2 + targetOffset.x;
    const pokeScreenY = SCREEN_HEIGHT * 0.38 + targetOffset.y;

    const collision = checkHitboxCollisionWorklet(
      projFinal.screenX,
      projFinal.screenY,
      posFinal3D.z,
      pokeScreenX,
      pokeScreenY,
      65
    );

    // Animación de trayectoria parabólica suave
    ballX.value = withTiming(projFinal.screenX - SCREEN_WIDTH / 2, {
      duration: totalFlightTime * 1000,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });

    ballY.value = withSequence(
      // Subida de la parábola
      withTiming((projFinal.screenY - SCREEN_HEIGHT * 0.76) * 1.25, {
        duration: (totalFlightTime * 1000) / 2,
        easing: Easing.out(Easing.quad),
      }),
      // Caída hacia el objetivo
      withTiming(projFinal.screenY - SCREEN_HEIGHT * 0.76, {
        duration: (totalFlightTime * 1000) / 2,
        easing: Easing.in(Easing.quad),
      })
    );

    ballScale.value = withTiming(projFinal.scale, {
      duration: totalFlightTime * 1000,
      easing: Easing.linear,
    });

    ballRotation.value = withTiming(720, {
      duration: totalFlightTime * 1000,
    });

    // Callback de fin de vuelo al impactar o fallar
    setTimeout(() => {
      if (collision.isHit) {
        handleImpact(collision.distancePx, projFinal.screenX, projFinal.screenY);
      } else {
        handleMiss();
      }
    }, totalFlightTime * 1000);
  };

  // Gesto Pan para el Swipe Gesture (ejecutado en JS thread para interacción limpia con timers y estados)
  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .enabled(!disabled && state === 'aiming' && !isThrowing)
    .onStart(() => {
      setIsThrowing(true);
      if (onThrowStart) {
        onThrowStart();
      }
    })
    .onUpdate(e => {
      // Arrastre 2D mientras el dedo está sobre la pantalla
      ballX.value = e.translationX;
      ballY.value = Math.min(0, e.translationY); // Solo permitir arrastrar hacia arriba
    })
    .onEnd(e => {
      // Swipe hacia arriba válido
      if (e.translationY < -45 && e.velocityY < -150) {
        const vel = calculateInitialVelocityWorklet({
          startX: 0,
          startY: 0,
          endX: e.translationX,
          endY: e.translationY,
          durationMs: 250,
        });

        runFlightSimulation(vel.vx, vel.vy, vel.vz);
      } else {
        // Gesto cancelado o insuficiente -> resetear
        resetBall();
      }
    });

  // Animación reactiva para sacudidas de captura
  const animatedBallStyle = useAnimatedStyle(() => {
    let shakeOffset = 0;
    if (state === 'shaking_1' || state === 'shaking_2' || state === 'shaking_3') {
      shakeOffset = Math.sin(ballRotation.value * 0.1) * 8;
    }

    return {
      transform: [
        { translateX: ballX.value + shakeOffset },
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
