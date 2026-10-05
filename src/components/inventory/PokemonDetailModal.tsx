import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import type { EnrichedCapturedPokemon } from '../../types/inventory';
import { TYPE_NAMES, TYPE_COLORS } from '../../services/battleEngine';

interface PokemonDetailModalProps {
  visible: boolean;
  pokemon: EnrichedCapturedPokemon | null;
  onClose: () => void;
}

export const PokemonDetailModal: React.FC<PokemonDetailModalProps> = ({
  visible,
  pokemon,
  onClose,
}) => {
  if (!pokemon) return null;

  const { base, appraisal, stats, fastMove, chargedMove } = pokemon;
  const primaryTypeColor = TYPE_COLORS[base.type_primary_id] || '#64748B';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header con número, nombre y botón de cierre */}
          <View style={styles.header}>
            <View>
              <Text style={styles.pokedexNumber}>
                #{String(pokemon.pokemon_id).padStart(3, '0')}
              </Text>
              <Text style={styles.pokemonName}>{base.name}</Text>
            </View>
            <View style={styles.cpBadge}>
              <Text style={styles.cpLabel}>CP</Text>
              <Text style={styles.cpValue}>{pokemon.cp}</Text>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Sprite animado Gen 5 */}
            <View style={styles.spriteWrapper}>
              <View style={[styles.haloBackground, { backgroundColor: primaryTypeColor }]} />
              <Image
                source={{
                  uri:
                    base.animation_url ||
                    `https://img.pokemondb.net/sprites/black-white/anim/normal/${base.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.gif`,
                }}
                style={styles.sprite}
                contentFit="contain"
                transition={200}
              />
            </View>

            {/* Badges de Tipos */}
            <View style={styles.typesRow}>
              <View
                style={[
                  styles.typePill,
                  { backgroundColor: TYPE_COLORS[base.type_primary_id] || '#64748B' },
                ]}
              >
                <Text style={styles.typeText}>{TYPE_NAMES[base.type_primary_id] || 'Normal'}</Text>
              </View>
              {base.type_secondary_id && (
                <View
                  style={[
                    styles.typePill,
                    { backgroundColor: TYPE_COLORS[base.type_secondary_id] || '#64748B' },
                  ]}
                >
                  <Text style={styles.typeText}>{TYPE_NAMES[base.type_secondary_id]}</Text>
                </View>
              )}
            </View>

            {/* Barra de Salud Actual vs Máxima */}
            <View style={styles.healthContainer}>
              <View style={styles.healthHeader}>
                <Text style={styles.healthLabel}>PS</Text>
                <Text style={styles.healthValue}>
                  {pokemon.current_hp} / {pokemon.maxHp} PS
                </Text>
              </View>
              <View style={styles.healthBarTrack}>
                <View
                  style={[
                    styles.healthBarFill,
                    {
                      width: `${Math.max(0, Math.min(100, (pokemon.current_hp / pokemon.maxHp) * 100))}%`,
                      backgroundColor:
                        pokemon.current_hp / pokemon.maxHp > 0.5
                          ? '#10B981'
                          : pokemon.current_hp / pokemon.maxHp > 0.2
                          ? '#F59E0B'
                          : '#EF4444',
                    },
                  ]}
                />
              </View>
            </View>

            {/* Tarjeta de Valoración Appraisal (Estrellas y Perfección) */}
            <View style={[styles.appraisalCard, { borderColor: appraisal.badgeColor }]}>
              <View style={styles.appraisalTopRow}>
                <Text style={styles.appraisalTitle}>Valoración del Entrenador</Text>
                <View style={styles.starsContainer}>
                  {appraisal.isPerfect ? (
                    <Text style={styles.hundoText}>👑 ¡100% PERFECTO!</Text>
                  ) : (
                    Array.from({ length: 3 }).map((_, idx) => (
                      <Text
                        key={idx}
                        style={[
                          styles.starEmoji,
                          { opacity: idx < appraisal.stars ? 1.0 : 0.25 },
                        ]}
                      >
                        ⭐
                      </Text>
                    ))
                  )}
                </View>
              </View>
              <Text style={styles.appraisalSummary}>{appraisal.summaryText}</Text>
              <Text style={[styles.ivPercentageText, { color: appraisal.badgeColor }]}>
                Potencial Genético: {appraisal.overallPercentage}% ({appraisal.totalIV}/45 IVs)
              </Text>
            </View>

            {/* Desglose Comparativo: Estadísticas Base vs. IVs Obtenidos */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Estadísticas Base vs. IVs Obtenidos</Text>
              <Text style={styles.sectionSubtitle}>
                El potencial genético individual (0 a 15) se suma a la estadística base de la especie.
              </Text>

              {/* Barra de Ataque */}
              <View style={styles.statRow}>
                <View style={styles.statLabelRow}>
                  <Text style={styles.statName}>⚔️ Ataque</Text>
                  <Text style={styles.statValues}>
                    Base: {stats.attack.baseValue} + <Text style={styles.ivHighlight}>IV: +{stats.attack.ivValue}</Text> = {stats.attack.effectiveValue}
                  </Text>
                </View>
                <View style={styles.multiBarTrack}>
                  <View
                    style={[
                      styles.baseBarSegment,
                      { width: `${Math.min(70, (stats.attack.baseValue / 200) * 70)}%` },
                    ]}
                  />
                  <View
                    style={[
                      styles.ivBarSegment,
                      { width: `${(stats.attack.ivValue / 15) * 30}%` },
                    ]}
                  />
                </View>
              </View>

              {/* Barra de Defensa */}
              <View style={styles.statRow}>
                <View style={styles.statLabelRow}>
                  <Text style={styles.statName}>🛡️ Defensa</Text>
                  <Text style={styles.statValues}>
                    Base: {stats.defense.baseValue} + <Text style={styles.ivHighlight}>IV: +{stats.defense.ivValue}</Text> = {stats.defense.effectiveValue}
                  </Text>
                </View>
                <View style={styles.multiBarTrack}>
                  <View
                    style={[
                      styles.baseBarSegment,
                      { width: `${Math.min(70, (stats.defense.baseValue / 200) * 70)}%` },
                    ]}
                  />
                  <View
                    style={[
                      styles.ivBarSegment,
                      { width: `${(stats.defense.ivValue / 15) * 30}%` },
                    ]}
                  />
                </View>
              </View>

              {/* Barra de PS */}
              <View style={styles.statRow}>
                <View style={styles.statLabelRow}>
                  <Text style={styles.statName}>❤️ PS</Text>
                  <Text style={styles.statValues}>
                    Base: {stats.hp.baseValue} + <Text style={styles.ivHighlight}>IV: +{stats.hp.ivValue}</Text> = {stats.hp.effectiveValue}
                  </Text>
                </View>
                <View style={styles.multiBarTrack}>
                  <View
                    style={[
                      styles.baseBarSegment,
                      { width: `${Math.min(70, (stats.hp.baseValue / 200) * 70)}%` },
                    ]}
                  />
                  <View
                    style={[
                      styles.ivBarSegment,
                      { width: `${(stats.hp.ivValue / 15) * 30}%` },
                    ]}
                  />
                </View>
              </View>

              {/* Leyenda explicativa de barras */}
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendBox, { backgroundColor: '#334155' }]} />
                  <Text style={styles.legendText}>Estadística Base</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendBox, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.legendText}>Bono IV (0-15)</Text>
                </View>
              </View>
            </View>

            {/* Ficha de Movimientos Asignados */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Movimientos de Combate</Text>

              {/* Movimiento Rápido */}
              <View style={styles.moveCard}>
                <View style={styles.moveTopRow}>
                  <View style={styles.moveCategoryBadge}>
                    <Text style={styles.moveCategoryText}>RÁPIDO</Text>
                  </View>
                  <Text style={styles.moveName}>{fastMove.name}</Text>
                  <View
                    style={[
                      styles.moveTypeBadge,
                      { backgroundColor: TYPE_COLORS[fastMove.type_id] || '#64748B' },
                    ]}
                  >
                    <Text style={styles.moveTypeText}>{TYPE_NAMES[fastMove.type_id]}</Text>
                  </View>
                </View>
                <Text style={styles.moveStats}>
                  Potencia: {fastMove.power} | Energía: +{fastMove.energy_delta} | Duración: {fastMove.duration_ms}ms
                </Text>
              </View>

              {/* Movimiento Cargado */}
              <View style={styles.moveCard}>
                <View style={styles.moveTopRow}>
                  <View style={[styles.moveCategoryBadge, styles.chargedCategoryBadge]}>
                    <Text style={styles.moveCategoryText}>CARGADO</Text>
                  </View>
                  <Text style={styles.moveName}>{chargedMove.name}</Text>
                  <View
                    style={[
                      styles.moveTypeBadge,
                      { backgroundColor: TYPE_COLORS[chargedMove.type_id] || '#64748B' },
                    ]}
                  >
                    <Text style={styles.moveTypeText}>{TYPE_NAMES[chargedMove.type_id]}</Text>
                  </View>
                </View>
                <Text style={styles.moveStats}>
                  Potencia: {chargedMove.power} | Costo Energía: {Math.abs(chargedMove.energy_delta)} | Duración: {chargedMove.duration_ms}ms
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Botón de Cierre */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeButtonText}>Cerrar Ficha</Text>
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
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pokedexNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
  },
  pokemonName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  cpBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  cpLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
    marginRight: 4,
  },
  cpValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  scrollContent: {
    paddingBottom: 16,
  },
  spriteWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    height: 140,
  },
  haloBackground: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.25,
  },
  sprite: {
    width: 120,
    height: 120,
  },
  typesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  typePill: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  healthContainer: {
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  healthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  healthLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  healthValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  healthBarTrack: {
    height: 10,
    backgroundColor: '#0F172A',
    borderRadius: 5,
    overflow: 'hidden',
  },
  healthBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  appraisalCard: {
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 14,
  },
  appraisalTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  appraisalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starEmoji: {
    fontSize: 16,
    marginLeft: 2,
  },
  hundoText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EC4899',
  },
  appraisalSummary: {
    fontSize: 13,
    color: '#CBD5E1',
    marginBottom: 6,
  },
  ivPercentageText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 12,
  },
  statRow: {
    marginBottom: 12,
  },
  statLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  statName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  statValues: {
    fontSize: 11,
    color: '#94A3B8',
  },
  ivHighlight: {
    color: '#F59E0B',
    fontWeight: '700',
  },
  multiBarTrack: {
    height: 8,
    backgroundColor: '#0F172A',
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  baseBarSegment: {
    height: '100%',
    backgroundColor: '#475569',
  },
  ivBarSegment: {
    height: '100%',
    backgroundColor: '#F59E0B',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendBox: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  moveCard: {
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  moveTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  moveCategoryBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  chargedCategoryBadge: {
    backgroundColor: '#8B5CF6',
  },
  moveCategoryText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  moveName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    flex: 1,
    marginLeft: 8,
  },
  moveTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  moveTypeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  moveStats: {
    fontSize: 11,
    color: '#94A3B8',
  },
  closeButton: {
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
});
