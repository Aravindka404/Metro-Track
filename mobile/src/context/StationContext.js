import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import stationsData from '../data/stations.json';
import tracksData from '../data/tracks.json';
import { calculateKochiMetroFare, estimateRideDurationMinutes, normalizeStationId } from '../utils/fareCalculator';

const StationContext = createContext(null);

// Default backend API: uses the live Vercel deployment endpoint
export const DEFAULT_API_BASE = 'https://metro-track.vercel.app';

export function StationProvider({ children }) {
  const [trains, setTrains] = useState([]);
  const [istTime, setIstTime] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [serviceStatus, setServiceStatus] = useState('open');
  const [opensAt, setOpensAt] = useState('06:00 AM');
  const [nextServiceText, setNextServiceText] = useState('');
  const [activeStation, setActiveStation] = useState(null);
  const [destinationStation, setDestinationStation] = useState(null);
  const [scheduledDepartures, setScheduledDepartures] = useState([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE);

  // Parse stations from JSON
  const stations = useMemo(() => {
    if (!stationsData || !stationsData.features) return [];
    return stationsData.features.map((f) => ({
      id: f.properties.stop_id,
      name: f.properties.stop_name,
      longitude: f.geometry.coordinates[0],
      latitude: f.geometry.coordinates[1],
    }));
  }, []);

  // Parse tracks into polylines for MapView
  const trackCoordinates = useMemo(() => {
    if (!tracksData || !tracksData.features) return [];
    return tracksData.features.map((f) => ({
      id: f.properties?.name || String(Math.random()),
      coordinates: (f.geometry.coordinates || []).map((pt) => ({
        longitude: pt[0],
        latitude: pt[1],
      })),
    }));
  }, []);

  // Set default initial station (e.g. Aluva or Edapally)
  useEffect(() => {
    if (stations.length > 0 && !activeStation) {
      setActiveStation(stations[0]); // Aluva
    }
  }, [stations, activeStation]);

  // Haptics utility with safety check
  const triggerHaptic = useCallback(async (type = 'light') => {
    try {
      if (type === 'selection') {
        await Haptics.selectionAsync();
      } else if (type === 'medium') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else if (type === 'heavy') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } else if (type === 'success') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {
      // Ignore if not supported on platform/simulator
    }
  }, []);

  // Poll live train radar telemetry
  const fetchTrains = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/trains`);
      if (!res.ok) return;
      const data = await res.json();
      if (data) {
        setIstTime(data.istTime || '');
        setTrains(data.trains || []);
        if (data.serviceStatus) {
          setServiceStatus(data.serviceStatus);
          setIsOpen(data.serviceStatus === 'open');
        } else if (typeof data.isOpen === 'boolean') {
          setIsOpen(data.isOpen);
          setServiceStatus(data.isOpen ? 'open' : 'closed');
        }
        if (data.opensAt) setOpensAt(data.opensAt);
        if (data.nextServiceText) setNextServiceText(data.nextServiceText);
      }
    } catch (err) {
      console.warn('[Mobile Radar API] Fetch error:', err.message);
    }
  }, [apiBaseUrl]);

  // Initial fetch and 3.5s interval
  useEffect(() => {
    fetchTrains();
    const interval = setInterval(fetchTrains, 3500);
    return () => clearInterval(interval);
  }, [fetchTrains]);

  // Fetch route schedule plan
  useEffect(() => {
    if (!activeStation || !destinationStation) {
      setScheduledDepartures([]);
      return;
    }

    setIsLoadingSchedule(true);
    const originId = activeStation.id;
    const destId = destinationStation.id;

    fetch(`${apiBaseUrl}/api/plan?origin=${originId}&destination=${destId}`)
      .then((res) => res.json())
      .then((data) => {
        setScheduledDepartures(data.departures || []);
        setIsLoadingSchedule(false);
      })
      .catch((err) => {
        console.warn('[Mobile Schedule API] Error:', err);
        setIsLoadingSchedule(false);
      });
  }, [activeStation?.id, destinationStation?.id, apiBaseUrl]);

  // Swap / Invert Stations
  const handleSwapStations = useCallback(() => {
    triggerHaptic('medium');
    const temp = activeStation;
    setActiveStation(destinationStation);
    setDestinationStation(temp);
  }, [activeStation, destinationStation, triggerHaptic]);

  // Select a station with light haptic
  const handleSelectStation = useCallback(
    (station, isDestination = false) => {
      triggerHaptic('selection');
      if (isDestination) {
        setDestinationStation(station);
      } else {
        setActiveStation(station);
      }
    },
    [triggerHaptic]
  );

  const value = useMemo(
    () => ({
      trains,
      activeTrainsCount: trains.length,
      istTime,
      isOpen,
      serviceStatus,
      opensAt,
      nextServiceText,
      stations,
      trackCoordinates,
      activeStation,
      destinationStation,
      setActiveStation,
      setDestinationStation,
      handleSelectStation,
      handleSwapStations,
      scheduledDepartures,
      isLoadingSchedule,
      triggerHaptic,
      apiBaseUrl,
      setApiBaseUrl,
    }),
    [
      trains,
      istTime,
      isOpen,
      serviceStatus,
      opensAt,
      nextServiceText,
      stations,
      trackCoordinates,
      activeStation,
      destinationStation,
      handleSelectStation,
      handleSwapStations,
      scheduledDepartures,
      isLoadingSchedule,
      triggerHaptic,
      apiBaseUrl,
    ]
  );

  return <StationContext.Provider value={value}>{children}</StationContext.Provider>;
}

export function useStationContext() {
  const ctx = useContext(StationContext);
  if (!ctx) throw new Error('useStationContext must be used within StationProvider');
  return ctx;
}
