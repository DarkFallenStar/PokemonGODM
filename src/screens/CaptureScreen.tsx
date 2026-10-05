import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import type {
  BallType,
  BallInventoryCount,
  CaptureScreenState,
  ThrowGrade,
} from '../types/capture';
import { ARCameraViewport } from '../components/ARCameraViewport';
import { ARPokemonSprite } from '../components/ARPokemonSprite';
import { PokeballThrower } from '../components/PokeballThrower';
import { CaptureHUD } from '../components/CaptureHUD';
import { CaptureSuccessModal } from '../components/CaptureSuccessModal';
import {
  evaluateThrowGrade,
  calculateCatchProbability,
  getTargetRingColor,
  simulateCaptureShakes,
} from '../utils/captureProbability';
import {
  getBallInventory,
  consumeBall,
  recordSuccessfulCapture,
} from '../services/captureService';

type CaptureScreenRouteProp = NativeStackScreenProps<
  RootStackParamList,
  'Capture'
>;

export const CaptureScreen: React.FC = () => {
  const navigation = useNavigation<CaptureScreenRouteProp['navigation']>();
  const route = useRoute<CaptureScreenRouteProp['route']>();
  const { spawn } = route.params;

  const pokemon = spawn.pokemon;
  const pokemonId = spawn.pokemon_id || pokemon?.id;
  const pokemonName = pokemon?.name || `Pokémon #${pokemonId}`;
  const baseCatchRate = 0.40; // Base catch rate estándar de Gen 1

  // Estados de Realidad Aumentada y Sensores
  const [arEnabled, setArEnabled] = useState<boolean>(true);
  const [arOffset, setArOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Máquina de Estados de Captura
  const [state, setState] = useState<CaptureScreenState>('aiming');
  const [selectedBall, setSelectedBall] = useState<BallType>('pokeball');
  const [ballInventory, setBallInventory] = useState<BallInventoryCount>({
    pokeball: 50,
    greatball: 25,
    ultraball: 10,
  });

  const [currentRingRatio, setCurrentRingRatio] = useState<number>(1.0);
  const [throwBanner, setThrowBanner] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);

  // Cargar inventario inicial de Pokéballs
  useEffect(() => {
    let isMounted = true;
    getBallInventory().then(inv => {
      if (isMounted) {
        setBallInventory(inv);
        // Si no tiene Pokéballs comunes, preseleccionar la primera disponible
        if (inv.pokeball <= 0 && inv.greatball > 0) {
          setSelectedBall('greatball');
        } else if (inv.pokeball <= 0 && inv.greatball <= 0 && inv.ultraball > 0) {
          setSelectedBall('ultraball');
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleOffsetChange = useCallback((offset: { x: number; y: number }) => {
    setArOffset(offset);
  }, []);

  const handleRingRatioUpdate = useCallback((ratio: number) => {
    setCurrentRingRatio(ratio);
  }, []);

  // Manejador del lanzamiento y colisión
  const handleHit = useCallback(
    async (metrics: { distancePx: number; hitX: number; hitY: number }) => {
      // 1. Evaluar cuantitativamente la puntería
      const maxRingRadius = 75;
      const currentRadius = maxRingRadius * currentRingRatio;
      const evaluation = evaluateThrowGrade(
        metrics.distancePx,
        currentRadius,
        maxRingRadius
      );

      // Mostrar banner de puntería si obtuvo Nice/Great/Excellent
      if (evaluation.label) {
        setThrowBanner(evaluation.label);
        setTimeout(() => setThrowBanner(null), 1800);
      }

      // 2. Descontar la bola utilizada
      consumeBall(selectedBall);
      setBallInventory(prev => ({
        ...prev,
        [selectedBall]: Math.max(0, prev[selectedBall] - 1),
      }));

      // 3. Pasar a estado de absorción
      setState('ball_hit');

      // 4. Calcular probabilidad de éxito y simular sacudidas
      const catchProb = calculateCatchProbability({
        baseCatchRate,
        cp: spawn.cp,
        ballType: selectedBall,
        throwGrade: evaluation.grade,
      });

      const outcome = simulateCaptureShakes(catchProb);

      // Secuencia temporal de sacudidas de la bola
      setTimeout(() => {
        if (outcome.shakesCompleted >= 1) {
          setState('shaking_1');
        } else {
          handleEscape(outcome.hasFled);
          return;
        }

        setTimeout(() => {
          if (outcome.shakesCompleted >= 2) {
            setState('shaking_2');
          } else {
            handleEscape(outcome.hasFled);
            return;
          }

          setTimeout(() => {
            if (outcome.shakesCompleted >= 3) {
              setState('shaking_3');
            } else {
              handleEscape(outcome.hasFled);
              return;
            }

            setTimeout(async () => {
              if (outcome.isCaptured) {
                // ¡Captura Exitosa!
                setState('captured');
                await recordSuccessfulCapture(spawn, selectedBall);
                setShowSuccessModal(true);
              } else {
                handleEscape(outcome.hasFled);
              }
            }, 700);
          }, 850);
        }, 850);
      }, 700);
    },
    [currentRingRatio, selectedBall, baseCatchRate, spawn]
  );

  const handleEscape = (hasFled: boolean) => {
    if (hasFled) {
      setState('fled');
      Alert.alert(
        '¡Oh no!',
        `¡${pokemonName} se ha escapado y huyó!`,
        [{ text: 'Regresar', onPress: () => navigation.goBack() }]
      );
    } else {
      setState('escaped');
      setThrowBanner('¡Se escapó de la bola!');
      setTimeout(() => {
        setThrowBanner(null);
        setState('aiming');
      }, 1200);
    }
  };

  const handleMiss = useCallback(() => {
    // Si falló el tiro, descontar la bola
    consumeBall(selectedBall);
    setBallInventory(prev => ({
      ...prev,
      [selectedBall]: Math.max(0, prev[selectedBall] - 1),
    }));
    setState('aiming');
  }, [selectedBall]);

  const handleConfirmCapture = async (nickname?: string) => {
    setShowSuccessModal(false);
    if (nickname) {
      await recordSuccessfulCapture(spawn, selectedBall, nickname);
    }
    navigation.goBack();
  };

  const ringColor = getTargetRingColor(baseCatchRate, selectedBall);
  const isAbsorbed =
    state === 'ball_hit' ||
    state === 'shaking_1' ||
    state === 'shaking_2' ||
    state === 'shaking_3' ||
    state === 'captured';

  return (
    <View style={styles.container}>
      {/* 1. Visor de Cámara Fullscreen con Fusión Sensorial */}
      <ARCameraViewport
        arEnabled={arEnabled}
        onOffsetChange={handleOffsetChange}
      >
        {/* 2. Sprite Oficial Animado con Hitbox y Anillo Dinámico */}
        <ARPokemonSprite
          pokemon={pokemon}
          pokemonId={pokemonId}
          arOffset={arOffset}
          targetRingColor={ringColor}
          isAiming={state === 'aiming'}
          onRingRatioUpdate={handleRingRatioUpdate}
          isAbsorbed={isAbsorbed}
        />

        {/* 3. Controlador Balístico 3D y Gesto de Lanzamiento */}
        <PokeballThrower
          ballType={selectedBall}
          state={state}
          targetOffset={arOffset}
          onHit={handleHit}
          onMiss={handleMiss}
          disabled={state !== 'aiming'}
        />

        {/* 4. HUD Superior y Bandeja de Munición */}
        <CaptureHUD
          pokemonName={pokemonName}
          cp={spawn.cp}
          ballInventory={ballInventory}
          selectedBall={selectedBall}
          onSelectBall={setSelectedBall}
          onFlee={() => navigation.goBack()}
          arEnabled={arEnabled}
          onToggleAR={() => setArEnabled(prev => !prev)}
          throwBanner={throwBanner}
          disabled={state !== 'aiming'}
        />
      </ARCameraViewport>

      {/* 5. Modal de Celebración de Captura Exitosa */}
      <CaptureSuccessModal
        visible={showSuccessModal}
        spawn={spawn}
        onConfirm={handleConfirmCapture}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
