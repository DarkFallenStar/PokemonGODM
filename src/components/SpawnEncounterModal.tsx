import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import type { ActiveSpawn } from '../types/spawns';

interface SpawnEncounterModalProps {
  visible: boolean;
  spawn: ActiveSpawn | null;
  onClose: () => void;
  onStartCapture: (spawn: ActiveSpawn) => void;
}

export const SpawnEncounterModal: React.FC<SpawnEncounterModalProps> = ({
  visible,
  spawn,
  onClose,
  onStartCapture,
}) => {
  if (!spawn) return null;

  const pokemon = spawn.pokemon;
  const pokemonId = spawn.pokemon_id || pokemon?.id;

  // Cascada de URLs garantizadas con soporte nativo de PNG en Android
  const primaryUrl =
    pokemon?.sprite_url ||
    (pokemonId
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonId}.png`
      : null);

  const fallbackUrl = pokemonId
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`
    : null;

  const [currentUrl, setCurrentUrl] = useState<string | null>(primaryUrl);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Reiniciar estado reactivo cuando cambie el spawn
  useEffect(() => {
    setCurrentUrl(primaryUrl);
    setHasError(false);
    setIsLoading(true);
  }, [spawn?.id, primaryUrl]);

  const handleImageError = () => {
    if (currentUrl === primaryUrl && fallbackUrl) {
      setCurrentUrl(fallbackUrl);
    } else {
      setHasError(true);
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.encounterTitle}>¡Un Pokémon Salvaje ha aparecido!</Text>

          {/* Contenedor del Sprite con Fallback Seguro */}
          <View style={styles.imageContainer}>
            {currentUrl && !hasError ? (
              <Image
                source={{ uri: currentUrl }}
                style={styles.pokemonImage}
                resizeMode="contain"
                onLoadStart={() => setIsLoading(true)}
                onLoadEnd={() => setIsLoading(false)}
                onError={handleImageError}
              />
            ) : null}

            {isLoading && !hasError && (
              <View style={styles.loaderBox}>
                <ActivityIndicator size="small" color="#38BDF8" />
              </View>
            )}

            {hasError && <Text style={styles.fallbackEmoji}>🐾</Text>}
          </View>

          {/* Nombre y Estadísticas */}
          <Text style={styles.pokemonName}>{pokemon?.name || `Pokémon #${pokemonId}`}</Text>
          <View style={styles.cpBadge}>
            <Text style={styles.cpText}>CP {spawn.cp}</Text>
          </View>

          {/* Información de IVs y Proximidad */}
          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Text style={styles.statLabel}>ATK</Text>
              <Text style={styles.statVal}>{spawn.iv_attack ?? 10}/15</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statLabel}>DEF</Text>
              <Text style={styles.statVal}>{spawn.iv_defense ?? 10}/15</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statLabel}>HP</Text>
              <Text style={styles.statVal}>{spawn.iv_hp ?? 10}/15</Text>
            </View>
          </View>

          <Text style={styles.distanceText}>
            Distancia: {spawn.distance_meters ? `${spawn.distance_meters} m` : 'Muy cerca'}
          </Text>

          {/* Botones de Acción */}
          <TouchableOpacity
            style={styles.captureButton}
            onPress={() => onStartCapture(spawn)}
            activeOpacity={0.85}
          >
            <Text style={styles.captureButtonText}>🎯 ¡Iniciar Captura!</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeButtonText}>Ignorar y Regresar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#38BDF8',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  encounterTitle: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 14,
  },
  imageContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    marginBottom: 14,
    overflow: 'hidden',
  },
  pokemonImage: {
    width: 110,
    height: 110,
  },
  loaderBox: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  fallbackEmoji: {
    fontSize: 54,
  },
  pokemonName: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  cpBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22C55E',
    marginTop: 6,
    marginBottom: 10,
  },
  cpText: {
    color: '#4ADE80',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  statChip: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    minWidth: 54,
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '700',
  },
  statVal: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  distanceText: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 16,
  },
  captureButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
    elevation: 4,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
  captureButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.4,
  },
  closeButton: {
    backgroundColor: '#334155',
    paddingVertical: 11,
    width: '100%',
    borderRadius: 14,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 13,
  },
});
