import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapboxGL from '@rnmapbox/maps';
import { useLocationTracker } from '../hooks/useLocationTracker';
import { useHeadingTracker } from '../hooks/useHeadingTracker';
import { UNISABANA_POLYGON, getGeofenceGeoJSON, CAMPUS_CENTER_COORDINATE } from '../utils/geofence';
import { OutOfBoundsModal } from '../components/OutOfBoundsModal';
import { MapAvatarMarker } from '../components/MapAvatarMarker';
import { supabase } from '../services/supabase';
import type { CampusPOIMarker } from '../types/map';

const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
if (mapboxToken) {
  MapboxGL.setAccessToken(mapboxToken);
}

export const MapScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    location,
    isInsideGeofence,
    isLoading: isLoadingLocation,
    errorMsg,
    isMocked,
    toggleMockLocation,
  } = useLocationTracker();

  const { heading } = useHeadingTracker();

  const [pois, setPois] = useState<CampusPOIMarker[]>([]);
  const [isLoadingPOIs, setIsLoadingPOIs] = useState<boolean>(true);

  // GeoJSON para el perímetro del Campus UniSabana
  const geofenceGeoJSON = useMemo(() => getGeofenceGeoJSON(UNISABANA_POLYGON), []);

  // Coordenada activa (real o campus por defecto mientras carga GPS)
  const currentCoords = location || CAMPUS_CENTER_COORDINATE;

  // Cargar Poképaradas y Gimnasios desde Supabase
  useEffect(() => {
    async function loadCampusPOIs() {
      try {
        setIsLoadingPOIs(true);
        const [stopsRes, gymsRes] = await Promise.all([
          supabase.from('pokestops').select('id, name, latitude, longitude'),
          supabase.from('gymnasiums').select('id, name, latitude, longitude'),
        ]);

        const loadedPOIs: CampusPOIMarker[] = [];

        if (stopsRes.data) {
          stopsRes.data.forEach((s: any) => {
            loadedPOIs.push({
              id: s.id,
              name: s.name,
              type: 'pokestop',
              latitude: s.latitude,
              longitude: s.longitude,
            });
          });
        }

        if (gymsRes.data) {
          gymsRes.data.forEach((g: any) => {
            loadedPOIs.push({
              id: g.id,
              name: g.name,
              type: 'gym',
              latitude: g.latitude,
              longitude: g.longitude,
            });
          });
        }

        setPois(loadedPOIs);
      } catch (e) {
        console.warn('Error cargando POIs de Supabase:', e);
      } finally {
        setIsLoadingPOIs(false);
      }
    }

    loadCampusPOIs();
  }, []);

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
      >
        <MapboxGL.Camera
          centerCoordinate={[currentCoords.longitude, currentCoords.latitude]}
          zoomLevel={16.2}
          animationMode="flyTo"
          animationDuration={1500}
        />

        {/* Polígono Perimetral de Geofencing del Campus */}
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

        {/* Marcadores de Hitos: Poképaradas y Gimnasios del Campus */}
        {pois.map(poi => (
          <MapboxGL.PointAnnotation
            key={poi.id}
            id={`poi-${poi.id}`}
            coordinate={[poi.longitude, poi.latitude]}
          >
            <View style={[styles.poiBadge, poi.type === 'gym' ? styles.gymBadge : styles.stopBadge]}>
              <Text style={styles.poiEmoji}>{poi.type === 'gym' ? '🏟️' : '🔵'}</Text>
            </View>
            <MapboxGL.Callout title={poi.name} />
          </MapboxGL.PointAnnotation>
        ))}

        {/* Marcador del Avatar del Jugador con Orientación Azimutal por Magnetómetro */}
        <MapboxGL.PointAnnotation
          id="userAvatarMarker"
          coordinate={[currentCoords.longitude, currentCoords.latitude]}
        >
          <MapAvatarMarker heading={heading} />
        </MapboxGL.PointAnnotation>
      </MapboxGL.MapView>

      {/* Barra de Estado Superior HUD */}
      <View style={[styles.hudOverlay, { top: insets.top + 8 }]}>
        <View style={styles.hudCard}>
          <Text style={styles.hudTitle}>📍 Campus UniSabana</Text>
          <Text style={styles.hudCoords}>
            {currentCoords.latitude.toFixed(5)}, {currentCoords.longitude.toFixed(5)} | Rumbo: {heading}°
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, isInsideGeofence ? styles.dotGreen : styles.dotRed]} />
            <Text style={styles.statusText}>
              {isInsideGeofence ? 'DENTRO DEL CAMPUS' : 'FUERA DE LÍMITES'}
            </Text>
          </View>
        </View>

        {/* Botón de alternancia de Simulación (Para evaluación / Sustentación) */}
        <TouchableOpacity
          style={[styles.simButton, isMocked && styles.simButtonActive]}
          onPress={toggleMockLocation}
          activeOpacity={0.8}
        >
          <Text style={styles.simButtonText}>
            {isMocked ? '📍 GPS: Simulado' : '📍 GPS: Real'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Indicador de carga inicial */}
      {isLoadingLocation && (
        <View style={[styles.loadingBox, { bottom: insets.bottom + 16 }]}>
          <ActivityIndicator size="small" color="#38BDF8" />
          <Text style={styles.loadingText}>Conectando GPS...</Text>
        </View>
      )}

      {/* Modal Bloqueante Persistente cuando el usuario sale del polígono */}
      <OutOfBoundsModal
        visible={!isInsideGeofence}
        onRetry={() => {}}
        onSimulateCampus={toggleMockLocation}
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
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  hudCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  hudTitle: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 13,
  },
  hudCoords: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotGreen: {
    backgroundColor: '#22C55E',
  },
  dotRed: {
    backgroundColor: '#EF4444',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  simButton: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderWidth: 1,
    borderColor: '#475569',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },
  simButtonActive: {
    backgroundColor: '#0369A1',
    borderColor: '#38BDF8',
  },
  simButtonText: {
    color: '#F8FAFC',
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
  gymBadge: {
    backgroundColor: '#DC2626',
  },
  poiEmoji: {
    fontSize: 15,
  },
  loadingBox: {
    position: 'absolute',
    bottom: 24,
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
