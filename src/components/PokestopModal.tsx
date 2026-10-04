import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import type { CampusPOIMarker } from '../types/map';
import type { PokestopRewardItem } from '../types/interaction';
import {
  checkPokestopCooldown,
  recordPokestopSpin,
  generatePokestopRewards,
  addItemsToInventory,
} from '../services/inventoryService';

interface PokestopModalProps {
  visible: boolean;
  pokestop: CampusPOIMarker | null;
  distanceMeters: number;
  onClose: () => void;
  onSpunSuccess?: () => void;
}

export const PokestopModal: React.FC<PokestopModalProps> = ({
  visible,
  pokestop,
  distanceMeters,
  onClose,
  onSpunSuccess,
}) => {
  const [canSpin, setCanSpin] = useState<boolean>(false);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [rewards, setRewards] = useState<PokestopRewardItem[] | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(true);

  // Animación de rotación del disco
  const spinAnim = useRef(new Animated.Value(0)).current;

  const isInRange = distanceMeters <= 20;

  // Consultar estado de enfriamiento al abrir el modal
  useEffect(() => {
    if (!visible || !pokestop) {
      setRewards(null);
      return;
    }

    let isMounted = true;
    setIsLoadingStatus(true);

    async function loadStatus() {
      if (!pokestop) return;
      const status = await checkPokestopCooldown(pokestop.id);
      if (isMounted) {
        setCanSpin(status.canSpin);
        setCooldownSeconds(status.remainingSeconds);
        setIsLoadingStatus(false);
      }
    }

    loadStatus();

    return () => {
      isMounted = false;
    };
  }, [visible, pokestop]);

  // Temporizador regresivo de enfriamiento
  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const timer = setInterval(() => {
      setCooldownSeconds(prev => {
        if (prev <= 1) {
          setCanSpin(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const handleSpin = async () => {
    if (!pokestop || !isInRange || !canSpin || isSpinning) return;

    setIsSpinning(true);

    // Iniciar rotación del disco
    spinAnim.setValue(0);
    Animated.timing(spinAnim, {
      toValue: 3, // 3 vueltas completas
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(async () => {
      // Generar y persistir recompensas
      const newRewards = generatePokestopRewards();
      await addItemsToInventory(newRewards);
      await recordPokestopSpin(pokestop.id);

      setRewards(newRewards);
      setCanSpin(false);
      setCooldownSeconds(300); // 5 minutos
      setIsSpinning(false);

      if (onSpunSuccess) {
        onSpunSuccess();
      }
    });
  };

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const formatCooldown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!pokestop) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Encabezado */}
          <Text style={styles.stopIcon}>🔵</Text>
          <Text style={styles.stopTitle}>{pokestop.name}</Text>
          <Text style={styles.stopSubtitle}>Poképarada Oficial</Text>

          {/* Indicador de Distancia */}
          <View style={[styles.distancePill, isInRange ? styles.distanceInRange : styles.distanceOutOfRange]}>
            <Text style={styles.distanceText}>
              {isInRange ? `📍 En rango (${distanceMeters}m)` : `⚠️ Demasiado lejos (${distanceMeters}m)`}
            </Text>
          </View>

          {/* Disco Giratorio Interactivo */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSpin}
            disabled={!isInRange || !canSpin || isSpinning}
            style={styles.discContainer}
          >
            <Animated.View
              style={[
                styles.photoDisc,
                !canSpin && styles.discCooldown,
                { transform: [{ rotate: spinInterpolate }] },
              ]}
            >
              <Text style={styles.discEmoji}>{canSpin ? '🏛️' : '⌛'}</Text>
            </Animated.View>
          </TouchableOpacity>

          {/* Estado de Enfriamiento o Instrucción */}
          {isLoadingStatus ? (
            <ActivityIndicator size="small" color="#38BDF8" style={{ marginVertical: 12 }} />
          ) : !isInRange ? (
            <Text style={styles.warningMessage}>
              Debes acercarte a menos de 20 metros para girar el fotodisco y obtener objetos.
            </Text>
          ) : !canSpin ? (
            <View style={styles.cooldownContainer}>
              <Text style={styles.cooldownLabel}>Poképarada en Enfriamiento</Text>
              <Text style={styles.cooldownTimer}>{formatCooldown(cooldownSeconds)}</Text>
            </View>
          ) : (
            <Text style={styles.spinPrompt}>¡Toca el fotodisco para girar!</Text>
          )}

          {/* Recompensas entregadas */}
          {rewards && (
            <View style={styles.rewardsBox}>
              <Text style={styles.rewardsTitle}>¡Objetos Recibidos!</Text>
              <View style={styles.rewardsRow}>
                {rewards.map((r, index) => (
                  <View key={index} style={styles.rewardItem}>
                    <Text style={styles.rewardEmoji}>{r.emoji}</Text>
                    <Text style={styles.rewardText}>+{r.quantity} {r.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Botón de Cierre */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeButtonText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 22,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    elevation: 8,
  },
  stopIcon: {
    fontSize: 32,
    marginBottom: 6,
  },
  stopTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  stopSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  distancePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginBottom: 16,
  },
  distanceInRange: {
    backgroundColor: '#065F46',
  },
  distanceOutOfRange: {
    backgroundColor: '#7F1D1D',
  },
  distanceText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  discContainer: {
    marginVertical: 10,
  },
  photoDisc: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#0284C7',
    borderWidth: 6,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  discCooldown: {
    backgroundColor: '#581C87',
    borderColor: '#A855F7',
  },
  discEmoji: {
    fontSize: 54,
  },
  spinPrompt: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '700',
    marginVertical: 10,
  },
  warningMessage: {
    color: '#FCA5A5',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 10,
    paddingHorizontal: 12,
  },
  cooldownContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  cooldownLabel: {
    color: '#C084FC',
    fontSize: 12,
    fontWeight: '600',
  },
  cooldownTimer: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  rewardsBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 14,
    padding: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  rewardsTitle: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  rewardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  rewardEmoji: {
    fontSize: 14,
  },
  rewardText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  closeButton: {
    marginTop: 16,
    backgroundColor: '#334155',
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 14,
  },
});
