import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import type { PokemonBase } from '../types/pokemon';
import { getPokemonSpriteSources } from '../utils/pokemonAssets';

interface ARPokemonSpriteProps {
  pokemon?: PokemonBase | null;
  pokemonId?: number;
  arOffset?: { x: number; y: number };
  targetRingColor?: string;
  isAiming?: boolean;
  onRingRatioUpdate?: (ratio: number) => void;
  isAbsorbed?: boolean;
}

const BASE_SPRITE_SIZE = 140;
const MAX_RING_RADIUS = 75;

export const ARPokemonSprite: React.FC<ARPokemonSpriteProps> = ({
  pokemon,
  pokemonId,
  arOffset = { x: 0, y: 0 },
  targetRingColor = '#22C55E',
  isAiming = true,
  onRingRatioUpdate,
  isAbsorbed = false,
}) => {
  const { primaryUrl, fallbackUrl } = getPokemonSpriteSources(
    pokemon || (pokemonId ? { id: pokemonId } : null)
  );

  // Valor compartido para el radio normalizado del anillo (de 1.0 a 0.25)
  const ringRatio = useSharedValue(1.0);

  // Intervalo JS para transmitir el radio al evaluador de impacto
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Animación de contracción periódica en Reanimated (UI Thread)
    ringRatio.value = withRepeat(
      withTiming(0.22, {
        duration: 1450,
        easing: Easing.linear,
      }),
      -1,
      true
    );

    timerRef.current = setInterval(() => {
      if (onRingRatioUpdate) {
        onRingRatioUpdate(ringRatio.value);
      }
    }, 45);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [ringRatio, onRingRatioUpdate]);

  // Estilo animado para el anillo dinámico interior
  const animatedRingStyle = useAnimatedStyle(() => {
    const currentRadius = MAX_RING_RADIUS * ringRatio.value;
    return {
      width: currentRadius * 2,
      height: currentRadius * 2,
      borderRadius: currentRadius,
      borderColor: targetRingColor,
    };
  });

  return (
    <View
      style={[
        styles.container,
        {
          transform: [
            { translateX: arOffset.x },
            { translateY: arOffset.y },
            { scale: isAbsorbed ? 0 : 1 },
          ],
          opacity: isAbsorbed ? 0 : 1,
        },
      ]}
      pointerEvents="none"
    >
      {/* 1. Anillo Exterior Fijo (Blanco de referencia) */}
      {isAiming && (
        <View style={styles.outerRing}>
          {/* 2. Anillo Dinámico Concéntrico Interior */}
          <Animated.View style={[styles.innerRing, animatedRingStyle]} />
        </View>
      )}

      {/* 3. Sprite Oficial Animado de la Gen 5 de PokemonDB */}
      <Image
        source={{ uri: primaryUrl }}
        style={styles.spriteImage}
        contentFit="contain"
        autoplay={true}
        priority="high"
        cachePolicy="memory-disk"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    top: '32%',
    width: BASE_SPRITE_SIZE + 40,
    height: BASE_SPRITE_SIZE + 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spriteImage: {
    width: BASE_SPRITE_SIZE,
    height: BASE_SPRITE_SIZE,
  },
  outerRing: {
    position: 'absolute',
    width: MAX_RING_RADIUS * 2,
    height: MAX_RING_RADIUS * 2,
    borderRadius: MAX_RING_RADIUS,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerRing: {
    borderWidth: 3,
  },
});
