import React from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity } from 'react-native';
import type { CampusPOIMarker } from '../types/map';

interface GymModalProps {
  visible: boolean;
  gym: CampusPOIMarker | null;
  distanceMeters: number;
  onClose: () => void;
  onChallengeGym?: (gym: CampusPOIMarker) => void;
}

const TEAM_CONFIG = {
  mystic: { name: 'Equipo Sabiduría (Místico)', color: '#2563EB', badge: '🦅' },
  valor: { name: 'Equipo Valor', color: '#DC2626', badge: '🔥' },
  instinct: { name: 'Equipo Instinto', color: '#EAB308', badge: '⚡' },
  neutral: { name: 'Gimnasio Neutral', color: '#64748B', badge: '⚪' },
};

export const GymModal: React.FC<GymModalProps> = ({
  visible,
  gym,
  distanceMeters,
  onClose,
  onChallengeGym,
}) => {
  if (!gym) return null;

  const isInRange = distanceMeters <= 40;
  // Por defecto Mystic en demo
  const team = TEAM_CONFIG.mystic;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { borderColor: team.color }]}>
          {/* Insignia del Gimnasio */}
          <View style={[styles.teamBadge, { backgroundColor: team.color }]}>
            <Text style={styles.teamEmoji}>{team.badge}</Text>
          </View>

          <Text style={styles.gymTitle}>{gym.name}</Text>
          <Text style={[styles.teamName, { color: team.color }]}>{team.name}</Text>

          {/* Indicador de Rango de 40 metros */}
          <View style={[styles.distancePill, isInRange ? styles.distanceInRange : styles.distanceOutOfRange]}>
            <Text style={styles.distanceText}>
              {isInRange ? `📍 En rango de combate (${distanceMeters}m)` : `⚠️ Demasiado lejos (${distanceMeters}m)`}
            </Text>
          </View>

          {/* Tarjeta del Pokémon Defensor */}
          <View style={styles.defenderCard}>
            <Text style={styles.defenderLabel}>Pokémon Defensor del Gimnasio</Text>
            <Text style={styles.defenderEmoji}>🐲</Text>
            <Text style={styles.defenderName}>Dragonite</Text>
            <Text style={styles.defenderStats}>CP 3120 | HP 180/180</Text>
            <Text style={styles.trainerName}>Entrenador: Campeón UniSabana</Text>
          </View>

          {/* Instrucciones de Combate */}
          {!isInRange ? (
            <Text style={styles.warningMessage}>
              Debes encontrarte a menos de 40 metros del gimnasio para iniciar una batalla.
            </Text>
          ) : (
            <TouchableOpacity
              style={[styles.battleButton, { backgroundColor: team.color }]}
              activeOpacity={0.85}
              onPress={() => onChallengeGym?.(gym)}
            >
              <Text style={styles.battleButtonText}>⚔️ Desafiar Gimnasio</Text>
            </TouchableOpacity>
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
    borderWidth: 2,
    elevation: 8,
  },
  teamBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    elevation: 4,
  },
  teamEmoji: {
    fontSize: 28,
  },
  gymTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  teamName: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
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
  defenderCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 16,
    padding: 14,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
  },
  defenderLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  defenderEmoji: {
    fontSize: 44,
    marginVertical: 4,
  },
  defenderName: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  defenderStats: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  trainerName: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
  },
  warningMessage: {
    color: '#FCA5A5',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 12,
  },
  battleButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
    elevation: 3,
  },
  battleButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  closeButton: {
    marginTop: 6,
    backgroundColor: '#334155',
    paddingVertical: 10,
    width: '100%',
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 13,
  },
});
