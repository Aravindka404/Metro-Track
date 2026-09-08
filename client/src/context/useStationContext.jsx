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

  // 2. Connect to WebSocket or fallback to HTTP polling (for Vercel Serverless)
  useEffect(() => {
    let pollingInterval = null;
    let isSocketConnected = false;

    const apiBase = import.meta.env.VITE_BACKEND_URL || '';
    const trainsApiUrl = `${apiBase}/api/trains`;

    // Fetch live train telemetry via Serverless HTTP endpoint
    const fetchTrainsPoll = async () => {
      try {
        const res = await fetch(trainsApiUrl);
        if (!res.ok) return;
        const payload = await res.json();
        if (payload) {
          setIstTime(payload.istTime || '');
          setIsSimulated(Boolean(payload.isSimulatedClock));
          setTrains(payload.trains || []);
          setConnectionStatus('connected');
        }
      } catch (err) {
        console.warn('[HTTP Polling] Error fetching trains:', err);
      }
    };

    // Immediate initial fetch for instantaneous load without waiting
    fetchTrainsPoll();

    const socketHost =
      import.meta.env.VITE_BACKEND_URL ||
      (window.location.port === '3000' ? 'http://localhost:4000' : window.location.origin);

    const isLocalOrHasBackend =
      Boolean(import.meta.env.VITE_BACKEND_URL) || window.location.port === '3000';

    let socket = null;

    const startPolling = () => {
      if (!pollingInterval) {
        pollingInterval = setInterval(fetchTrainsPoll, 3500);
      }
    };

    const stopPolling = () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    };

    if (isLocalOrHasBackend) {
      socket = io(socketHost, {
        reconnection: true,
        reconnectionDelay: 2000,
        timeout: 3000,
      });

      socket.on('connect', () => {
        isSocketConnected = true;
        stopPolling();
        setConnectionStatus('connected');
        console.log('[Socket.io] Connected to KMRL backend');
      });

      socket.on('disconnect', () => {
        isSocketConnected = false;
        startPolling();
      });

      socket.on('connect_error', () => {
        if (!isSocketConnected) {
          startPolling();
        }
      });

      socket.on('trains:update', (payload) => {
        if (!payload) return;
        setIstTime(payload.istTime || '');
        setIsSimulated(Boolean(payload.isSimulatedClock));
        setTrains(payload.trains || []);
      });
    } else {
      // 100% Vercel deployment: use regular 3.5s HTTP polling
      startPolling();
    }

    return () => {
      stopPolling();
      if (socket) {
        socket.disconnect();
      }
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
