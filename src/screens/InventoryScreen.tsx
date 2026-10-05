import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import type { InventoryScreenProps } from '../types/navigation';
import type {
  EnrichedCapturedPokemon,
  InventoryItemView,
  ConsumableItemMetadata,
} from '../types/inventory';
import {
  fetchCapturedPokemonCollection,
  fetchInventoryItemsDetailed,
  transferPokemonInstance,
  DEMO_USER_ID,
} from '../services/inventoryService';
import {
  fetchTrainerProfile,
  updateTrainerTeam,
} from '../services/playerProfileService';
import { TEAMS, type TrainerTeam } from '../types/battle';
import { TYPE_NAMES, TYPE_COLORS } from '../services/battleEngine';
import { PokemonDetailModal } from '../components/inventory/PokemonDetailModal';
import { ConsumableUseModal } from '../components/inventory/ConsumableUseModal';
import { TeamSelectionModal } from '../components/inventory/TeamSelectionModal';

type InventoryTab = 'pokedex' | 'backpack';
type SortOption = 'cp_desc' | 'cp_asc' | 'recent' | 'iv_desc' | 'number';

export const InventoryScreen: React.FC<InventoryScreenProps> = () => {
  const [activeTab, setActiveTab] = useState<InventoryTab>('pokedex');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Datos
  const [collection, setCollection] = useState<EnrichedCapturedPokemon[]>([]);
  const [backpackItems, setBackpackItems] = useState<InventoryItemView[]>([]);
  const [trainerTeam, setTrainerTeam] = useState<TrainerTeam>('mystic');

  // Filtros de Pokédex
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<number | null>(null); // null = Todos
  const [sortBy, setSortBy] = useState<SortOption>('cp_desc');

  // Modales
  const [selectedPokemon, setSelectedPokemon] = useState<EnrichedCapturedPokemon[] | null>(null);
  const [inspectPokemon, setInspectPokemon] = useState<EnrichedCapturedPokemon | null>(null);
  const [medicineItem, setMedicineItem] = useState<ConsumableItemMetadata | null>(null);
  const [showTeamModal, setShowTeamModal] = useState<boolean>(false);

  // Cargar datos
  const loadData = useCallback(async () => {
    try {
      const [collData, itemsData, profile] = await Promise.all([
        fetchCapturedPokemonCollection(DEMO_USER_ID),
        fetchInventoryItemsDetailed(DEMO_USER_ID),
        fetchTrainerProfile(DEMO_USER_ID),
      ]);
      setCollection(collData);
      setBackpackItems(itemsData);
      setTrainerTeam(profile.team);
    } catch (e) {
      console.warn('Error cargando inventario y colección:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Manejador de cambio de equipo
  const handleSelectTeam = async (newTeam: TrainerTeam) => {
    setTrainerTeam(newTeam);
    await updateTrainerTeam(newTeam, DEMO_USER_ID);
    Alert.alert(
      '¡Equipo Actualizado!',
      `Te has unido al ${TEAMS[newTeam].name}.\nTus victorias en los gimnasios del campus transferirán el liderazgo a la bandera de tu equipo.`
    );
  };

  // Manejador de transferencia (eliminación atómica)
  const handleTransferPokemon = useCallback(async (instanceId: string) => {
    try {
      const res = await transferPokemonInstance(instanceId, DEMO_USER_ID);
      if (!res.success) {
        Alert.alert('No se pudo transferir', res.error || 'Ocurrió un error al transferir la criatura.');
        return;
      }
      setCollection(prev => prev.filter(p => p.id !== instanceId));
      setInspectPokemon(null);
      Alert.alert('¡Transferencia Exitosa!', res.message || 'El Pokémon fue entregado al Profesor Oak.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Error de conexión.');
    }
  }, []);

  // Filtrado y ordenamiento de criaturas
  const filteredCollection = useMemo(() => {
    let result = [...collection];

    // Filtro por texto (Nombre, Apodo o Número)
    if (searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        p =>
          p.base.name.toLowerCase().includes(query) ||
          (p.nickname && p.nickname.toLowerCase().includes(query)) ||
          String(p.pokemon_id).includes(query)
      );
    }

    // Filtro por Tipo elemental
    if (selectedType !== null) {
      result = result.filter(
        p =>
          p.base.type_primary_id === selectedType ||
          p.base.type_secondary_id === selectedType
      );
    }

    // Ordenamiento
    result.sort((a, b) => {
      switch (sortBy) {
        case 'cp_desc':
          return b.cp - a.cp;
        case 'cp_asc':
          return a.cp - b.cp;
        case 'recent':
          return new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime();
        case 'iv_desc':
          return b.appraisal.totalIV - a.appraisal.totalIV;
        case 'number':
          return a.pokemon_id - b.pokemon_id;
        default:
          return b.cp - a.cp;
      }
    });

    return result;
  }, [collection, searchQuery, selectedType, sortBy]);

  // Conteo de Pokédex única registrada
  const uniqueRegisteredCount = useMemo(() => {
    const ids = new Set(collection.map(p => p.pokemon_id));
    return ids.size;
  }, [collection]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Barra Superior con Controles de Pestañas y Badge de Equipo */}
      <View style={styles.topBar}>
        <View style={styles.topHeaderRow}>
          <View style={styles.segmentedControl}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'pokedex' && styles.activeTabButton]}
              onPress={() => setActiveTab('pokedex')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'pokedex' && styles.activeTabText]}>
                📖 Pokédex ({collection.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'backpack' && styles.activeTabButton]}
              onPress={() => setActiveTab('backpack')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'backpack' && styles.activeTabText]}>
                🎒 Mochila
              </Text>
            </TouchableOpacity>
          </View>

          {/* Insignia Interactiva de Equipo de Entrenador */}
          <TouchableOpacity
            style={[styles.teamBadgeBtn, { borderColor: TEAMS[trainerTeam].color }]}
            onPress={() => setShowTeamModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.teamBadgeEmoji}>{TEAMS[trainerTeam].badge}</Text>
            <Text style={[styles.teamBadgeText, { color: TEAMS[trainerTeam].accentColor }]}>
              {trainerTeam.toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Contenido según pestaña */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loadingText}>Cargando inventario de Supabase...</Text>
        </View>
      ) : activeTab === 'pokedex' ? (
        <View style={styles.tabContent}>
          {/* Header Resumen de Pokédex */}
          <View style={styles.pokedexSummaryBar}>
            <Text style={styles.summaryTitle}>
              Especies Registradas:{' '}
              <Text style={styles.summaryHighlight}>{uniqueRegisteredCount} / 151</Text>
            </Text>
            <Text style={styles.summaryTotal}>Total: {collection.length} criaturas</Text>
          </View>

          {/* Barra de Búsqueda y Orden */}
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nombre o número..."
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
          </View>

          {/* Selector de Chips de Tipos Elementales */}
          <View style={styles.typesFilterWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typesFilterScroll}>
              <TouchableOpacity
                style={[styles.typeFilterChip, selectedType === null && styles.activeTypeFilterChip]}
                onPress={() => setSelectedType(null)}
                activeOpacity={0.7}
              >
                <Text style={[styles.typeFilterText, selectedType === null && styles.activeTypeFilterText]}>
                  Todos
                </Text>
              </TouchableOpacity>
              {Object.entries(TYPE_NAMES).map(([idStr, name]) => {
                const typeId = Number(idStr);
                const isSelected = selectedType === typeId;
                const color = TYPE_COLORS[typeId] || '#64748B';
                return (
                  <TouchableOpacity
                    key={typeId}
                    style={[
                      styles.typeFilterChip,
                      isSelected && { backgroundColor: color, borderColor: color },
                    ]}
                    onPress={() => setSelectedType(isSelected ? null : typeId)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.typeFilterText, isSelected && styles.activeTypeFilterText]}>
                      {name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Barra de Ordenamiento Rápido */}
          <View style={styles.sortRow}>
            <Text style={styles.sortLabel}>Ordenar:</Text>
            <TouchableOpacity
              style={[styles.sortBadge, sortBy === 'cp_desc' && styles.activeSortBadge]}
              onPress={() => setSortBy('cp_desc')}
            >
              <Text style={[styles.sortText, sortBy === 'cp_desc' && styles.activeSortText]}>
                Mayor CP
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortBadge, sortBy === 'iv_desc' && styles.activeSortBadge]}
              onPress={() => setSortBy('iv_desc')}
            >
              <Text style={[styles.sortText, sortBy === 'iv_desc' && styles.activeSortText]}>
                Mejor IV%
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortBadge, sortBy === 'recent' && styles.activeSortBadge]}
              onPress={() => setSortBy('recent')}
            >
              <Text style={[styles.sortText, sortBy === 'recent' && styles.activeSortText]}>
                Recientes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortBadge, sortBy === 'number' && styles.activeSortBadge]}
              onPress={() => setSortBy('number')}
            >
              <Text style={[styles.sortText, sortBy === 'number' && styles.activeSortText]}>
                N.º Pokédex
              </Text>
            </TouchableOpacity>
          </View>

          {/* Grilla de Criaturas Capturadas */}
          <FlatList
            data={filteredCollection}
            keyExtractor={item => item.id}
            numColumns={3}
            contentContainerStyle={styles.pokemonGrid}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#38BDF8" />
            }
            ListEmptyComponent={
              <View style={styles.emptyGridContainer}>
                <Text style={styles.emptyGridEmoji}>🔍</Text>
                <Text style={styles.emptyGridTitle}>No se encontraron criaturas</Text>
                <Text style={styles.emptyGridDesc}>
                  {collection.length === 0
                    ? 'Aún no has capturado ningún Pokémon. Explora el campus y lanza Pokéballs.'
                    : 'Intenta ajustar los filtros de búsqueda o tipo.'}
                </Text>
              </View>
            }
            renderItem={({ item: p }) => {
              const hpPercent = Math.max(0, Math.min(100, (p.current_hp / p.maxHp) * 100));
              const isFainted = p.current_hp <= 0;

              return (
                <TouchableOpacity
                  style={[styles.pokemonCard, isFainted && styles.faintedCard]}
                  activeOpacity={0.75}
                  onPress={() => setInspectPokemon(p)}
                >
                  {/* Badge de CP */}
                  <View style={styles.cardCpBadge}>
                    <Text style={styles.cardCpText}>CP {p.cp}</Text>
                  </View>

                  {/* Sprite Animado Gen 5 */}
                  <Image
                    source={{
                      uri:
                        p.base.animation_url ||
                        `https://img.pokemondb.net/sprites/black-white/anim/normal/${p.base.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.gif`,
                    }}
                    style={styles.cardSprite}
                    contentFit="contain"
                  />

                  {/* Nombre y Número / Apodo */}
                  <Text style={styles.cardName} numberOfLines={1}>
                    {p.nickname || p.base.name}
                  </Text>
                  {p.nickname && p.nickname !== p.base.name ? (
                    <Text style={styles.cardSpeciesSubtitle} numberOfLines={1}>
                      {p.base.name}
                    </Text>
                  ) : (
                    <Text style={styles.cardNumber}>#{String(p.pokemon_id).padStart(3, '0')}</Text>
                  )}

                  {/* Barra de Salud o Estado Debilitado */}
                  {isFainted ? (
                    <View style={styles.faintedBadge}>
                      <Text style={styles.faintedBadgeText}>💀 0 PS</Text>
                    </View>
                  ) : (
                    <View style={styles.cardHealthTrack}>
                      <View
                        style={[
                          styles.cardHealthFill,
                          {
                            width: `${hpPercent}%`,
                            backgroundColor:
                              hpPercent > 50 ? '#10B981' : hpPercent > 20 ? '#F59E0B' : '#EF4444',
                          },
                        ]}
                      />
                    </View>
                  )}

                  {/* Distintivo de IV Appraisal */}
                  <View style={styles.cardAppraisalRow}>
                    {p.appraisal.isPerfect ? (
                      <Text style={styles.cardHundoText}>👑 100%</Text>
                    ) : (
                      <Text style={[styles.cardStarsText, { color: p.appraisal.badgeColor }]}>
                        {'⭐'.repeat(p.appraisal.stars) || '0⭐'} {p.appraisal.overallPercentage}%
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      ) : (
        /* Pestaña Mochila de Objetos */
        <View style={styles.tabContent}>
          <FlatList
            data={backpackItems}
            keyExtractor={item => item.itemType}
            contentContainerStyle={styles.backpackList}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#38BDF8" />
            }
            renderItem={({ item }) => {
              const isMedicine = item.metadata.category === 'medicine';
              const hasStock = item.quantity > 0;

              return (
                <View style={styles.backpackCard}>
                  <View style={[styles.itemIconBadge, { backgroundColor: item.metadata.badgeColor }]}>
                    <Text style={styles.itemEmoji}>{item.metadata.iconEmoji}</Text>
                  </View>

                  <View style={styles.itemInfo}>
                    <View style={styles.itemNameRow}>
                      <Text style={styles.itemName}>{item.metadata.name}</Text>
                      <View style={styles.itemQuantityBadge}>
                        <Text style={styles.itemQuantityText}>x{item.quantity}</Text>
                      </View>
                    </View>
                    <Text style={styles.itemDesc}>{item.metadata.description}</Text>

                    {/* Botón de Acción para Medicina */}
                    {isMedicine && (
                      <TouchableOpacity
                        style={[
                          styles.useMedicineButton,
                          { backgroundColor: hasStock ? item.metadata.badgeColor : '#334155' },
                        ]}
                        disabled={!hasStock}
                        activeOpacity={0.8}
                        onPress={() => setMedicineItem(item.metadata)}
                      >
                        <Text style={styles.useMedicineText}>
                          {hasStock ? '💊 Usar Medicina' : 'Sin existencias'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            }}
          />
        </View>
      )}

      {/* Modal de Detalle de Pokémon: Base vs IVs y Transferencia */}
      <PokemonDetailModal
        visible={!!inspectPokemon}
        pokemon={inspectPokemon}
        onClose={() => setInspectPokemon(null)}
        onTransfer={handleTransferPokemon}
      />

      {/* Modal para Aplicar Poción o Revivir */}
      <ConsumableUseModal
        visible={!!medicineItem}
        item={medicineItem}
        capturedPokemon={collection}
        onClose={() => setMedicineItem(null)}
        onItemUsedSuccess={() => {
          loadData();
          setMedicineItem(null);
        }}
      />

      {/* Modal para Elegir Equipo de Entrenador */}
      <TeamSelectionModal
        visible={showTeamModal}
        currentTeam={trainerTeam}
        onClose={() => setShowTeamModal(false)}
        onSelectTeam={handleSelectTeam}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  segmentedControl: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 4,
  },
  teamBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  teamBadgeEmoji: {
    fontSize: 16,
  },
  teamBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardSpeciesSubtitle: {
    fontSize: 10,
    color: '#38BDF8',
    fontWeight: '600',
    marginBottom: 4,
  },
  faintedBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EF4444',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  faintedBadgeText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '800',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTabButton: {
    backgroundColor: '#38BDF8',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
  },
  activeTabText: {
    color: '#0F172A',
  },
  tabContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 12,
  },
  pokedexSummaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  summaryTitle: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  summaryHighlight: {
    color: '#38BDF8',
    fontWeight: '800',
  },
  summaryTotal: {
    fontSize: 12,
    color: '#F8FAFC',
    fontWeight: '700',
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  searchInput: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
  },
  typesFilterWrapper: {
    paddingVertical: 6,
  },
  typesFilterScroll: {
    paddingHorizontal: 16,
    gap: 6,
  },
  typeFilterChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeTypeFilterChip: {
    backgroundColor: '#38BDF8',
    borderColor: '#38BDF8',
  },
  typeFilterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  activeTypeFilterText: {
    color: '#FFFFFF',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 6,
  },
  sortLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  sortBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  activeSortBadge: {
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  sortText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  activeSortText: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  pokemonGrid: {
    paddingHorizontal: 10,
    paddingBottom: 24,
  },
  pokemonCard: {
    flex: 1 / 3,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    margin: 5,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  faintedCard: {
    opacity: 0.6,
    borderColor: '#EF4444',
  },
  cardCpBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 4,
  },
  cardCpText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38BDF8',
  },
  cardSprite: {
    width: 60,
    height: 60,
    marginVertical: 4,
  },
  cardName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  cardNumber: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 4,
  },
  cardHealthTrack: {
    width: '100%',
    height: 4,
    backgroundColor: '#0F172A',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  cardHealthFill: {
    height: '100%',
  },
  cardAppraisalRow: {
    marginTop: 2,
  },
  cardStarsText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardHundoText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EC4899',
  },
  emptyGridContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyGridEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyGridTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  emptyGridDesc: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  backpackList: {
    padding: 16,
    paddingBottom: 32,
  },
  backpackCard: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  itemIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  itemEmoji: {
    fontSize: 26,
  },
  itemInfo: {
    flex: 1,
  },
  itemNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  itemQuantityBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  itemQuantityText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38BDF8',
  },
  itemDesc: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
    marginBottom: 6,
  },
  useMedicineButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 4,
  },
  useMedicineText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
