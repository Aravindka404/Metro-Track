import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { io } from 'socket.io-client';
import { CITIES } from '../utils/cityConfig.js';
import { getCityStations, getCityTracks } from '../data/cityMetroData.js';

const StationContext = createContext(null);

export function StationProvider({ children }) {
  const [currentCity, setCurrentCity] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('kmr_city');
      if (stored && CITIES[stored]) return stored;
    }
    return 'kochi';
  });
  const cityConfig = CITIES[currentCity] || CITIES.kochi;

  const [trains, setTrains] = useState([]);
  const [istTime, setIstTime] = useState('');
  const [isSimulated, setIsSimulated] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [serviceStatus, setServiceStatus] = useState('open');
  const [opensAt, setOpensAt] = useState('06:00 AM');
  const [nextServiceText, setNextServiceText] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [stations, setStations] = useState(() => getCityStations(currentCity));
  const [tracksGeoJSON, setTracksGeoJSON] = useState(() => getCityTracks(currentCity));
  const [activeStation, setActiveStation] = useState(() => {
    const sts = getCityStations(currentCity);
    if (currentCity === 'bengaluru') {
      return sts.find((s) => s.id === 'BLR-MAJ-15') || sts[0] || null;
    }
    return sts[0] || null;
  });
  const [nearestStation, setNearestStation] = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  // Cache latest payloads per city for instant switching
  const latestPayloadsRef = useRef({
    kochi: null,
    bengaluru: null,
  });

  const currentCityRef = useRef(currentCity);
  useEffect(() => {
    currentCityRef.current = currentCity;
    if (typeof window !== 'undefined') {
      localStorage.setItem('kmr_city', currentCity);
    }
  }, [currentCity]);

  const socketRef = useRef(null);

  const applyPayload = useCallback((payload, targetCity) => {
    if (!payload) return;
    const activeCity = targetCity || currentCityRef.current;
    const rawTrains = payload.trains || [];
    const isBlr = activeCity === 'bengaluru';
    // Strictly isolate trains: BMRCL trains only in Bengaluru, KMRL trains only in Kochi
    const filteredTrains = rawTrains.filter((t) => {
      const isBlrTrain = Boolean(t.id && t.id.startsWith('BMRCL-'));
      return isBlr ? isBlrTrain : !isBlrTrain;
    });

    setIstTime(payload.istTime || '');
    setIsSimulated(Boolean(payload.isSimulatedClock));
    setTrains(filteredTrains);
    if (payload.serviceStatus) {
      setServiceStatus(payload.serviceStatus);
      setIsOpen(payload.serviceStatus === 'open');
    } else if (typeof payload.isOpen === 'boolean') {
      setIsOpen(payload.isOpen);
      setServiceStatus(payload.isOpen ? 'open' : 'closed');
    }
    if (payload.opensAt) setOpensAt(payload.opensAt);
    if (payload.nextServiceText) setNextServiceText(payload.nextServiceText);
    setConnectionStatus('connected');
  }, []);

  const isLocalDev =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      ['3000', '3001', '5173'].includes(window.location.port));

  const apiBase =
    import.meta.env.VITE_BACKEND_URL ||
    (isLocalDev ? 'http://localhost:4000' : '');
  const trainsApiUrl = `${apiBase}/api/trains`;

  // Fetch live train telemetry via HTTP endpoint
  const fetchTrainsPoll = useCallback(
    async (targetCity) => {
      try {
        const cityParam = targetCity || currentCityRef.current || 'kochi';
        const res = await fetch(`${trainsApiUrl}?city=${cityParam}`);
        if (!res.ok) return;
        const payload = await res.json();
        latestPayloadsRef.current[cityParam] = payload;
        if (currentCityRef.current === cityParam) {
          applyPayload(payload, cityParam);
        }
      } catch (err) {
        console.warn('[HTTP Polling] Error fetching trains:', err);
      }
    },
    [applyPayload, trainsApiUrl]
  );

  // 1. Synchronous instantaneous city data switch
  useEffect(() => {
    const nextStations = getCityStations(currentCity);
    const nextTracks = getCityTracks(currentCity);
    setStations(nextStations);
    setTracksGeoJSON(nextTracks);
    setActiveStation(nextStations[0] || null);
    setNearestStation(null);

    // Apply cached payload for this city if available, otherwise immediately fetch
    if (latestPayloadsRef.current[currentCity]) {
      applyPayload(latestPayloadsRef.current[currentCity], currentCity);
    } else {
      fetchTrainsPoll(currentCity);
    }

    // Ask backend for city data via socket if connected
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('city:select', currentCity);
    }
  }, [currentCity, applyPayload, fetchTrainsPoll]);

  // 2. Connect to WebSocket or fallback to HTTP polling
  useEffect(() => {
    let pollingInterval = null;
    let isSocketConnected = false;

    // Immediate initial fetch
    fetchTrainsPoll(currentCityRef.current);

    const socketHost =
      import.meta.env.VITE_BACKEND_URL ||
      (isLocalDev ? 'http://localhost:4000' : window.location.origin);

    const isLocalOrHasBackend =
      Boolean(import.meta.env.VITE_BACKEND_URL) || isLocalDev;

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
      const socket = io(socketHost, {
        reconnection: true,
        reconnectionDelay: 1500,
        timeout: 4000,
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        isSocketConnected = true;
        stopPolling();
        setConnectionStatus('connected');
        console.log('[Socket.io] Connected to Metro Radar backend');
        socket.emit('city:select', currentCityRef.current);
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

      // City-specific real-time updates
      socket.on('trains:update', (payload) => {
        latestPayloadsRef.current.kochi = payload;
        if (currentCityRef.current === 'kochi') {
          applyPayload(payload, 'kochi');
        }
      });

      socket.on('trains:update:kochi', (payload) => {
        latestPayloadsRef.current.kochi = payload;
        if (currentCityRef.current === 'kochi') {
          applyPayload(payload, 'kochi');
        }
      });

      socket.on('trains:update:bengaluru', (payload) => {
        latestPayloadsRef.current.bengaluru = payload;
        if (currentCityRef.current === 'bengaluru') {
          applyPayload(payload, 'bengaluru');
        }
      });
    } else {
      startPolling();
    }

    return () => {
      stopPolling();
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [applyPayload]);

  // Helper to find train by id
  const getTrainById = useCallback(
    (id) => trains.find((t) => t.id.toLowerCase() === (id || '').toLowerCase()),
    [trains]
  );

  const value = useMemo(
    () => ({
      currentCity,
      setCurrentCity,
      cityConfig,
      trains,
      activeTrainsCount: trains.length,
      istTime,
      isSimulated,
      isOpen,
      serviceStatus,
      opensAt,
      nextServiceText,
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
      currentCity,
      cityConfig,
      trains,
      istTime,
      isSimulated,
      isOpen,
      serviceStatus,
      opensAt,
      nextServiceText,
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
