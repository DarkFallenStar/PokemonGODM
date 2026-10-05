import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MapboxGL from '@rnmapbox/maps';
import { useLocationTracker } from '../hooks/useLocationTracker';
import { useHeadingTracker } from '../hooks/useHeadingTracker';
import {
  CAMPUS_CENTER_COORDINATE,
  getGeofenceGeoJSON,
  isTestZoneEnabled,
} from '../utils/geofence';
import { calculateHaversineDistanceWorklet } from '../utils/haversine';
import { OutOfBoundsModal } from '../components/OutOfBoundsModal';
import { MapAvatarMarker } from '../components/MapAvatarMarker';
import { PokestopModal } from '../components/PokestopModal';
import { GymModal } from '../components/GymModal';
import { WildPokemonMarker } from '../components/WildPokemonMarker';
import { SpawnEncounterModal } from '../components/SpawnEncounterModal';
import { supabase } from '../services/supabase';
import { checkPokestopCooldown } from '../services/inventoryService';
import {
  seedWildSpawnsIfLow,
  fetchNearbySpawns,
  spawnPokemonNearPlayer,
} from '../services/spawnEngine';
import type { CampusPOIMarker } from '../types/map';
import type { ActiveSpawn } from '../types/spawns';
import type { RootStackParamList } from '../types/navigation';

const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
if (mapboxToken) {
  MapboxGL.setAccessToken(mapboxToken);
}

