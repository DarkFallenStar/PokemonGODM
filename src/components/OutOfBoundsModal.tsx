import React from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity } from 'react-native';

interface OutOfBoundsModalProps {
  visible: boolean;
  onRetry: () => void;
  onSimulateCampus: () => void;
}

export const OutOfBoundsModal: React.FC<OutOfBoundsModalProps> = ({
  visible,
  onRetry,
  onSimulateCampus,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.icon}>🚫</Text>
          <Text style={styles.title}>¡FUERA DE LÍMITES!</Text>
          <Text style={styles.subtitle}>Campus Universidad de La Sabana</Text>

          <Text style={styles.message}>
            Tu sensor GPS ha detectado que te encuentras fuera del perímetro restringido del Campus UniSabana.
          </Text>

          <Text style={styles.submessage}>
            El mapa y la generación de criaturas se han congelado. Por favor, regresa al campus para continuar tu aventura Pokémon.
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={onRetry}
              activeOpacity={0.8}
            >
              <Text style={styles.retryButtonText}>🔄 Actualizar GPS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.simulateButton}
              onPress={onSimulateCampus}
              activeOpacity={0.8}
            >
              <Text style={styles.simulateButtonText}>📍 Simular Ubicación en Campus (Demo)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  icon: {
    fontSize: 54,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 16,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  message: {
    fontSize: 14,
    color: '#F8FAFC',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 10,
    fontWeight: '500',
  },
  submessage: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  retryButton: {
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 14,
  },
  simulateButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  simulateButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
