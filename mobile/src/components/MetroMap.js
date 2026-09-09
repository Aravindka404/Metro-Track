import React, { useRef, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import MapView, { Polyline, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useStationContext } from '../context/StationContext';
import { Navigation, Target, Compass } from 'lucide-react-native';

// Dark theme map styling for high contrast transit visibility
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0B0F19' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748B' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0B0F19' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#94A3B8' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#475569' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1E293B' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0F172A' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#1E293B' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#020617' }],
  },
];

// Initial camera centered on Kochi Metro line (Kaloor / Edapally area)
const INITIAL_REGION = {
  latitude: 10.025,
  longitude: 76.315,
  latitudeDelta: 0.18,
  longitudeDelta: 0.18,
};

export function MetroMap() {
  const mapRef = useRef(null);
  const {
    stations,
    trackCoordinates,
    trains,
    activeStation,
    destinationStation,
    handleSelectStation,
    triggerHaptic,
  } = useStationContext();

  // Fly to active station when selected
  useEffect(() => {
    if (activeStation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: activeStation.latitude,
          longitude: activeStation.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        },
        600
      );
    }
  }, [activeStation]);

  const handleResetCamera = useCallback(() => {
    triggerHaptic('light');
    if (mapRef.current) {
      mapRef.current.animateToRegion(INITIAL_REGION, 500);
    }
  }, [triggerHaptic]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        customMapStyle={DARK_MAP_STYLE}
        showsUserLocation={true}
        showsCompass={false}
        rotateEnabled={true}
        pitchEnabled={true}
      >
        {/* Track Geometry Polylines */}
        {trackCoordinates.map((track, idx) => (
          <Polyline
            key={`track-${idx}`}
            coordinates={track.coordinates}
            strokeColor="rgba(6, 182, 212, 0.65)"
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        ))}

        {/* Station Markers */}
        {stations.map((st) => {
          const isActive = activeStation?.id === st.id;
          const isDest = destinationStation?.id === st.id;

          return (
            <Marker
              key={`st-${st.id}`}
              coordinate={{ latitude: st.latitude, longitude: st.longitude }}
              onPress={() => handleSelectStation(st)}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={styles.stationMarkerContainer}>
                <View
                  style={[
                    styles.stationDot,
                    isActive && styles.stationDotActive,
                    isDest && styles.stationDotDest,
                  ]}
                >
                  <View
                    style={[
                      styles.stationInnerDot,
                      isActive && styles.stationInnerDotActive,
                      isDest && styles.stationInnerDotDest,
                    ]}
                  />
                </View>
                {(isActive || isDest) && (
                  <View style={styles.stationLabelBadge}>
                    <Text style={styles.stationLabelText}>{st.name}</Text>
                  </View>
                )}
              </View>
            </Marker>
          );
        })}

        {/* Live Trains with Aero-Chevron & Telemetry */}
        {trains.map((train) => {
          const isNorth = train.direction === 1;
          const trainColor = isNorth ? '#10B981' : '#F59E0B'; // Green for North (Aluva), Orange for South (Tripunithura)
          const headingDeg = train.bearing || 0;

          return (
            <Marker
              key={`train-${train.id}`}
              coordinate={{ latitude: train.lat, longitude: train.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={true}
              onPress={() => triggerHaptic('light')}
            >
              <View style={styles.trainMarkerContainer}>
                {/* Heading Arrow Chevron */}
                <View
                  style={[
                    styles.trainChevron,
                    {
                      backgroundColor: trainColor,
                      transform: [{ rotate: `${headingDeg}deg` }],
                    },
                  ]}
                >
                  <View style={styles.chevronNose} />
                </View>

                {/* Train Code & Speed Tag */}
                <View style={[styles.trainTag, { borderColor: trainColor }]}>
                  <Text style={styles.trainTagText}>{train.id.replace('KMRL-', '')}</Text>
                  <Text style={styles.trainSpeedText}>{train.speed} km/h</Text>
                </View>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Floating Map Re-center Action Button */}
      <TouchableOpacity
        style={styles.recenterButton}
        onPress={handleResetCamera}
        activeOpacity={0.8}
      >
        <Navigation size={18} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  stationMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stationDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#0F172A',
    borderColor: '#94A3B8',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stationDotActive: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
    borderWidth: 2.5,
    shadowColor: '#38BDF8',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 8,
  },
  stationDotDest: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    borderColor: '#F87171',
    borderWidth: 2.5,
    shadowColor: '#EF4444',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 8,
  },
  stationInnerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  stationInnerDotActive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  stationInnerDotDest: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  stationLabelBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginTop: 4,
  },
  stationLabelText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '700',
  },
  trainMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainChevron: {
    width: 18,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 6,
  },
  chevronNose: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 6,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFFFFF',
    marginTop: 2,
  },
  trainTag: {
    backgroundColor: '#0F172A',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginTop: 2,
    alignItems: 'center',
  },
  trainTagText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
  trainSpeedText: {
    color: '#94A3B8',
    fontSize: 7,
    fontWeight: '600',
  },
  recenterButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 80,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
});
