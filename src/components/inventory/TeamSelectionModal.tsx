import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { TEAMS, type TrainerTeam } from '../../types/battle';

interface TeamSelectionModalProps {
  visible: boolean;
  currentTeam: TrainerTeam;
  onClose: () => void;
  onSelectTeam: (team: TrainerTeam) => void;
}

export const TeamSelectionModal: React.FC<TeamSelectionModalProps> = ({
  visible,
  currentTeam,
  onClose,
  onSelectTeam,
}) => {
  const teamList: TrainerTeam[] = ['mystic', 'valor', 'instinct'];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Elige tu Equipo de Entrenador</Text>
              <Text style={styles.subtitle}>
                Tu equipo define la bandera que ondeará en los gimnasios conquistados del campus.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeIconBtn} activeOpacity={0.7}>
              <Text style={styles.closeIconText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent}>
            {teamList.map(tKey => {
              const team = TEAMS[tKey];
              const isSelected = currentTeam === tKey;

              return (
                <TouchableOpacity
                  key={tKey}
                  activeOpacity={0.8}
                  style={[
                    styles.teamCard,
                    { borderColor: isSelected ? team.color : '#334155' },
                    isSelected && { backgroundColor: `${team.color}18` },
                  ]}
                  onPress={() => {
                    onSelectTeam(tKey);
                    onClose();
                  }}
                >
                  <View style={[styles.badgeCircle, { backgroundColor: team.color }]}>
                    <Text style={styles.badgeEmoji}>{team.badge}</Text>
                  </View>

                  <View style={styles.cardInfo}>
                    <View style={styles.cardTitleRow}>
                      <Text style={[styles.cardTitle, { color: isSelected ? team.accentColor : '#F8FAFC' }]}>
                        {team.name}
                      </Text>
                      {isSelected && (
                        <View style={[styles.activePill, { backgroundColor: team.color }]}>
                          <Text style={styles.activePillText}>ACTIVO</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.leaderText}>Líder: {team.leader}</Text>
                    <Text style={styles.mottoText}>{team.motto}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity style={styles.dismissButton} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.dismissButtonText}>Cerrar</Text>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
    maxWidth: 280,
    lineHeight: 16,
  },
  closeIconBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#1E293B',
  },
  closeIconText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: 'bold',
  },
  scrollList: {
    maxHeight: 400,
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 12,
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 14,
    borderWidth: 2,
    gap: 14,
  },
  badgeCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  badgeEmoji: {
    fontSize: 26,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  activePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  activePillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  leaderText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  mottoText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
    lineHeight: 15,
  },
  dismissButton: {
    marginTop: 14,
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  dismissButtonText: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 14,
  },
});