export const MapScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const testZoneActive = isTestZoneEnabled();

  const {
    location,
    isInsideGeofence,
    isLoading: isLoadingLocation,
    isMocked,
    mockMode,
    toggleMockLocation,
  } = useLocationTracker();

  const { heading } = useHeadingTracker();

  const [pois, setPois] = useState<CampusPOIMarker[]>([]);
  const [activeSpawns, setActiveSpawns] = useState<ActiveSpawn[]>([]);
  const [cooldownMap, setCooldownMap] = useState<Record<string, boolean>>({});
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [justRefreshed, setJustRefreshed] = useState<boolean>(false);

  // Estados de Modales interactivos
  const [selectedPokestop, setSelectedPokestop] = useState<CampusPOIMarker | null>(null);
  const [selectedGym, setSelectedGym] = useState<CampusPOIMarker | null>(null);
  const [selectedSpawn, setSelectedSpawn] = useState<ActiveSpawn | null>(null);

  // GeoJSON según entorno (Solo UniSabana o UniSabana + Cajicá)
  const geofenceGeoJSON = useMemo(() => getGeofenceGeoJSON(testZoneActive), [testZoneActive]);

  // Coordenada activa (real o campus por defecto mientras carga GPS)
  const currentCoords = location || CAMPUS_CENTER_COORDINATE;

  // Cargar Poképaradas y Gimnasios desde Supabase
  const loadCampusPOIs = useCallback(async () => {
    try {
      let stopsQuery = supabase.from('pokestops').select('id, name, latitude, longitude, is_test_zone');
      let gymsQuery = supabase.from('gymnasiums').select(`
        id, name, latitude, longitude, is_test_zone, current_team, defending_instance_id,
        defender:captured_instances(
          id, nickname, cp, current_hp, iv_hp, iv_attack, iv_defense, fast_move_id, charged_move_id, user_id,
          base:pokemon_base(id, name, sprite_url, animation_url, base_hp, base_attack, base_defense, type_primary_id, type_secondary_id)
        )
      `);

      // Si el modo de pruebas está apagado, filtrar estrictamente solo los POIs de UniSabana
      if (!testZoneActive) {
        stopsQuery = stopsQuery.eq('is_test_zone', false);
        gymsQuery = gymsQuery.eq('is_test_zone', false);
      }

      const [stopsRes, gymsRes] = await Promise.all([stopsQuery, gymsQuery]);
      const loadedPOIs: CampusPOIMarker[] = [];

      if (stopsRes.data) {
        for (const s of stopsRes.data) {
          loadedPOIs.push({
            id: s.id,
            name: s.name,
            type: 'pokestop',
            latitude: s.latitude,
            longitude: s.longitude,
          });
        }
      }

      if (gymsRes.data) {
        for (const g of gymsRes.data as any[]) {
          let defenderInfo: any = null;
          if (g.defender) {
            const d = g.defender;
            const b = d.base;
            const maxHp = (b?.base_hp ? b.base_hp * 2 : 100) + (d.iv_hp || 10) + 50;
            defenderInfo = {
              instance_id: d.id,
              nickname: d.nickname || null,
              name: b?.name || 'Pokémon',
              pokemon_id: b?.id || 1,
              cp: d.cp,
              current_hp: d.current_hp ?? maxHp,
              max_hp: maxHp,
              sprite_url: b?.sprite_url || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${b?.id || 1}.png`,
              animation_url: b?.animation_url || null,
              trainer_name: d.user_id === '00000000-0000-0000-0000-000000000099' ? 'Líder del Gimnasio' : 'Entrenador UniSabana',
              types: [b?.type_primary_id, b?.type_secondary_id].filter(Boolean),
              base_attack: b?.base_attack,
              base_defense: b?.base_defense,
              base_hp: b?.base_hp,
              iv_attack: d.iv_attack,
              iv_defense: d.iv_defense,
              iv_hp: d.iv_hp,
              fast_move_id: d.fast_move_id,
              charged_move_id: d.charged_move_id,
            };
          }

          loadedPOIs.push({
            id: g.id,
            name: g.name,
            type: 'gym',
            latitude: g.latitude,
            longitude: g.longitude,
            current_team: g.current_team,
            defending_instance_id: g.defending_instance_id,
            defender: defenderInfo,
          });
        }
      }

      setPois(loadedPOIs);
      setSelectedGym(prev => {
        if (!prev) return null;
        const updated = loadedPOIs.find(p => p.id === prev.id);
        return updated || prev;
      });
    } catch (e) {
      console.warn('Error cargando POIs de Supabase:', e);
    }
  }, [testZoneActive]);

  // Actualizar estados de enfriamiento de Poképaradas
  const refreshCooldowns = useCallback(async () => {
    const newCooldowns: Record<string, boolean> = {};
    for (const poi of pois) {
      if (poi.type === 'pokestop') {
        const { canSpin } = await checkPokestopCooldown(poi.id);
        newCooldowns[poi.id] = !canSpin; // true si está en cooldown
      }
    }
    setCooldownMap(newCooldowns);
  }, [pois]);

  // Ciclo de vida inicial: Cargar POIs
  useEffect(() => {
    loadCampusPOIs();
  }, [loadCampusPOIs]);

  // Recargar POIs cada vez que el mapa vuelve a estar en foco
  useFocusEffect(
    useCallback(() => {
      loadCampusPOIs();
    }, [loadCampusPOIs])
  );

  // Refrescar cooldowns cuando cambien los POIs
  useEffect(() => {
    if (pois.length > 0) {
      refreshCooldowns();
    }
  }, [pois, refreshCooldowns]);

  // Sincronización del Motor de Spawns
  // Sincronización del Motor de Spawns y recarga de POIs al enfocar el mapa
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      // Recargar POIs (refleja cambios inmediatos en el liderazgo de gimnasios)
      loadCampusPOIs();

      async function syncSpawns() {
        // 1. Sembrar spawns si hay pocos (y purgar caducados/inactivos)
        await seedWildSpawnsIfLow(testZoneActive);

        // 2. Consultar y evaluar proximidad a 30 metros con Haversine
        const nearby = await fetchNearbySpawns(currentCoords, testZoneActive);
        if (isMounted) {
          setActiveSpawns(nearby);
        }
      }

      syncSpawns();
      const interval = setInterval(syncSpawns, 10000); // Cada 10 segundos

      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }, [currentCoords, testZoneActive, loadCampusPOIs])
  );

  // Distancia calculada con Worklet de Haversine para la Poképarada seleccionada
  const selectedPokestopDistance = useMemo(() => {
    if (!selectedPokestop) return 999;
    return Math.round(
      calculateHaversineDistanceWorklet(currentCoords, {
        latitude: selectedPokestop.latitude,
        longitude: selectedPokestop.longitude,
      })
    );
  }, [selectedPokestop, currentCoords]);

  // Distancia calculada con Worklet de Haversine para el Gimnasio seleccionado
  const selectedGymDistance = useMemo(() => {
    if (!selectedGym) return 999;
    return Math.round(
      calculateHaversineDistanceWorklet(currentCoords, {
        latitude: selectedGym.latitude,
        longitude: selectedGym.longitude,
      })
    );
  }, [selectedGym, currentCoords]);

  // Manejador de encuentro salvaje: Transición fluida a la pantalla de Captura AR
  const handleStartCapture = (spawn: ActiveSpawn) => {
    setSelectedSpawn(null);
    // Remover optimísticamente la criatura seleccionada para que no aparezca duplicada
    setActiveSpawns(prev => prev.filter(s => s.id !== spawn.id));
    navigation.navigate('Capture', { spawn });
  };

  // Manejador de desafío a gimnasio dentro del radio de 40m
  const handleChallengeGym = useCallback((gym: CampusPOIMarker) => {
    setSelectedGym(null);
    navigation.navigate('GymBattle', {
      gymId: gym.id,
      gymName: gym.name,
      initialTeam: (gym.current_team as any) || 'neutral',
      distanceMeters: selectedGymDistance,
      defender: gym.defender,
    });
  }, [navigation, selectedGymDistance]);

  // Manejador de actualización manual del mapa (recarga POIs, cooldowns y spawns sin reiniciar)
  const handleManualRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setJustRefreshed(false);
    try {
      await Promise.all([
        loadCampusPOIs(),
        refreshCooldowns(),
        seedWildSpawnsIfLow(testZoneActive),
      ]);
      const nearby = await fetchNearbySpawns(currentCoords, testZoneActive);
      setActiveSpawns(nearby);

      setJustRefreshed(true);
      setTimeout(() => setJustRefreshed(false), 2000);
    } catch (e) {
      console.warn('Error al actualizar el mapa:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadCampusPOIs, refreshCooldowns, testZoneActive, currentCoords, isRefreshing]);

  // Manejador de cooldown optimista cuando se gira una Poképarada
  const handlePokestopSpun = useCallback((stopId: string) => {
    // 1. Cambio visual optimista e instantáneo a Púrpura en memoria
    setCooldownMap(prev => ({ ...prev, [stopId]: true }));
    // 2. Sincronizar en segundo plano con Supabase
    refreshCooldowns();
  }, [refreshCooldowns]);

  // Manejador de Debug: Crear criatura salvaje cerca del jugador (entre 8 y 16m)
  const [isSpawningDebug, setIsSpawningDebug] = useState<boolean>(false);

  const handleDebugSpawn = useCallback(async () => {
    if (isSpawningDebug) return;
    setIsSpawningDebug(true);
    try {
      const newSpawn = await spawnPokemonNearPlayer(currentCoords, testZoneActive);
      if (newSpawn) {
        // Inyectar inmediatamente en el mapa
        setActiveSpawns(prev => [newSpawn, ...prev.filter(s => s.id !== newSpawn.id)]);
        Alert.alert(
          '¡Criatura Aparecida!',
          `Apareció un ${newSpawn.pokemon?.name || 'Pokémon'} salvaje (CP ${newSpawn.cp}) a ${newSpawn.distance_meters}m de ti.\n\nToca su sprite en el mapa para iniciar captura.`,
          [{ text: '¡Entendido!' }]
        );
      } else {
        Alert.alert('Aviso', 'No se pudo generar la criatura. Verifica tu conexión.');
      }
    } catch (e) {
      console.warn('Error en handleDebugSpawn:', e);
    } finally {
      setIsSpawningDebug(false);
    }
  }, [currentCoords, testZoneActive, isSpawningDebug]);

  if (!mapboxToken) {
    return (
      <View style={[styles.missingTokenContainer, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.missingTokenTitle}>🗺️ Token de Mapbox Requerido</Text>
        <Text style={styles.missingTokenText}>
          Mapbox nativo requiere un Access Token público para inicializar los mapas vectoriales.
        </Text>
        <View style={styles.codeBox}>
          <Text style={styles.codeText}>EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ...</Text>
        </View>
        <Text style={styles.missingTokenHint}>
          Agrega esta variable a tu archivo .env y reinicia el servidor Metro.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Mapa Vectorial Nativo de Mapbox */}
      <MapboxGL.MapView
        style={styles.map}
        styleURL={MapboxGL.StyleURL.Dark}
        scrollEnabled={isInsideGeofence}
        pitchEnabled={isInsideGeofence}
        rotateEnabled={isInsideGeofence}
        zoomEnabled={isInsideGeofence}
        compassEnabled={false}
        scaleBarEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <MapboxGL.Camera
          centerCoordinate={[currentCoords.longitude, currentCoords.latitude]}
          zoomLevel={16.2}
          animationMode="flyTo"
          animationDuration={1500}
        />

        {/* Polígonos Perimetrales de Geofencing */}
        <MapboxGL.ShapeSource id="campusGeofenceSource" shape={geofenceGeoJSON as any}>
          <MapboxGL.FillLayer
            id="campusGeofenceFill"
            style={{
              fillColor: '#38BDF8',
              fillOpacity: 0.12,
            }}
          />
          <MapboxGL.LineLayer
            id="campusGeofenceBorder"
            style={{
              lineColor: '#38BDF8',
              lineWidth: 2.5,
              lineDasharray: [2, 1],
            }}
          />
        </MapboxGL.ShapeSource>

        {/* Marcadores de Hitos: Poképaradas y Gimnasios (MarkerView interactivo reactivo a cooldown y equipos) */}
        {pois.map(poi => {
          const isStop = poi.type === 'pokestop';
          const inCooldown = isStop && !!cooldownMap[poi.id];
          const gymTeam = poi.current_team || 'neutral';
          const gymEmoji =
            gymTeam === 'mystic' ? '🦅' : gymTeam === 'valor' ? '🔥' : gymTeam === 'instinct' ? '⚡' : '⚪';
          const markerKey = `poi-${poi.id}-${isStop ? (inCooldown ? 'purple' : 'blue') : gymTeam}`;

          return (
            <MapboxGL.MarkerView
              key={markerKey}
              id={markerKey}
              coordinate={[poi.longitude, poi.latitude]}
              anchor={{ x: 0.5, y: 0.5 }}
              allowOverlap={true}
            >
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  if (isStop) {
                    setSelectedPokestop(poi);
                  } else {
                    setSelectedGym(poi);
                  }
                }}
                style={[
                  styles.poiBadge,
                  !isStop
                    ? gymTeam === 'valor'
                      ? styles.gymValorBadge
                      : gymTeam === 'instinct'
                      ? styles.gymInstinctBadge
                      : gymTeam === 'neutral'
                      ? styles.gymNeutralBadge
                      : styles.gymMysticBadge
                    : inCooldown
                    ? styles.stopCooldownBadge
                    : styles.stopBadge,
                ]}
              >
                <Text style={styles.poiEmoji}>
                  {!isStop ? (gymTeam === 'neutral' ? '🏟️' : gymEmoji) : inCooldown ? '🟣' : '🔵'}
                </Text>
              </TouchableOpacity>
            </MapboxGL.MarkerView>
          );
        })}

        {/* Criaturas Salvajes Visibles (Filtro Estricto: <= 30 metros del entrenador) */}
        {activeSpawns.map(spawn => (
          <WildPokemonMarker
            key={spawn.id}
            spawn={spawn}
            onPress={s => setSelectedSpawn(s)}
          />
        ))}

        {/* Marcador del Avatar del Jugador con Orientación Azimutal por Magnetómetro */}
        <MapboxGL.MarkerView
          id="userAvatarMarker"
          coordinate={[currentCoords.longitude, currentCoords.latitude]}
          anchor={{ x: 0.5, y: 0.5 }}
          allowOverlap={true}
        >
          <MapAvatarMarker heading={heading} />
        </MapboxGL.MarkerView>
      </MapboxGL.MapView>

      {/* Barra de Estado Superior HUD */}
      <View
        pointerEvents="box-none"
        style={[styles.hudOverlay, { top: Math.max(insets.top, 24) + 8 }]}
      >
        <View style={styles.hudCard}>
          <Text style={styles.hudTitle}>
            {testZoneActive ? '📍 UniSabana + Cajicá' : '📍 Campus UniSabana'}
          </Text>
          <Text style={styles.hudCoords}>
            {currentCoords.latitude.toFixed(5)}, {currentCoords.longitude.toFixed(5)} | {heading}°
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, isInsideGeofence ? styles.dotGreen : styles.dotRed]} />
            <Text style={styles.statusText}>
              {isInsideGeofence ? 'DENTRO DE ZONA' : 'FUERA DE LÍMITES'}
            </Text>
          </View>
        </View>

        {/* Acciones de la esquina superior derecha */}
        <View style={styles.hudActionsCol}>
          {/* Botón de alternancia de Simulación */}
          <TouchableOpacity
            style={[styles.simButton, isMocked && styles.simButtonActive]}
            onPress={toggleMockLocation}
            activeOpacity={0.8}
          >
            <Text style={styles.simButtonText}>
              {mockMode === 'campus'
                ? '📍 Campus'
                : mockMode === 'cajica'
                ? '📍 Cajicá'
                : '📍 GPS Real'}
            </Text>
          </TouchableOpacity>

          {/* Botón de Actualizar Mapa */}
          <TouchableOpacity
            style={[
              styles.refreshButton,
              justRefreshed && styles.refreshButtonSuccess,
            ]}
            onPress={handleManualRefresh}
            activeOpacity={0.8}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#38BDF8" />
            ) : (
              <Text
                style={[
                  styles.refreshButtonText,
                  justRefreshed && styles.refreshButtonTextSuccess,
                ]}
              >
                {justRefreshed ? '✓ Listo' : '🔄 Actualizar'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Botón de Debug: Crear Criatura Salvaje Cerca */}
          <TouchableOpacity
            style={[
              styles.debugSpawnButton,
              isSpawningDebug && styles.debugSpawnButtonActive,
            ]}
            onPress={handleDebugSpawn}
            activeOpacity={0.8}
            disabled={isSpawningDebug}
          >
            {isSpawningDebug ? (
              <ActivityIndicator size="small" color="#F59E0B" />
            ) : (
              <Text style={styles.debugSpawnButtonText}>🐾 Spawn Cerca</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Indicador de carga inicial */}
      {isLoadingLocation && !isMocked && !location && (
        <View style={[styles.loadingBox, { bottom: insets.bottom + 16 }]}>
          <ActivityIndicator size="small" color="#38BDF8" />
          <Text style={styles.loadingText}>Conectando GPS...</Text>
        </View>
      )}

      {/* Modal Bloqueante Persistente cuando el usuario sale del perímetro */}
      <OutOfBoundsModal
        visible={!isInsideGeofence}
        onRetry={() => {}}
        onSimulateCampus={toggleMockLocation}
      />

      {/* Modal Interactivo de Poképarada con Cooldown de 5 minutos */}
      <PokestopModal
        visible={!!selectedPokestop}
        pokestop={selectedPokestop}
        distanceMeters={selectedPokestopDistance}
        onClose={() => setSelectedPokestop(null)}
        onSpunSuccess={handlePokestopSpun}
      />

      {/* Modal Interactivo de Gimnasio con Radio de 40m */}
      <GymModal
        visible={!!selectedGym}
        gym={selectedGym}
        distanceMeters={selectedGymDistance}
        onClose={() => setSelectedGym(null)}
        onChallengeGym={handleChallengeGym}
      />

      {/* Modal de Encuentro con Pokémon Salvaje en Radio de 30m */}
      <SpawnEncounterModal
        visible={!!selectedSpawn}
        spawn={selectedSpawn}
        onClose={() => setSelectedSpawn(null)}
        onStartCapture={handleStartCapture}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  map: {
    flex: 1,
  },
  hudOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 30,
  },
  hudCard: {
    flex: 1,
    marginRight: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.90)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  hudTitle: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 12,
  },
  hudCoords: {
    color: '#94A3B8',
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dotGreen: {
    backgroundColor: '#22C55E',
  },
  dotRed: {
    backgroundColor: '#EF4444',
  },
  statusText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '600',
  },
  hudActionsCol: {
    gap: 6,
    alignItems: 'stretch',
  },
  simButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simButtonActive: {
    backgroundColor: '#0284C7',
    borderColor: '#FFFFFF',
  },
  simButtonText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  refreshButton: {
    backgroundColor: 'rgba(30, 41, 59, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
  },
  refreshButtonSuccess: {
    backgroundColor: '#064E3B',
    borderColor: '#22C55E',
  },
  refreshButtonText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  refreshButtonTextSuccess: {
    color: '#4ADE80',
  },
  debugSpawnButton: {
    backgroundColor: 'rgba(30, 41, 59, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
  },
  debugSpawnButtonActive: {
    backgroundColor: '#78350F',
    borderColor: '#FBBF24',
  },
  debugSpawnButtonText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
  },
  poiBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  stopBadge: {
    backgroundColor: '#2563EB',
  },
  stopCooldownBadge: {
    backgroundColor: '#7E22CE',
    borderColor: '#C084FC',
  },
  gymBadge: {
    backgroundColor: '#DC2626',
  },
  gymMysticBadge: {
    backgroundColor: '#2563EB',
    borderColor: '#93C5FD',
  },
  gymValorBadge: {
    backgroundColor: '#DC2626',
    borderColor: '#FCA5A5',
  },
  gymInstinctBadge: {
    backgroundColor: '#CA8A04',
    borderColor: '#FDE047',
  },
  gymNeutralBadge: {
    backgroundColor: '#475569',
    borderColor: '#94A3B8',
  },
  poiEmoji: {
    fontSize: 15,
  },
  loadingBox: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  missingTokenContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  missingTokenTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#38BDF8',
    marginBottom: 12,
    textAlign: 'center',
  },
  missingTokenText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  codeBox: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
    width: '100%',
  },
  codeText: {
    fontFamily: 'monospace',
    color: '#4ADE80',
    fontSize: 13,
    textAlign: 'center',
  },
  missingTokenHint: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
});
