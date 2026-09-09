import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

/**
 * Native Home Screen Widget Component (2x2 Compact & 4x2 Wide)
 * This serves as the visual specification for iOS WidgetKit / Android Glance.
 */
export function CompactWidget({ stationName = 'Edapally', northEta = '04m', southEta = '07m', isOpen = true, opensAt = '06:00 AM' }) {
  return (
    <View style={styles.compactCard}>
      {/* Station Title */}
      <View style={styles.widgetHeader}>
        <Text style={styles.widgetTitle}>{stationName}</Text>
        <View style={[styles.statusDot, !isOpen && styles.statusDotClosed]} />
      </View>

      {isOpen ? (
        <View style={styles.etaContainer}>
          <View style={styles.etaRow}>
            <Text style={styles.etaDirection}>⬆️ To Aluva</Text>
            <Text style={styles.etaTime}>{northEta}</Text>
          </View>
          <View style={styles.etaRow}>
            <Text style={styles.etaDirection}>⬇️ To Tripunithura</Text>
            <Text style={styles.etaTime}>{southEta}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.closedContainer}>
          <Text style={styles.closedTitle}>Service Closed</Text>
          <Text style={styles.closedTime}>Opens {opensAt}</Text>
        </View>
      )}

      {/* Footer Branding */}
      <Text style={styles.widgetFooter}>Kochi Metro Radar</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  compactCard: {
    width: 155,
    height: 155,
    borderRadius: 22,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 14,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  widgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  widgetTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  statusDotClosed: {
    backgroundColor: '#FBBF24',
  },
  etaContainer: {
    gap: 6,
  },
  etaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  etaDirection: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  etaTime: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
  },
  closedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedTitle: {
    color: '#FCD34D',
    fontSize: 11,
    fontWeight: '700',
  },
  closedTime: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  widgetFooter: {
    color: '#475569',
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
