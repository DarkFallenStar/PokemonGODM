import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { MapScreenProps } from '../types/navigation';

export const MapScreen: React.FC<MapScreenProps> = () => {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.icon}>🗺️</Text>
        <Text style={styles.title}>Mapa Pokémon GO</Text>
        <Text style={styles.subtitle}>
          Campus Universidad de La Sabana
        </Text>
        <Text style={styles.description}>
          En las siguientes etapas se integrará el motor vectorial de Mapbox, el algoritmo de Geofencing (Punto en Polígono) y la generación de criaturas en tiempo real.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#334155',
  },
  icon: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#38BDF8',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
});
