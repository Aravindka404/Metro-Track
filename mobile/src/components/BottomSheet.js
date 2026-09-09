import React, { useState, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  PanResponder,
  Dimensions,
  Modal,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStationContext } from '../context/StationContext';
import {
  calculateKochiMetroFare,
  estimateRideDurationMinutes,
  getStationHopCount,
  getTripDirection,
} from '../utils/fareCalculator';
import {
  ArrowUpDown,
  Clock,
  MapPin,
  ChevronUp,
  ChevronDown,
  X,
  Moon,
  Plane,
  Ship,
  Train,
  ShoppingBag,
} from 'lucide-react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const PEEK_HEIGHT = 160;
const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.65;

export function BottomSheet() {
  const insets = useSafeAreaInsets();
  const {
    stations,
    trains,
    isOpen,
    opensAt,
    activeStation,
    destinationStation,
    setActiveStation,
    setDestinationStation,
    handleSwapStations,
    scheduledDepartures,
    triggerHaptic,
  } = useStationContext();

  const [isExpanded, setIsExpanded] = useState(false);
  const [stationPickerMode, setStationPickerMode] = useState(null); // 'origin' | 'destination' | null
  const [selectedTrainIdx, setSelectedTrainIdx] = useState(0);

  const translateY = useRef(new Animated.Value(EXPANDED_HEIGHT - PEEK_HEIGHT)).current;

  // Gesture responder for native sheet drag
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        const base = isExpanded ? 0 : EXPANDED_HEIGHT - PEEK_HEIGHT;
        const nextVal = base + gestureState.dy;
        if (nextVal >= 0 && nextVal <= EXPANDED_HEIGHT - PEEK_HEIGHT) {
          translateY.setValue(nextVal);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -50 || (isExpanded && gestureState.dy < 50)) {
          // Snap to Expanded
          setIsExpanded(true);
          triggerHaptic('light');
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        } else {
          // Snap to Peek
          setIsExpanded(false);
          triggerHaptic('light');
          Animated.spring(translateY, {
            toValue: EXPANDED_HEIGHT - PEEK_HEIGHT,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  const toggleExpand = () => {
    triggerHaptic('light');
    const nextState = !isExpanded;
    setIsExpanded(nextState);
    Animated.spring(translateY, {
      toValue: nextState ? 0 : EXPANDED_HEIGHT - PEEK_HEIGHT,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  };

  // Fare & Journey Calculations
  const fare = useMemo(() => {
    if (!activeStation || !destinationStation) return null;
    return calculateKochiMetroFare(activeStation.id, destinationStation.id);
  }, [activeStation, destinationStation]);

  const hops = useMemo(() => {
    if (!activeStation || !destinationStation) return null;
    return getStationHopCount(activeStation.id, destinationStation.id);
  }, [activeStation, destinationStation]);

  const rideMinutes = useMemo(() => {
    if (!activeStation || !destinationStation) return null;
    return estimateRideDurationMinutes(activeStation.id, destinationStation.id);
  }, [activeStation, destinationStation]);

  // Station Multi-modal transfer info
  const transferBadge = useMemo(() => {
    const stId = activeStation?.id;
    if (stId === 'ALVA') return { icon: Plane, label: 'Airport Feeder Bus (CIAL)' };
    if (stId === 'VYTA') return { icon: Ship, label: 'Water Metro & KSRTC Hub' };
    if (stId === 'EDAP') return { icon: ShoppingBag, label: 'Direct LuLu Mall AC Skywalk' };
    if (stId === 'ERSH') return { icon: Train, label: 'Ernakulam South Railway Stn' };
    if (stId === 'TNHL') return { icon: Train, label: 'Ernakulam North Railway Stn' };
    return null;
  }, [activeStation]);

  return (
    <>
      <Animated.View
        style={[
          styles.sheetContainer,
          {
            height: EXPANDED_HEIGHT,
            paddingBottom: insets.bottom + 8,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* Native Drag Handle */}
        <View {...panResponder.panHandlers} style={styles.dragHandleArea}>
          <View style={styles.dragHandle} />
        </View>

        {/* Station Selectors Row */}
        <View style={styles.stationSelectRow}>
          {/* Origin Station Button */}
          <TouchableOpacity
            style={styles.stationPill}
            onPress={() => {
              triggerHaptic('selection');
              setStationPickerMode('origin');
            }}
            activeOpacity={0.7}
          >
            <View style={styles.originIndicator} />
            <Text style={styles.stationPillText} numberOfLines={1}>
              {activeStation ? activeStation.name : 'Select Origin'}
            </Text>
          </TouchableOpacity>

          {/* Invert Stations Button */}
          <TouchableOpacity
            style={styles.swapButton}
            onPress={handleSwapStations}
            activeOpacity={0.7}
          >
            <ArrowUpDown size={16} color="#38BDF8" />
          </TouchableOpacity>

          {/* Destination Station Button */}
          <TouchableOpacity
            style={[styles.stationPill, destinationStation && styles.destPillActive]}
            onPress={() => {
              triggerHaptic('selection');
              setStationPickerMode('destination');
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.destIndicator, destinationStation && styles.destIndicatorActive]} />
            <Text
              style={[
                styles.stationPillText,
                destinationStation && styles.destPillTextActive,
              ]}
              numberOfLines={1}
            >
              {destinationStation ? destinationStation.name : 'Destination'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Fare & Transfer Quick Strip */}
        <View style={styles.statsStrip}>
          {fare !== null ? (
            <View style={styles.fareContainer}>
              <Text style={styles.fareText}>₹{fare}</Text>
              <Text style={styles.fareSubText}>
                {hops} stations • ~{rideMinutes} mins
              </Text>
            </View>
          ) : (
            <Text style={styles.statsPlaceholder}>
              Select destination to view fare & route
            </Text>
          )}

          {transferBadge && (
            <View style={styles.transferPill}>
              <transferBadge.icon size={12} color="#38BDF8" />
              <Text style={styles.transferText}>{transferBadge.label}</Text>
            </View>
          )}
        </View>

        {/* Scrollable Content (Scheduled / Live Trains) */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Night-time closed warning */}
          {!isOpen && (
            <View style={styles.closedNotice}>
              <Moon size={16} color="#FBBF24" />
              <View style={styles.closedNoticeTextGroup}>
                <Text style={styles.closedNoticeTitle}>Service Closed for Tonight</Text>
                <Text style={styles.closedNoticeDesc}>
                  First morning departure resumes at {opensAt || '06:00 AM'} IST.
                </Text>
              </View>
            </View>
          )}

          {/* Destination Selected: Scheduled / Live Options */}
          {destinationStation && scheduledDepartures.length > 0 && (
            <View style={styles.trainsList}>
              <Text style={styles.sectionHeader}>
                {isOpen ? 'UPCOMING DEPARTURES' : 'FIRST MORNING TRAINS'}
              </Text>

              {scheduledDepartures.map((dep, idx) => {
                const isSelected = selectedTrainIdx === idx;
                return (
                  <TouchableOpacity
                    key={dep.trainId || idx}
                    style={[styles.trainCard, isSelected && styles.trainCardSelected]}
                    onPress={() => {
                      triggerHaptic('light');
                      setSelectedTrainIdx(idx);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.trainCardHeader}>
                      <View style={styles.trainIdGroup}>
                        <View
                          style={[
                            styles.trainDot,
                            dep.directionId === 1 ? styles.trainDotNorth : styles.trainDotSouth,
                          ]}
                        />
                        <Text style={styles.trainIdText}>{dep.trainId}</Text>
                      </View>
                      <Text style={styles.trainDepTime}>{dep.depTime}</Text>
                    </View>

                    {isSelected && (
                      <View style={styles.trainDetailsRow}>
                        <Text style={styles.trainDetailItem}>
                          Ride: <Text style={styles.boldText}>{dep.rideMinutes || rideMinutes} mins</Text>
                        </Text>
                        <Text style={styles.trainDetailItem}>
                          Arrival: <Text style={styles.boldText}>{dep.arrTime || '--'}</Text>
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* Full-screen Station Picker Modal */}
      <Modal
        visible={stationPickerMode !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setStationPickerMode(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select {stationPickerMode === 'origin' ? 'Boarding Station' : 'Destination'}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setStationPickerMode(null)}
              >
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={stations}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={styles.modalStationItem}
                  onPress={() => {
                    triggerHaptic('selection');
                    if (stationPickerMode === 'origin') {
                      setActiveStation(item);
                    } else {
                      setDestinationStation(item);
                    }
                    setStationPickerMode(null);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.modalStationNumber}>
                    <Text style={styles.modalStationNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.modalStationName}>{item.name}</Text>
                  <Text style={styles.modalStationCode}>{item.id}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0E1524',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  dragHandleArea: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    width: 38,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  stationSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  stationPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  destPillActive: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  originIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38BDF8',
    marginRight: 8,
  },
  destIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#64748B',
    marginRight: 8,
  },
  destIndicatorActive: {
    backgroundColor: '#EF4444',
  },
  stationPillText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  destPillTextActive: {
    color: '#FCA5A5',
  },
  swapButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    marginTop: 4,
  },
  fareContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  fareText: {
    color: '#EF4444',
    fontSize: 18,
    fontWeight: '900',
  },
  fareSubText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
  statsPlaceholder: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
  },
  transferPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 5,
  },
  transferText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 10,
  },
  closedNotice: {
    flexDirection: 'row',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
    padding: 12,
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  closedNoticeTextGroup: {
    flex: 1,
  },
  closedNoticeTitle: {
    color: '#FCD34D',
    fontSize: 12,
    fontWeight: '700',
  },
  closedNoticeDesc: {
    color: '#CBD5E1',
    fontSize: 11,
    marginTop: 2,
  },
  sectionHeader: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  trainsList: {
    gap: 8,
  },
  trainCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
  },
  trainCardSelected: {
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  trainCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trainIdGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trainDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  trainDotNorth: {
    backgroundColor: '#10B981',
  },
  trainDotSouth: {
    backgroundColor: '#F59E0B',
  },
  trainIdText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  trainDepTime: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '800',
  },
  trainDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  trainDetailItem: {
    color: '#94A3B8',
    fontSize: 11,
  },
  boldText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalStationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalStationNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modalStationNumberText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  modalStationName: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  modalStationCode: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
});
