import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { InventoryScreenProps } from '../types/navigation';

export const InventoryScreen: React.FC<InventoryScreenProps> = () => {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.icon}>🎒</Text>
        <Text style={styles.title}>Mochila y Pokédex</Text>
        <Text style={styles.subtitle}>
          Inventario y Criaturas Registradas
        </Text>
        <Text style={styles.description}>
          Aquí se gestionarán los 151 Pokémon extraídos mediante Web Scraping y persistidos en Supabase, además de Pokéballs y objetos de combate.
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
    color: '#34D399',
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
