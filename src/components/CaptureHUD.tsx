import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BallType, BallInventoryCount, ThrowGrade } from '../types/capture';

interface CaptureHUDProps {
  pokemonName: string;
  cp: number;
  ballInventory: BallInventoryCount;
  selectedBall: BallType;
  onSelectBall: (ball: BallType) => void;
  onFlee: () => void;
  arEnabled: boolean;
  onToggleAR: () => void;
  throwBanner?: string | null;
  disabled?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const CaptureHUD: React.FC<CaptureHUDProps> = ({
  pokemonName,
  cp,
  ballInventory,
  selectedBall,
  onSelectBall,
  onFlee,
  arEnabled,
  onToggleAR,
  throwBanner,
  disabled = false,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.hudOverlay} pointerEvents="box-none">
      {/* 1. Header Superior */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        {/* Botón de Huir */}
        <TouchableOpacity
          style={styles.fleeButton}
          onPress={onFlee}
          activeOpacity={0.8}
        >
          <Text style={styles.fleeText}>🏃 Huir</Text>
        </TouchableOpacity>

        {/* Badge Central del Pokémon */}
        <View style={styles.pokemonBadge}>
          <Text style={styles.pokemonNameText}>{pokemonName}</Text>
          <Text style={styles.pokemonCpText}>CP {cp}</Text>
        </View>

        {/* Botón de Conmutación AR / Estudio */}
        <TouchableOpacity
          style={[styles.arToggleButton, arEnabled && styles.arToggleActive]}
          onPress={onToggleAR}
          activeOpacity={0.8}
        >
          <Text style={styles.arToggleText}>
            {arEnabled ? '📷 AR: On' : '🌿 Estudio'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2. Banner Flotante de Puntería (Nice / Great / Excellent) */}
      {throwBanner ? (
        <View style={styles.bannerContainer}>
          <View style={styles.bannerCard}>
            <Text style={styles.bannerText}>{throwBanner}</Text>
          </View>
        </View>
      ) : null}

      {/* 3. Bandeja Inferior de Selección de Pokéballs */}
      <View style={[styles.bottomTray, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.ballSelectorRow}>
          {/* Pokéball Estándar */}
          <BallSelectorButton
            type="pokeball"
            label="Pokéball"
            emoji="🔴"
            count={ballInventory.pokeball}
            isSelected={selectedBall === 'pokeball'}
            onPress={() => onSelectBall('pokeball')}
            disabled={disabled || ballInventory.pokeball <= 0}
          />

          {/* Superball */}
          <BallSelectorButton
            type="greatball"
            label="Superball"
            emoji="🔵"
            count={ballInventory.greatball}
            isSelected={selectedBall === 'greatball'}
            onPress={() => onSelectBall('greatball')}
            disabled={disabled || ballInventory.greatball <= 0}
          />

          {/* Ultraball */}
          <BallSelectorButton
            type="ultraball"
            label="Ultraball"
            emoji="🟡"
            count={ballInventory.ultraball}
            isSelected={selectedBall === 'ultraball'}
            onPress={() => onSelectBall('ultraball')}
            disabled={disabled || ballInventory.ultraball <= 0}
          />
        </View>
      </View>
    </View>
  );
};

interface BallSelectorButtonProps {
  type: BallType;
  label: string;
  emoji: string;
  count: number;
  isSelected: boolean;
  onPress: () => void;
  disabled: boolean;
}

const BallSelectorButton: React.FC<BallSelectorButtonProps> = ({
  label,
  emoji,
  count,
  isSelected,
  onPress,
  disabled,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.ballButton,
        isSelected && styles.ballButtonSelected,
        disabled && styles.ballButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={styles.ballEmoji}>{emoji}</Text>
      <Text style={styles.ballCount}>x{count}</Text>
      <Text style={styles.ballLabel}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  hudOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  fleeButton: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#475569',
  },
  fleeText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  pokemonBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
  },
  pokemonNameText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },
  pokemonCpText: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  arToggleButton: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#475569',
  },
  arToggleActive: {
    borderColor: '#22C55E',
    backgroundColor: 'rgba(22, 101, 52, 0.85)',
  },
  arToggleText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  bannerContainer: {
    alignSelf: 'center',
    position: 'absolute',
    top: '22%',
  },
  bannerCard: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#F59E0B',
    elevation: 8,
  },
  bannerText: {
    color: '#FBBF24',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bottomTray: {
    alignItems: 'center',
  },
  ballSelectorRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.90)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  ballButton: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    minWidth: 70,
  },
  ballButtonSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
  },
  ballButtonDisabled: {
    opacity: 0.35,
  },
  ballEmoji: {
    fontSize: 22,
  },
  ballCount: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  ballLabel: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '600',
  },
});
