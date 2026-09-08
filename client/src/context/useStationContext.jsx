import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';

const StationContext = createContext(null);

export function StationProvider({ children }) {
  const [trains, setTrains] = useState([]);
  const [istTime, setIstTime] = useState('');
  const [isSimulated, setIsSimulated] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [stations, setStations] = useState([]);
  const [tracksGeoJSON, setTracksGeoJSON] = useState(null);
  const [activeStation, setActiveStation] = useState(null);
  const [nearestStation, setNearestStation] = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  // 1. Fetch Station and Track GeoJSON
  useEffect(() => {
    fetch('/data/stations.geojson')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.features) {
          const list = data.features.map((f) => ({
            id: f.properties.stop_id,
            name: f.properties.stop_name,
            lon: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
          }));
          setStations(list);
        }
      })
      .catch((err) => console.error('Error fetching stations:', err));

    fetch('/data/tracks.geojson')
      .then((res) => res.json())
      .then((data) => setTracksGeoJSON(data))
      .catch((err) => console.error('Error fetching tracks:', err));
  }, []);

  // 2. Connect to WebSocket
  useEffect(() => {
    // Connect to custom backend URL if specified (e.g. Vercel deployment pointing to Render),
    // or port 4000 in local Vite dev (port 3000), or current origin when fullstack served.
    const socketHost =
      import.meta.env.VITE_BACKEND_URL ||
      (window.location.port === '3000' ? 'http://localhost:4000' : window.location.origin);
    const socket = io(socketHost, {
      reconnection: true,
      reconnectionDelay: 1500,
    });

    socket.on('connect', () => {
      setConnectionStatus('connected');
      console.log('[Socket.io] Connected to KMRL backend');
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('trains:update', (payload) => {
      if (!payload) return;
      setIstTime(payload.istTime || '');
      setIsSimulated(Boolean(payload.isSimulatedClock));
      setTrains(payload.trains || []);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Helper to find train by id
  const getTrainById = useCallback(
    (id) => trains.find((t) => t.id.toLowerCase() === (id || '').toLowerCase()),
    [trains]
  );

  const value = useMemo(
    () => ({
      trains,
      activeTrainsCount: trains.length,
      istTime,
      isSimulated,
      connectionStatus,
      stations,
      tracksGeoJSON,
      activeStation,
      setActiveStation,
      nearestStation,
      setNearestStation,
      userLocation,
      setUserLocation,
      getTrainById,
    }),
    [
      trains,
      istTime,
      isSimulated,
      connectionStatus,
      stations,
      tracksGeoJSON,
      activeStation,
      nearestStation,
      userLocation,
      getTrainById,
    ]
  );

  return <StationContext.Provider value={value}>{children}</StationContext.Provider>;
}

export function useStationContext() {
  const context = useContext(StationContext);
  if (!context) {
    throw new Error('useStationContext must be used within a StationProvider');
  }
  return context;
}
