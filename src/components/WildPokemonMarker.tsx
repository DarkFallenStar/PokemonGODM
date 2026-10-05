import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import MapboxGL from '@rnmapbox/maps';
import type { ActiveSpawn } from '../types/spawns';
import { getPokemonAnimatedUrl, getPokemonStaticUrl } from '../utils/pokemonAssets';

interface WildPokemonMarkerProps {
  spawn: ActiveSpawn;
  onPress: (spawn: ActiveSpawn) => void;
}

export const WildPokemonMarker: React.FC<WildPokemonMarkerProps> = ({
  spawn,
  onPress,
}) => {
  // REGLA ESTRICTA: Solo visible si se encuentra dentro del radio visual de 30 metros
  if (!spawn.is_in_range) {
    return null;
  }

  const pokemonId = spawn.pokemon_id || spawn.pokemon?.id;
  const animatedUrl = getPokemonAnimatedUrl(spawn.pokemon, pokemonId);
  const staticUrl = getPokemonStaticUrl(spawn.pokemon, pokemonId);

  const [currentUri, setCurrentUri] = useState<string>(animatedUrl);

  useEffect(() => {
    setCurrentUri(animatedUrl);
  }, [animatedUrl]);

  return (
    <MapboxGL.MarkerView
      id={`wild-${spawn.id}`}
      coordinate={[spawn.longitude, spawn.latitude]}
      anchor={{ x: 0.5, y: 0.5 }}
      allowOverlap={true}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onPress(spawn)}
        style={styles.container}
      >
        {/* Anillo de pulso de encuentro salvaje */}
        <View style={styles.pulseRing} />

        {/* Sprite oficial de la criatura (GIF animado o fallback estático) */}
        {currentUri ? (
          <Image
            source={{ uri: currentUri }}
            style={styles.spriteImage}
            contentFit="contain"
            autoplay={true}
            priority="high"
            cachePolicy="memory-disk"
            onError={() => {
              if (currentUri !== staticUrl) {
                setCurrentUri(staticUrl);
              }
            }}
          />
        ) : (
          <Text style={styles.fallbackEmoji}>🐾</Text>
        )}

        {/* Badge de CP */}
        <View style={styles.cpBadge}>
          <Text style={styles.cpText}>CP {spawn.cp}</Text>
        </View>
      </TouchableOpacity>
    </MapboxGL.MarkerView>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 64,
  },
  pulseRing: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
  },
  spriteImage: {
    width: 48,
    height: 48,
  },
  fallbackEmoji: {
    fontSize: 32,
  },
  cpBadge: {
    position: 'absolute',
    bottom: -2,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  cpText: {
    color: '#F8FAFC',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
});
