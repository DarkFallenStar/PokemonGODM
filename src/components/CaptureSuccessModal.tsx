import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import type { ActiveSpawn } from '../types/spawns';
import { getPokemonSpriteSources } from '../utils/pokemonAssets';

interface CaptureSuccessModalProps {
  visible: boolean;
  spawn: ActiveSpawn | null;
  onConfirm: (nickname?: string) => void;
}

export const CaptureSuccessModal: React.FC<CaptureSuccessModalProps> = ({
  visible,
  spawn,
  onConfirm,
}) => {
  const pokemon = spawn?.pokemon;
  const pokemonId = spawn?.pokemon_id || pokemon?.id;
  const pokemonName = pokemon?.name || `Pokémon #${pokemonId}`;

  const { primaryUrl } = getPokemonSpriteSources(
    pokemon || (pokemonId ? { id: pokemonId } : null)
  );

  const [nickname, setNickname] = useState<string>('');

  if (!visible || !spawn) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.congratsTitle}>¡YA ES TUYO!</Text>
          <Text style={styles.subtitle}>¡Has atrapado a {pokemonName}!</Text>

          {/* Sprite Animado de la criatura atrapada */}
          <View style={styles.imageBox}>
            <Image
              source={{ uri: primaryUrl }}
              style={styles.pokemonImage}
              contentFit="contain"
              autoplay={true}
              priority="high"
              cachePolicy="memory-disk"
            />
          </View>

          {/* Badge de CP */}
          <View style={styles.cpBadge}>
            <Text style={styles.cpText}>CP {spawn.cp}</Text>
          </View>

          {/* Desglose de IVs */}
          <View style={styles.ivRow}>
            <View style={styles.ivChip}>
              <Text style={styles.ivLabel}>ATK</Text>
              <Text style={styles.ivValue}>{spawn.iv_attack ?? 10}/15</Text>
            </View>
            <View style={styles.ivChip}>
              <Text style={styles.ivLabel}>DEF</Text>
              <Text style={styles.ivValue}>{spawn.iv_defense ?? 10}/15</Text>
            </View>
            <View style={styles.ivChip}>
              <Text style={styles.ivLabel}>HP</Text>
              <Text style={styles.ivValue}>{spawn.iv_hp ?? 10}/15</Text>
            </View>
          </View>

          {/* Campo de Apodo Opcional */}
          <TextInput
            style={styles.nicknameInput}
            placeholder={`Apodo para ${pokemonName}`}
            placeholderTextColor="#64748B"
            value={nickname}
            onChangeText={setNickname}
            maxLength={18}
          />

          {/* Botón de Continuar */}
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={() => onConfirm(nickname.trim() || undefined)}
            activeOpacity={0.85}
          >
            <Text style={styles.confirmButtonText}>Continuar al Mapa</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.90)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#22C55E',
    elevation: 10,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  congratsTitle: {
    color: '#4ADE80',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 14,
  },
  imageBox: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    marginBottom: 12,
  },
  pokemonImage: {
    width: 100,
    height: 100,
  },
  cpBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22C55E',
    marginBottom: 12,
  },
  cpText: {
    color: '#4ADE80',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  ivRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  ivChip: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    minWidth: 54,
  },
  ivLabel: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '700',
  },
  ivValue: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  nicknameInput: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
    textAlign: 'center',
  },
  confirmButton: {
    backgroundColor: '#22C55E',
    width: '100%',
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 15,
  },
});
