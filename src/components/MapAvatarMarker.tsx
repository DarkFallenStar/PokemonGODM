import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

interface MapAvatarMarkerProps {
  heading: number;
}

export const MapAvatarMarker: React.FC<MapAvatarMarkerProps> = ({ heading }) => {
  return (
    <View style={styles.container}>
      {/* Cono o flecha de orientación azimutal guiada por la brújula */}
      <View style={[styles.headingPointerContainer, { transform: [{ rotate: `${heading}deg` }] }]}>
        <View style={styles.headingPointer} />
      </View>

      {/* Círculo del Avatar del Entrenador */}
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarEmoji}>🧢</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
  },
  headingPointerContainer: {
    position: 'absolute',
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  headingPointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0284C7',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 6,
  },
  avatarEmoji: {
    fontSize: 18,
  },
});
