import React from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStationContext } from '../context/StationContext';

export function HeaderBar() {
  const insets = useSafeAreaInsets();
  const { activeTrainsCount, istTime, isOpen, opensAt } = useStationContext();

  return (
    <View style={[styles.headerContainer, { top: insets.top + (Platform.OS === 'ios' ? 8 : 12) }]}>
      {/* Brand & Train Count Pill */}
      <View style={styles.brandPill}>
        <Text style={styles.brandTitle}>KOCHI METRO RADAR</Text>
        <View style={styles.divider} />
        {isOpen ? (
          <Text style={styles.trainCountText}>
            <Text style={styles.trainCountBold}>{activeTrainsCount}</Text> active
          </Text>
        ) : (
          <Text style={styles.closedText}>Closed</Text>
        )}
        <View style={styles.divider} />
        <Text style={styles.istTimeText}>{istTime || '--:--'}</Text>
      </View>

      {/* Live / Closed Badge */}
      {isOpen ? (
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      ) : (
        <View style={styles.closedBadge}>
          <View style={styles.closedDot} />
          <Text style={styles.closedBadgeText}>{opensAt || '06:00 AM'}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14, 21, 36, 0.90)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  divider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 8,
  },
  trainCountText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
  trainCountBold: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  closedText: {
    color: '#FCD34D',
    fontSize: 11,
    fontWeight: '700',
  },
  istTimeText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14, 22, 38, 0.90)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#34D399',
    marginRight: 6,
    shadowColor: '#34D399',
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  closedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(23, 20, 31, 0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  closedDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FBBF24',
    marginRight: 6,
    shadowColor: '#FBBF24',
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  closedBadgeText: {
    color: '#FCD34D',
    fontSize: 10,
    fontWeight: '700',
  },
});
