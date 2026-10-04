import React from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity, Image } from 'react-native';
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
  const spriteUrl = pokemon?.animation_url || pokemon?.sprite_url;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.encounterTitle}>¡Un Pokémon Salvaje ha aparecido!</Text>

          {/* Sprite o GIF Animado */}
          <View style={styles.imageContainer}>
            {spriteUrl ? (
              <Image source={{ uri: spriteUrl }} style={styles.pokemonImage} resizeMode="contain" />
            ) : (
              <Text style={styles.fallbackEmoji}>🐾</Text>
            )}
          </View>

          {/* Nombre y Estadísticas */}
          <Text style={styles.pokemonName}>{pokemon?.name || 'Pokémon Desconocido'}</Text>
          <Text style={styles.cpText}>Puntos de Combate: CP {spawn.cp}</Text>
          <Text style={styles.distanceText}>Distancia: {spawn.distance_meters || 0} metros</Text>

          {/* Botones de Acción */}
          <TouchableOpacity
            style={styles.captureButton}
            onPress={() => onStartCapture(spawn)}
            activeOpacity={0.85}
          >
            <Text style={styles.captureButtonText}>🎯 Iniciar Captura</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeButtonText}>Ignorar</Text>
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
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#38BDF8',
    elevation: 8,
  },
  encounterTitle: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  imageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    marginBottom: 12,
  },
  pokemonImage: {
    width: 90,
    height: 90,
  },
  fallbackEmoji: {
    fontSize: 50,
  },
  pokemonName: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  cpText: {
    color: '#4ADE80',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  distanceText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 16,
  },
  captureButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
    elevation: 4,
  },
  captureButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  closeButton: {
    backgroundColor: '#334155',
    paddingVertical: 10,
    width: '100%',
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 13,
  },
});
