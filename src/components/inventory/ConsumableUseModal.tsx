import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import type { ConsumableItemMetadata, EnrichedCapturedPokemon } from '../../types/inventory';
import { applyMedicineToPokemon } from '../../services/inventoryService';

interface ConsumableUseModalProps {
  visible: boolean;
  item: ConsumableItemMetadata | null;
  capturedPokemon: EnrichedCapturedPokemon[];
  onClose: () => void;
  onItemUsedSuccess: () => void;
}

export const ConsumableUseModal: React.FC<ConsumableUseModalProps> = ({
  visible,
  item,
  capturedPokemon,
  onClose,
  onItemUsedSuccess,
}) => {
  const [applyingId, setApplyingId] = useState<string | null>(null);

  if (!item) return null;

  const isRevive = item.type === 'revive';

  const handleApply = async (pokemon: EnrichedCapturedPokemon) => {
    if (isRevive && pokemon.current_hp > 0) {
      Alert.alert('No se puede usar', `${pokemon.base.name} no está debilitado.`);
      return;
    }

    if (!isRevive && pokemon.current_hp <= 0) {
      Alert.alert('Criatura Debilitada', `${pokemon.base.name} está debilitado (0 PS). Debes usar un Revivir primero.`);
      return;
    }

    if (!isRevive && pokemon.current_hp >= pokemon.maxHp) {
      Alert.alert('Salud Completa', `${pokemon.base.name} ya tiene sus puntos de salud al máximo.`);
      return;
    }

    setApplyingId(pokemon.id);
    try {
      const res = await applyMedicineToPokemon(
        pokemon.id,
        item.type as 'potion' | 'superpotion' | 'revive'
      );

      if (res.success) {
        Alert.alert(
          '¡Salud Restaurada!',
          `${pokemon.base.name} ahora tiene ${res.newHp}/${res.maxHp} PS.\n(Objetos restantes: ${res.remainingQuantity})`,
          [{ text: 'Genial' }]
        );
        onItemUsedSuccess();
      } else {
        Alert.alert('Aviso', res.error || 'No se pudo aplicar la medicina.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Error de conexión.');
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header del Objeto */}
          <View style={styles.header}>
            <Text style={styles.itemEmoji}>{item.iconEmoji}</Text>
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle}>Usar {item.name}</Text>
              <Text style={styles.itemDesc}>{item.description}</Text>
            </View>
          </View>

          <Text style={styles.promptText}>
            {isRevive
              ? 'Selecciona una criatura debilitada (0 PS) para revivir:'
              : 'Selecciona una criatura herida para curar sus PS:'}
          </Text>

          {/* Lista de Pokémon disponibles para curar */}
          <FlatList
            data={capturedPokemon}
            keyExtractor={p => p.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No tienes criaturas capturadas aún.</Text>
              </View>
            }
            renderItem={({ item: p }) => {
              const hpPercent = Math.max(0, Math.min(100, (p.current_hp / p.maxHp) * 100));
              const isFainted = p.current_hp <= 0;
              const isFull = p.current_hp >= p.maxHp;
              const isApplicable = isRevive ? isFainted : !isFainted && !isFull;
              const isCurrentApplying = applyingId === p.id;

              return (
                <TouchableOpacity
                  style={[
                    styles.pokemonRow,
                    isApplicable ? styles.applicableRow : styles.dimmedRow,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleApply(p)}
                  disabled={isCurrentApplying}
                >
                  <Image
                    source={{
                      uri:
                        p.base.animation_url ||
                        `https://img.pokemondb.net/sprites/black-white/anim/normal/${p.base.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.gif`,
                    }}
                    style={styles.thumbnail}
                    contentFit="contain"
                  />

                  <View style={styles.rowDetails}>
                    <View style={styles.nameRow}>
                      <Text style={styles.rowName}>{p.base.name}</Text>
                      <Text style={styles.rowCp}>CP {p.cp}</Text>
                    </View>

                    {/* Barra de vida en la fila */}
                    <View style={styles.miniHealthTrack}>
                      <View
                        style={[
                          styles.miniHealthFill,
                          {
                            width: `${hpPercent}%`,
                            backgroundColor:
                              hpPercent > 50 ? '#10B981' : hpPercent > 20 ? '#F59E0B' : '#EF4444',
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.hpLabel}>
                      {isFainted ? '💀 Debilitado (0 PS)' : `${p.current_hp} / ${p.maxHp} PS`}
                    </Text>
                  </View>

                  {/* Botón o Indicador de acción */}
                  <View style={styles.actionContainer}>
                    {isCurrentApplying ? (
                      <ActivityIndicator size="small" color="#38BDF8" />
                    ) : isApplicable ? (
                      <View style={[styles.usePill, { backgroundColor: item.badgeColor }]}>
                        <Text style={styles.usePillText}>Curar</Text>
                      </View>
                    ) : (
                      <Text style={styles.ineligibleText}>
                        {isFull ? 'Salud Max' : 'Requiere Revivir'}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
          />

          {/* Botón de Cierre */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeButtonText}>Cancelar</Text>
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
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemEmoji: {
    fontSize: 36,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  itemDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  promptText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38BDF8',
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 16,
  },
  pokemonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  applicableRow: {
    borderColor: '#38BDF8',
  },
  dimmedRow: {
    opacity: 0.5,
  },
  thumbnail: {
    width: 48,
    height: 48,
    marginRight: 12,
  },
  rowDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  rowName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  rowCp: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38BDF8',
  },
  miniHealthTrack: {
    height: 6,
    backgroundColor: '#0F172A',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  miniHealthFill: {
    height: '100%',
    borderRadius: 3,
  },
  hpLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  actionContainer: {
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 64,
  },
  usePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  usePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  ineligibleText: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  closeButton: {
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
});
