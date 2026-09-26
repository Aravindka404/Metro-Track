import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, Clock, X, Moon, Sun, Compass, Maximize2, Minimize2 } from 'lucide-react';
import { BuyMeACoffeeIcon } from '../components/BuyMeACoffeeIcon.jsx';
import { TrainJourneyCard } from '../components/TrainJourneyCard.jsx';
import { TransferJourneyCard } from '../components/TransferJourneyCard.jsx';
import { MapBase } from '../components/MapBase.jsx';
import { StationPills } from '../components/StationPills.jsx';
import { StationPickerModal } from '../components/StationPickerModal.jsx';
import { useStationContext } from '../context/useStationContext.jsx';
import {
  calculateFare,
  calculateKochiMetroFare,
  estimateRideDurationMinutes,
  getTripDirection,
  getStationHopCount,
  normalizeStationId,
  getInterchangeDetails,
  BENGALURU_PURPLE_IDS,
  BENGALURU_GREEN_IDS,
  BENGALURU_YELLOW_IDS,
} from '../utils/fareCalculator.js';
import { THEMES, getStoredTheme, saveTheme } from '../utils/themeConfig.js';
import { CITIES } from '../utils/cityConfig.js';

// Buy Me a Coffee Support URL (Update with your custom link/handle)
const BUY_ME_A_COFFEE_URL = 'https://buymeacoffee.com/aravindka';

// Precision Haversine algorithm for nearest station detection
function getNearestStation(userLat, userLon, stations) {
  const R = 6371;
  let closest = null;
  let minDistance = Infinity;

  stations.forEach((station) => {
    const dLat = (station.lat - userLat) * (Math.PI / 180);
    const dLon = (station.lon - userLon) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(userLat * (Math.PI / 180)) *
        Math.cos(station.lat * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    if (distance < minDistance) {
      minDistance = distance;
      closest = { ...station, distanceKm: distance };
    }
  });
  // Ignore if user is more than 50km away from this metro network
  if (minDistance > 50) return null;
  return closest;
}

// Format 24h 'HH:MM' string to 12h 'h:mm AM/PM'
function formatTime12h(timeStr) {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

// Safely extract train direction: 0 = Southbound/Westbound, 1 = Northbound/Eastbound
function getTrainDirection(train) {
  if (!train) return null;
  if (typeof train.directionId === 'number') return train.directionId;
  if (typeof train.direction === 'number') return train.direction;
  if (typeof train.id === 'string') {
    // Kochi: N = North (1), S = South (0)
    if (train.id.includes('-N')) return 1;
    if (train.id.includes('-S')) return 0;
    // Bengaluru Purple: P01..P06 = East (1), P07..P12 = West (0)
    if (train.id.includes('-P01') || train.id.includes('-P02') || train.id.includes('-P03') || train.id.includes('-P04') || train.id.includes('-P05') || train.id.includes('-P06')) return 1;
    if (train.id.includes('-P07') || train.id.includes('-P08') || train.id.includes('-P09') || train.id.includes('-P10') || train.id.includes('-P11') || train.id.includes('-P12')) return 0;
    // Bengaluru Green: G01..G05 = North (1), G06..G10 = South (0)
    if (train.id.includes('-G01') || train.id.includes('-G02') || train.id.includes('-G03') || train.id.includes('-G04') || train.id.includes('-G05')) return 1;
    if (train.id.includes('-G06') || train.id.includes('-G07') || train.id.includes('-G08') || train.id.includes('-G09') || train.id.includes('-G10')) return 0;
    // Bengaluru Yellow: Y01..Y04 = North (1), Y05..Y08 = South (0)
    if (train.id.includes('-Y01') || train.id.includes('-Y02') || train.id.includes('-Y03') || train.id.includes('-Y04')) return 1;
    if (train.id.includes('-Y05') || train.id.includes('-Y06') || train.id.includes('-Y07') || train.id.includes('-Y08')) return 0;
  }
  return null;
}

export function NetworkView() {
  const {
    currentCity,
    setCurrentCity,
    cityConfig,
    trains,
    activeTrainsCount,
    istTime,
    isOpen,
    serviceStatus,
    opensAt,
    nextServiceText,
    stations,
    activeStation,
    setActiveStation,
    nearestStation,
    setNearestStation,
    userLocation,
    setUserLocation,
  } = useStationContext();

  const navigate = useNavigate();

  const currentStation = activeStation || nearestStation;

  // City dropdown state
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);

  // Destination & Drawer state
  const [destinationStation, setDestinationStation] = useState(null);
  // Default is minimized / peek mode so user sees the map + first train immediately!
  const [isDrawerExpanded, setIsDrawerExpanded] = useState(false);
  // Full-screen map expansion toggle (collapses commuter panel into compact floating pill)
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [selectedTrainIdx, setSelectedTrainIdx] = useState(0);

  // Station picker modal state ('origin' | 'destination' | null)
  const [stationPickerMode, setStationPickerMode] = useState(null);

  // Depart later time planning state (null = live default)
  const [selectedTime, setSelectedTime] = useState(null);
  const [customTimeInput, setCustomTimeInput] = useState('17:30');
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [scheduledDepartures, setScheduledDepartures] = useState([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);

  // Reset selected train index whenever route or time changes
  useEffect(() => {
    setSelectedTrainIdx(0);
  }, [currentStation?.id, destinationStation?.id, selectedTime]);

  const [themeKey, setThemeKey] = useState(getStoredTheme);
  const currentTheme = THEMES[themeKey] || THEMES.dark;
  const isLight = currentTheme.isLight;

  const toggleTheme = () => {
    const nextTheme = themeKey === 'light' ? 'dark' : 'light';
    setThemeKey(nextTheme);
    saveTheme(nextTheme);
  };

  // Responsive mobile detector
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Dynamic map padding giving maximum breathing room to the corridor
  const mapPadding = useMemo(() => {
    if (isMapExpanded) {
      return {
        bottom: 30,
        top: 65,
        left: 20,
        right: 20,
      };
    }
    if (isMobile) {
      return {
        bottom: isDrawerExpanded ? Math.round(window.innerHeight * 0.46) : 170,
        top: 65,
        left: 16,
        right: 16,
      };
    }
    return {
      bottom: 40,
      top: 40,
      left: 390,
      right: 40,
    };
  }, [isMobile, isDrawerExpanded, isMapExpanded]);

  const [viewState, setViewState] = useState(() => ({
    ...(cityConfig?.center || {
      longitude: 76.315,
      latitude: 10.025,
      zoom: 11.6,
    }),
  }));

  // Geolocation detection
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          setUserLocation({ lat, lon });

          if (stations.length > 0) {
            const nearest = getNearestStation(lat, lon, stations);
            setNearestStation(nearest);
          }
        },
        () => {
          if (stations.length > 0 && !activeStation) {
            setActiveStation(stations[0]);
          }
        },
        { enableHighAccuracy: false, timeout: 8000 }
      );
    }
  }, [stations, activeStation, setActiveStation, setNearestStation, setUserLocation]);

  // Strict City Isolation: Enforce that activeStation and destinationStation ALWAYS belong to currentCity stations
  useEffect(() => {
    if (!stations || !stations.length) return;
    const stationIdSet = new Set(stations.map((s) => s.id));

    // 1. Validate activeStation belongs to current city
    let validActive = activeStation;
    if (!validActive || !stationIdSet.has(validActive.id)) {
      if (currentCity === 'bengaluru') {
        validActive = stations.find((s) => s.id === 'BLR-MAJ-15') || stations[0];
      } else {
        validActive = stations.find((s) => normalizeStationId(s.id) === 'ALVA') || stations[0];
      }
      setActiveStation(validActive);
    }

    // 2. Clear nearestStation if it is from the other city
    if (nearestStation && !stationIdSet.has(nearestStation.id)) {
      setNearestStation(null);
    }

    // 3. Validate destinationStation belongs to current city and differs from active station
    const currentId = validActive?.id;
    if (
      !destinationStation ||
      !stationIdSet.has(destinationStation.id) ||
      destinationStation.id === currentId
    ) {
      if (currentCity === 'bengaluru') {
        const target =
          stations.find((s) => s.id === 'BLR-MAJ-15' && s.id !== currentId) ||
          stations.find((s) => s.id === 'BLR-PUR-37' && s.id !== currentId) ||
          stations.find((s) => s.id !== currentId);
        if (target) setDestinationStation(target);
      } else {
        const edap =
          stations.find((s) => normalizeStationId(s.id) === 'EDAP' && s.id !== currentId) ||
          stations.find((s) => normalizeStationId(s.id) === 'TPHT' && s.id !== currentId) ||
          stations.find((s) => s.id !== currentId);
        if (edap) setDestinationStation(edap);
      }
    }
  }, [stations, activeStation, nearestStation, destinationStation, currentCity, setActiveStation, setNearestStation]);

  // Fetch scheduled departures when route or custom time changes
  useEffect(() => {
    if (!currentStation || !destinationStation) {
      setScheduledDepartures([]);
      return;
    }

    setIsLoadingSchedule(true);
    const originId = currentStation.id;
    const destId = destinationStation.id;
    const timeParam = selectedTime ? `&time=${selectedTime}` : '';

    const isLocalDev =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        ['3000', '3001', '5173'].includes(window.location.port));

    const apiBase =
      import.meta.env.VITE_BACKEND_URL ||
      (isLocalDev ? 'http://localhost:4000' : '');

    fetch(`${apiBase}/api/plan?origin=${originId}&destination=${destId}&city=${currentCity}${timeParam}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setScheduledDepartures(data.departures || []);
        setIsLoadingSchedule(false);
      })
      .catch(() => {
        setIsLoadingSchedule(false);
      });
  }, [currentStation?.id, destinationStation?.id, selectedTime, currentCity]);

  // Live approaching trains for current station
  const liveStationArrivals = useMemo(() => {
    if (!currentStation || !trains.length) {
      return {
        north: [],
        south: [],
        greenNorth: [],
        greenSouth: [],
        purpleEast: [],
        purpleWest: [],
      };
    }

    const currentId = normalizeStationId(currentStation.id);
    const arrivalsNorth = [];
    const arrivalsSouth = [];
    const greenNorth = [];
    const greenSouth = [];
    const purpleEast = [];
    const purpleWest = [];
    const yellowNorth = [];
    const yellowSouth = [];

    trains.forEach((train) => {
      // In Bengaluru, if currentStation belongs to a specific line (and is not an interchange), strictly filter by line
      if (currentCity === 'bengaluru' && currentStation.line && currentStation.line !== 'interchange') {
        if (train.line && train.line !== currentStation.line) return;
      }

      const remStops = train.remainingStops || [];
      const stopEntry = remStops.find((s) => normalizeStationId(s.stopId) === currentId);

      if (stopEntry) {
        const item = {
          train,
          etaSeconds: stopEntry.etaSeconds,
          currentLocation:
            train.isDwelling && stopEntry.etaSeconds <= 0
              ? 'At platform'
              : train.nextStation
              ? `Near ${train.nextStation}`
              : 'In transit',
        };
        const dir = getTrainDirection(train);
        if (dir === 1) {
          arrivalsNorth.push(item);
          if (train.line === 'green') greenNorth.push(item);
          if (train.line === 'purple') purpleEast.push(item);
          if (train.line === 'yellow') yellowNorth.push(item);
        } else if (dir === 0) {
          arrivalsSouth.push(item);
          if (train.line === 'green') greenSouth.push(item);
          if (train.line === 'purple') purpleWest.push(item);
          if (train.line === 'yellow') yellowSouth.push(item);
        }
      }
    });

    arrivalsNorth.sort((a, b) => a.etaSeconds - b.etaSeconds);
    arrivalsSouth.sort((a, b) => a.etaSeconds - b.etaSeconds);
    greenNorth.sort((a, b) => a.etaSeconds - b.etaSeconds);
    greenSouth.sort((a, b) => a.etaSeconds - b.etaSeconds);
    purpleEast.sort((a, b) => a.etaSeconds - b.etaSeconds);
    purpleWest.sort((a, b) => a.etaSeconds - b.etaSeconds);
    yellowNorth.sort((a, b) => a.etaSeconds - b.etaSeconds);
    yellowSouth.sort((a, b) => a.etaSeconds - b.etaSeconds);

    return {
      north: arrivalsNorth,
      south: arrivalsSouth,
      greenNorth,
      greenSouth,
      purpleEast,
      purpleWest,
      yellowNorth,
      yellowSouth,
    };
  }, [currentStation, trains, currentCity]);

  // Combined Trip Planning Computations
  const tripPlan = useMemo(() => {
    if (!currentStation || !destinationStation) return null;

    const interchangeInfo = getInterchangeDetails(
      currentStation.id,
      destinationStation.id,
      currentCity
    );

    // 1. Multi-Line Interchange Journeys (e.g. Bengaluru Purple <-> Green via Majestic)
    if (interchangeInfo.isInterchange) {
      const { leg1, totalHops, totalRideMinutes, totalFare } = interchangeInfo;

      // When user sets custom departure time via "Depart Later", use scheduled departures for Leg 1
      if (selectedTime) {
        let scheduledList = (scheduledDepartures || [])
          .filter((dep) => {
            if (dep.directionId !== undefined && dep.directionId !== leg1.direction) return false;
            if (dep.line && dep.line !== leg1.line) return false;
            return true;
          })
          .map((dep) => ({
            id: dep.trainId,
            displayId: dep.trainId.replace('KMRL-', '').replace('BMRCL-', ''),
            line: leg1.line,
            isLive: false,
            direction: dep.directionId !== undefined ? dep.directionId : leg1.direction,
            depTime: dep.depTime,
            arrTime: dep.arrTime,
            departureDisplay: dep.depTime,
            status: `Scheduled (${dep.depTime})`,
            waitEtaSeconds: dep.etaSeconds,
            rideMinutes: dep.rideMinutes || leg1.rideMinutes,
          }));

        if (scheduledList.length === 0) {
          const parts = selectedTime.split(':').map(Number);
          const targetH = parts[0] || 0;
          const targetM = parts[1] || 0;
          const d = new Date();
          d.setHours(targetH, targetM + 2, 0, 0);
          const depTime = d.toLocaleTimeString('en-US', {
            timeZone: 'Asia/Kolkata',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
          const arrD = new Date(d.getTime() + totalRideMinutes * 60000);
          const arrTime = arrD.toLocaleTimeString('en-US', {
            timeZone: 'Asia/Kolkata',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
          scheduledList.push({
            id: `BMRCL-SCH-${leg1.line === 'purple' ? 'P' : leg1.line === 'yellow' ? 'Y' : 'G'}01`,
            displayId: 'SCH-01',
            line: leg1.line,
            isLive: false,
            direction: leg1.direction,
            depTime,
            arrTime,
            departureDisplay: depTime,
            status: `Scheduled (${depTime})`,
            waitEtaSeconds: Math.max(0, Math.round((d.getTime() - Date.now()) / 1000)),
            rideMinutes: leg1.rideMinutes,
          });
        }

        return {
          isInterchange: true,
          interchangeDetails: interchangeInfo,
          isCustomTime: true,
          selectedTimeStr: selectedTime,
          fare: totalFare,
          hops: totalHops,
          rideMinutes: totalRideMinutes,
          journeyTrains: scheduledList,
        };
      }

      const normOriginId = normalizeStationId(currentStation.id);
      const normTransferId = normalizeStationId(leg1.destId || interchangeInfo.interchangeStationId || 'BLR-MAJ-15');
      const candidateLiveTrains = [];

      trains.forEach((train) => {
        if (train.line !== leg1.line) return;
        const trainDir = getTrainDirection(train);
        if (trainDir !== leg1.direction) return;

        const remStops = train.remainingStops || [];
        if (!remStops.length) return;

        const originIdx = remStops.findIndex((s) => normalizeStationId(s.stopId) === normOriginId);
        const transferIdx = remStops.findIndex((s) => normalizeStationId(s.stopId) === normTransferId);

        if (originIdx === -1 || transferIdx === -1 || transferIdx <= originIdx) return;

        const originStop = remStops[originIdx];
        const transferStop = remStops[transferIdx];
        const waitSec = originStop.etaSeconds;
        if (waitSec < 0) return;

        const leg1RideMins =
          transferStop.etaSeconds !== undefined && originStop.etaSeconds !== undefined
            ? Math.max(1, Math.round((transferStop.etaSeconds - originStop.etaSeconds) / 60))
            : leg1.rideMinutes;

        const depDisplay =
          waitSec <= 45
            ? 'Arriving Now'
            : Math.floor(waitSec / 60) === 0
            ? `in ${waitSec}s`
            : `in ${Math.floor(waitSec / 60)}m ${waitSec % 60}s`;

        const depDate = new Date(Date.now() + Math.max(0, waitSec) * 1000);
        const depTime = depDate.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Kolkata',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

        candidateLiveTrains.push({
          id: train.id,
          displayId: train.id.replace('KMRL-', '').replace('BMRCL-', ''),
          line: train.line,
          isLive: true,
          direction: trainDir,
          depTime,
          departureDisplay: depDisplay,
          status: train.status || 'Approaching platform',
          waitEtaSeconds: waitSec,
          rideMinutes: leg1RideMins,
        });
      });

      candidateLiveTrains.sort((a, b) => a.waitEtaSeconds - b.waitEtaSeconds);

      const journeyTrains = [...candidateLiveTrains.slice(0, 4)];

      // Backfill with scheduled departures if fewer than 4 live trains for Leg 1
      if (journeyTrains.length < 4 && scheduledDepartures && scheduledDepartures.length > 0) {
        const lastWaitSec = journeyTrains.length > 0
          ? journeyTrains[journeyTrains.length - 1].waitEtaSeconds
          : 0;
        let addedCount = 0;
        for (const dep of scheduledDepartures) {
          if (journeyTrains.length >= 4) break;
          // Ensure scheduled departure strictly matches direction and line of Leg 1
          if (dep.directionId !== undefined && dep.directionId !== leg1.direction) {
            continue;
          }
          if (dep.line && dep.line !== leg1.line) {
            continue;
          }
          if (!journeyTrains.some((t) => t.id === dep.trainId)) {
            addedCount++;
            const waitSec = Math.max(dep.etaSeconds, lastWaitSec + addedCount * 360);
            const depDate = new Date(Date.now() + waitSec * 1000);
            const depTime = depDate.toLocaleTimeString('en-US', {
              timeZone: 'Asia/Kolkata',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            });
            const arrDate = new Date(Date.now() + (waitSec + (dep.rideMinutes || leg1.rideMinutes) * 60) * 1000);
            const arrTime = arrDate.toLocaleTimeString('en-US', {
              timeZone: 'Asia/Kolkata',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            });
            journeyTrains.push({
              id: dep.trainId,
              displayId: dep.trainId.replace('KMRL-', '').replace('BMRCL-', ''),
              line: leg1.line,
              isLive: false,
              direction: dep.directionId !== undefined ? dep.directionId : leg1.direction,
              depTime,
              arrTime,
              departureDisplay: depTime,
              status: `Scheduled at ${depTime}`,
              waitEtaSeconds: waitSec,
              rideMinutes: dep.rideMinutes || leg1.rideMinutes,
            });
          }
        }
      }

      if (journeyTrains.length === 0) {
        journeyTrains.push({
          id: `BMRCL-SCH-01`,
          displayId: 'SCH-01',
          line: leg1.line,
          isLive: false,
          direction: leg1.direction,
          depTime: 'Scheduled',
          departureDisplay: 'in ~4 mins',
          status: `Scheduled on ${leg1.lineName}`,
          waitEtaSeconds: 240,
          rideMinutes: leg1.rideMinutes,
        });
      }

      return {
        isInterchange: true,
        interchangeDetails: interchangeInfo,
        isCustomTime: Boolean(selectedTime),
        fare: totalFare,
        hops: totalHops,
        rideMinutes: totalRideMinutes,
        journeyTrains,
      };
    }

    const fare = calculateFare(currentStation.id, destinationStation.id, currentCity);
    const hops = getStationHopCount(currentStation.id, destinationStation.id, currentCity);
    const rideMinutes = estimateRideDurationMinutes(currentStation.id, destinationStation.id, currentCity);
    const direction = getTripDirection(currentStation.id, destinationStation.id, currentCity);

    if (direction === null) {
      return {
        isCustomTime: false,
        fare: 0,
        hops: 0,
        rideMinutes: 0,
        journeyTrains: [],
      };
    }

    if (selectedTime) {
      const scheduledList = (scheduledDepartures || [])
        .filter((dep) => dep.directionId === undefined || dep.directionId === direction)
        .map((dep) => ({
          id: dep.trainId,
          displayId: dep.trainId.replace('KMRL-', '').replace('BMRCL-', ''),
          isLive: false,
          direction: dep.directionId !== undefined ? dep.directionId : direction,
          depTime: dep.depTime,
          arrTime: dep.arrTime,
          departureDisplay: dep.depTime,
          status: `Scheduled (${dep.depTime})`,
          waitEtaSeconds: dep.etaSeconds,
          rideMinutes: dep.rideMinutes || rideMinutes,
        }));

      return {
        isCustomTime: true,
        selectedTimeStr: selectedTime,
        fare,
        hops,
        rideMinutes,
        journeyTrains: scheduledList,
      };
    }

    // Default: Live Mode
    const normOriginId = normalizeStationId(currentStation.id);
    const normDestId = normalizeStationId(destinationStation.id);

    // Determine the route line for Bengaluru journeys
    let routeLine = null;
    if (currentCity === 'bengaluru') {
      const isOPurple = BENGALURU_PURPLE_IDS.includes(currentStation.id);
      const isDPurple = BENGALURU_PURPLE_IDS.includes(destinationStation.id);
      const isOGreen = BENGALURU_GREEN_IDS.includes(currentStation.id);
      const isDGreen = BENGALURU_GREEN_IDS.includes(destinationStation.id);
      const isOYellow = BENGALURU_YELLOW_IDS.includes(currentStation.id);
      const isDYellow = BENGALURU_YELLOW_IDS.includes(destinationStation.id);
      const isOMajestic = currentStation.id === 'BLR-MAJ-15';
      const isDMajestic = destinationStation.id === 'BLR-MAJ-15';

      if ((isOPurple && isDPurple) || (isOMajestic && isDPurple) || (isOPurple && isDMajestic)) {
        routeLine = 'purple';
      } else if ((isOGreen && isDGreen) || (isOMajestic && isDGreen) || (isOGreen && isDMajestic)) {
        routeLine = 'green';
      } else if (isOYellow && isDYellow) {
        routeLine = 'yellow';
      }
    }

    const candidateLiveTrains = [];

    trains.forEach((train) => {
      // 0. Strict Line Match (Bengaluru): only trains operating on this route line are eligible
      if (routeLine && train.line && train.line !== routeLine) {
        return;
      }

      // 1. Strict Direction Match: Only trains heading in the trip's direction are eligible
      const trainDir = getTrainDirection(train);
      if (direction !== null && trainDir !== direction) {
        return;
      }

      const remStops = train.remainingStops || [];
      if (!remStops.length) return;

      // 2. Sequence Check: Origin must be in upcoming stops, and Destination must be AFTER Origin
      const originIdx = remStops.findIndex(
        (s) => normalizeStationId(s.stopId) === normOriginId
      );
      const destIdx = remStops.findIndex(
        (s) => normalizeStationId(s.stopId) === normDestId
      );

      // If the train has already departed origin, or does not reach destination after origin, skip
      if (originIdx === -1 || destIdx === -1 || destIdx <= originIdx) {
        return;
      }

      const originStop = remStops[originIdx];
      const destStop = remStops[destIdx];
      const waitSec = originStop.etaSeconds;

      // Ignore trains whose departure from origin was in the past
      if (waitSec < 0) return;

      const rideMins =
        destStop.etaSeconds !== undefined && originStop.etaSeconds !== undefined
          ? Math.max(1, Math.round((destStop.etaSeconds - originStop.etaSeconds) / 60))
          : rideMinutes;

      const depDisplay =
        waitSec <= 45
          ? 'Arriving Now'
          : Math.floor(waitSec / 60) === 0
          ? `in ${waitSec}s`
          : `in ${Math.floor(waitSec / 60)}m ${waitSec % 60}s`;

      const depDate = new Date(Date.now() + Math.max(0, waitSec) * 1000);
      const depTime = depDate.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      const arrDate = new Date(Date.now() + (Math.max(0, waitSec) + rideMins * 60) * 1000);
      const arrTime = arrDate.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      const currentLocation =
        train.isDwelling && originIdx === 0
          ? 'At platform'
          : train.nextStation
          ? `Near ${train.nextStation}`
          : 'In transit';

      candidateLiveTrains.push({
        id: train.id,
        displayId: train.id.replace('KMRL-', '').replace('BMRCL-', ''),
        line: train.line,
        isLive: true,
        direction: trainDir,
        depTime,
        arrTime,
        departureDisplay: depDisplay,
        status: currentLocation,
        waitEtaSeconds: waitSec,
        rideMinutes: rideMins,
      });
    });

    // Sort live trains by arrival at origin ascending
    candidateLiveTrains.sort((a, b) => a.waitEtaSeconds - b.waitEtaSeconds);

    const journeyTrains = [...candidateLiveTrains.slice(0, 4)];

    // 2. Backfill with scheduled departures if fewer than 4 live trains
    if (journeyTrains.length < 4 && scheduledDepartures && scheduledDepartures.length > 0) {
      const lastWaitSec = journeyTrains.length > 0
        ? journeyTrains[journeyTrains.length - 1].waitEtaSeconds
        : 0;
      let addedCount = 0;
      for (const dep of scheduledDepartures) {
        if (journeyTrains.length >= 4) break;
        // Ensure scheduled departure strictly matches direction and line
        if (dep.directionId !== undefined && dep.directionId !== direction) {
          continue;
        }
        if (routeLine && dep.line && dep.line !== routeLine) {
          continue;
        }
        if (!journeyTrains.some((t) => t.id === dep.trainId)) {
          addedCount++;
          const waitSec = Math.max(dep.etaSeconds, lastWaitSec + addedCount * 360);
          const depDate = new Date(Date.now() + waitSec * 1000);
          const depTime = depDate.toLocaleTimeString('en-US', {
            timeZone: 'Asia/Kolkata',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
          const arrDate = new Date(Date.now() + (waitSec + (dep.rideMinutes || rideMinutes) * 60) * 1000);
          const arrTime = arrDate.toLocaleTimeString('en-US', {
            timeZone: 'Asia/Kolkata',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
          journeyTrains.push({
            id: dep.trainId,
            displayId: dep.trainId.replace('KMRL-', '').replace('BMRCL-', ''),
            isLive: false,
            direction: dep.directionId !== undefined ? dep.directionId : direction,
            depTime,
            arrTime,
            departureDisplay: depTime,
            status: `Scheduled at ${depTime}`,
            waitEtaSeconds: waitSec,
            rideMinutes: dep.rideMinutes || rideMinutes,
          });
        }
      }
    }

    return {
      isInterchange: false,
      routeLine,
      isCustomTime: false,
      fare,
      hops,
      rideMinutes,
      journeyTrains,
    };
  }, [currentStation, destinationStation, selectedTime, scheduledDepartures, trains, currentCity]);

  const handleSelectStation = useCallback(
    (st) => {
      setActiveStation(st);
      setViewState((prev) => ({
        ...prev,
        longitude: st.lon,
        latitude: st.lat,
        zoom: 13.5,
      }));
    },
    [setActiveStation]
  );

  const handleSwapStations = () => {
    if (destinationStation && currentStation) {
      const prevDest = destinationStation;
      setDestinationStation(currentStation);
      handleSelectStation(prevDest);
    }
  };

  const handleClearDestination = () => {
    setDestinationStation(null);
  };

  const handleApplyCustomTime = () => {
    if (customTimeInput) {
      setSelectedTime(customTimeInput);
      setIsTimePickerOpen(false);
    }
  };

  const handleResetToNow = () => {
    setSelectedTime(null);
    setIsTimePickerOpen(false);
  };

  const handleSwitchCity = (cityKey) => {
    if (cityKey === currentCity) {
      setIsCityDropdownOpen(false);
      return;
    }
    setIsCityDropdownOpen(false);
    setSelectedTime(null);
    setIsTimePickerOpen(false);
    setScheduledDepartures([]);
    setActiveStation(null);
    setNearestStation(null);
    setDestinationStation(null);
    setCurrentCity(cityKey);
    const targetConfig = CITIES[cityKey];
    if (targetConfig?.center) {
      setViewState({
        ...targetConfig.center,
      });
    }
  };

  const handleRecenterCorridor = () => {
    if (cityConfig?.center) {
      setViewState({
        ...cityConfig.center,
      });
    }
  };

  const firstTrain = tripPlan?.journeyTrains?.[0];
  const subsequentTrains = tripPlan?.journeyTrains?.slice(1) || [];


  return (
    <div
      className="w-full min-h-[100dvh] h-[100dvh] relative overflow-hidden text-white font-sans select-none overscroll-y-contain transition-colors duration-300"
      style={{ backgroundColor: currentTheme.bgApp }}
    >
      {/* 2D/3D MapLibre Vector Radar Map */}
      <MapBase
        viewState={viewState}
        onViewStateChange={setViewState}
        onSelectStation={handleSelectStation}
        padding={mapPadding}
        recommendedTrainId={firstTrain?.id || null}
        routeHighlight={
          destinationStation && currentStation
            ? {
                originId: currentStation.id,
                destinationId: destinationStation.id,
                isInterchange: Boolean(tripPlan?.isInterchange),
                interchangeId: tripPlan?.interchangeDetails?.interchangeStationId || null,
                leg1Line: tripPlan?.interchangeDetails?.leg1?.line || null,
                leg2Line: tripPlan?.interchangeDetails?.leg2?.line || null,
                routeLine: tripPlan?.routeLine || null,
              }
            : null
        }
        onSelectTrain={(t) => navigate(`/train/${t.id}`)}
        theme={currentTheme}
      />

      {/* Floating Frosted Header HUD */}
      <header className="absolute top-3 left-3 right-3 sm:top-5 sm:left-6 sm:right-6 z-20 flex items-center justify-between pointer-events-none gap-2">
        <div className="relative pointer-events-auto">
          <div
            className={`px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl border backdrop-blur-xl flex items-center gap-2.5 sm:gap-3 transition-colors ${
              isLight
                ? 'border-slate-200 bg-white/95 text-slate-900 shadow-md'
                : 'border-white/15 bg-[#0E1626]/90 text-white shadow-[0_4px_20px_rgba(0,0,0,0.5)]'
            }`}
          >
            {/* Interactive City Dropdown Trigger */}
            <button
              type="button"
              onClick={() => setIsCityDropdownOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 -ml-1 px-1.5 py-0.5 rounded-lg transition-colors group ${
                isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'
              }`}
              title="Switch Metro City"
            >
              <span
                className={`font-sans text-xs font-extrabold tracking-wider uppercase ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}
              >
                {cityConfig?.headerTitle || 'KOCHI METRO RADAR'}
              </span>
              <ChevronDown
                size={13}
                strokeWidth={2.5}
                className={`transition-transform duration-200 ${
                  isCityDropdownOpen ? 'rotate-180' : ''
                } ${isLight ? 'text-slate-500 group-hover:text-slate-800' : 'text-slate-400 group-hover:text-white'}`}
              />
            </button>

            <div className={`h-3 w-[1px] ${isLight ? 'bg-slate-300' : 'bg-white/20'}`} />
            {isOpen ? (
              <span
                className={`font-sans text-xs font-medium ${
                  isLight ? 'text-slate-600' : 'text-slate-300'
                }`}
              >
                <strong className={`font-mono font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {activeTrainsCount}
                </strong>{' '}
                active
              </span>
            ) : (
              <span className="font-sans text-xs text-amber-500 font-semibold flex items-center gap-1.5">
                Service Closed
              </span>
            )}
            <div className={`h-3 w-[1px] ${isLight ? 'bg-slate-300' : 'bg-white/20'} hidden sm:block`} />
            <span
              className={`font-mono text-xs hidden sm:inline tabular-nums ${
                isLight ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              {istTime || '--:--:--'}{' '}
              <span className={`font-sans text-[10px] font-bold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                IST
              </span>
            </span>
          </div>

          {/* City Selection Dropdown Panel */}
          <AnimatePresence>
            {isCityDropdownOpen && (
              <>
                <div
                  onClick={() => setIsCityDropdownOpen(false)}
                  className="fixed inset-0 z-40"
                />
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className={`absolute top-full left-0 mt-2 min-w-[240px] sm:min-w-[270px] rounded-2xl border backdrop-blur-2xl shadow-2xl p-1.5 z-50 flex flex-col gap-1 ${
                    isLight
                      ? 'bg-white/95 border-slate-200 shadow-slate-300/60'
                      : 'bg-[#0E1626]/95 border-white/15 shadow-[0_10px_35px_rgba(0,0,0,0.8)]'
                  }`}
                >
                  <div className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                    isLight ? 'text-slate-400' : 'text-slate-400'
                  }`}>
                    Select Metro Corridor
                  </div>
                  {Object.values(CITIES).map((c) => {
                    const isSelected = c.id === currentCity;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSwitchCity(c.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all ${
                          isSelected
                            ? isLight
                              ? 'bg-slate-100 text-slate-950 font-bold'
                              : 'bg-white/10 text-white font-bold'
                            : isLight
                            ? 'text-slate-700 hover:bg-slate-50'
                            : 'text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                            style={{ backgroundColor: c.color }}
                          />
                          <div className="flex flex-col">
                            <span className="font-sans text-xs font-bold leading-tight">
                              {c.name}
                            </span>
                            <span className={`font-sans text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                              {c.subname}
                            </span>
                          </div>
                        </div>
                        {isSelected && (
                          <span
                            className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase"
                            style={{
                              backgroundColor: `${c.color}20`,
                              color: c.color,
                            }}
                          >
                            Active
                          </span>
                        )}
                      </button>
                    );
                  })}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Recenter Action + Theme Toggle (Live badge removed) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {!isOpen && (
            <div
              className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl border backdrop-blur-xl flex items-center gap-2 shadow-md transition-colors ${
                isLight
                  ? 'border-amber-200 bg-amber-50/95 text-amber-800'
                  : 'border-amber-500/30 bg-[#17141F]/90 text-amber-300 shadow-[0_4px_20px_rgba(0,0,0,0.5)]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
              <span className="font-sans text-[11px] sm:text-xs font-bold tracking-wide uppercase">
                Opens {opensAt || '06:00 AM'}
              </span>
            </div>
          )}

          {/* Buy Me a Coffee Support Button (Responsive: Icon on Mobile, Pill on Desktop) */}
          <a
            href={BUY_ME_A_COFFEE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`w-9 h-9 sm:w-auto sm:h-10 px-0 sm:px-3.5 rounded-full border backdrop-blur-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all group ${
              isLight
                ? 'border-amber-200/90 bg-amber-50/90 hover:bg-amber-100 text-amber-900 shadow-sm'
                : 'border-amber-500/30 bg-[#1A150A]/85 hover:bg-[#251D0C] text-amber-300 shadow-[0_4px_20px_rgba(245,158,11,0.15)]'
            }`}
            title="Support Kochi Metro Radar on Buy Me a Coffee"
          >
            <BuyMeACoffeeIcon
              className="w-[18px] h-[22px] group-hover:scale-110 group-hover:rotate-6 transition-transform duration-200 shrink-0"
              outlineColor={isLight ? '#0D0C22' : '#FFFFFF'}
            />
            <span className="hidden sm:inline font-sans text-xs font-bold tracking-tight">
              Buy me a coffee
            </span>
          </a>

          {/* Recenter Map Button */}
          <button
            onClick={handleRecenterCorridor}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border backdrop-blur-xl flex items-center justify-center shadow-lg active:scale-95 transition-all ${
              isLight
                ? 'border-slate-200 bg-white/95 hover:bg-slate-100 text-slate-700 hover:text-slate-900 shadow-md'
                : 'border-white/15 bg-[#0E1626]/90 hover:bg-[#152238] text-slate-300 hover:text-white'
            }`}
            title="Recenter Metro Corridor"
          >
            <Compass size={18} strokeWidth={2.2} />
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border backdrop-blur-xl flex items-center justify-center shadow-lg active:scale-95 transition-all ${
              isLight
                ? 'border-slate-200 bg-white/95 hover:bg-slate-100 text-amber-500 hover:text-amber-600 shadow-md'
                : 'border-white/15 bg-[#0E1626]/90 hover:bg-[#152238] text-sky-400 hover:text-sky-300'
            }`}
            title={`Switch to ${isLight ? 'Dark' : 'Light'} Mode`}
          >
            {isLight ? <Moon size={18} strokeWidth={2.2} /> : <Sun size={18} strokeWidth={2.2} />}
          </button>
        </div>
      </header>

      {/* Floating Commuter Drawer or Compact Expanded Map Status Bar */}
      <AnimatePresence mode="wait">
        {isMapExpanded ? (
          <motion.div
            key="expanded-map-bar"
            initial={{ opacity: 0, y: 15, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-4 left-3 right-3 sm:bottom-6 sm:left-6 sm:right-auto z-30 pointer-events-auto"
          >
            <button
              type="button"
              onClick={() => setIsMapExpanded(false)}
              className={`px-3.5 py-2.5 sm:px-4 sm:py-2.5 rounded-2xl border backdrop-blur-2xl shadow-xl flex items-center justify-between sm:justify-start gap-3 transition-all active:scale-95 group ${
                isLight
                  ? 'bg-white/95 border-slate-200 text-slate-900 hover:border-slate-300'
                  : 'bg-[#0E1626]/95 border-white/15 text-white hover:border-white/30 shadow-[0_8px_32px_rgba(0,0,0,0.6)]'
              }`}
              title="Show Metro Details Panel"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full ${isLight ? 'bg-teal-600' : 'bg-sky-400'} shrink-0`} />
                <div className="flex items-center gap-1.5 text-xs font-bold truncate">
                  <span>{currentStation?.name || 'Origin'}</span>
                  <span className={isLight ? 'text-slate-400' : 'text-slate-500'}>➔</span>
                  <span>{destinationStation?.name || 'Select Dest'}</span>
                </div>
              </div>

              {firstTrain && (
                <span
                  className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg shrink-0 ${
                    isLight ? 'bg-teal-50 text-teal-700' : 'bg-teal-500/15 text-teal-400'
                  }`}
                >
                  {firstTrain.waitEtaSeconds !== undefined && firstTrain.waitEtaSeconds <= 45
                    ? 'Arriving Now'
                    : `in ${Math.max(1, Math.round((firstTrain.waitEtaSeconds || 0) / 60))}m`}
                </span>
              )}

              <div className="flex items-center gap-1 text-xs font-semibold text-slate-400 group-hover:text-white shrink-0 ml-1">
                <span className="hidden sm:inline text-[11px]">Show Panel</span>
                <ChevronUp size={15} strokeWidth={2.2} />
              </div>
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="commuter-drawer"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            drag={isMobile ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.15}
            onDragEnd={(e, info) => {
              if (info.offset.y > 40) {
                setIsDrawerExpanded(false);
              } else if (info.offset.y < -40) {
                setIsDrawerExpanded(true);
              }
            }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-6 sm:right-auto sm:w-[370px] z-30 pointer-events-auto overscroll-y-contain"
          >
            <div
              className={`p-3.5 sm:p-4 rounded-t-[26px] sm:rounded-3xl border ${currentTheme.drawerBorder} ${currentTheme.drawerBg} backdrop-blur-2xl flex flex-col gap-2.5 max-h-[82vh] sm:max-h-[80vh] overflow-hidden ${
                isLight ? 'shadow-[0_16px_50px_rgba(0,0,0,0.12)]' : 'shadow-[0_16px_50px_rgba(0,0,0,0.7)]'
              } transition-all duration-300`}
            >
              {/* Header Action Bar: Expand Map Toggle + Mobile Drag Bar */}
              <div className="flex items-center justify-between pt-0.5 pb-0.5 px-0.5">
                <button
                  type="button"
                  onClick={() => setIsMapExpanded(true)}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-colors ${
                    isLight
                      ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                  title="Expand Map Canvas"
                >
                  <Maximize2 size={12} strokeWidth={2.2} />
                  <span>Expand Map</span>
                </button>

                {/* Min/Max Peek Toggle */}
                <button
                  type="button"
                  onClick={() => setIsDrawerExpanded(!isDrawerExpanded)}
                  className={`p-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    isLight
                      ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                  title={isDrawerExpanded ? 'Minimize drawer' : 'Expand drawer'}
                >
                  {isDrawerExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
              </div>

              {/* Interactive Station Pills Selector */}
              <StationPills
                originStation={currentStation}
                destinationStation={destinationStation}
                onOpenPicker={(mode) => setStationPickerMode(mode)}
                onSwap={handleSwapStations}
                onClearDestination={handleClearDestination}
                theme={currentTheme}
              />

          {/* Key Details Strip (Fare + Stops + Depart later?) */}
          <div
            className={`flex items-center justify-between px-1 py-1 border-b ${
              isLight ? 'border-slate-200' : 'border-white/10'
            }`}
          >
            {destinationStation && tripPlan ? (
              <div className="flex items-baseline gap-2 flex-wrap">
                <span
                  className={`font-mono text-xl sm:text-2xl font-extrabold ${
                    isLight ? 'text-rose-600' : 'text-rose-500'
                  }`}
                >
                  ₹{tripPlan.fare}
                </span>
                <span
                  className={`font-sans text-xs font-medium ${
                    isLight ? 'text-slate-600' : 'text-slate-300'
                  }`}
                >
                  {tripPlan.hops} stops • ~{tripPlan.rideMinutes} mins
                </span>
                {tripPlan.isInterchange && (
                  <span className="font-sans text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 shadow-xs">
                    {tripPlan.interchangeDetails?.isDoubleTransfer ? '2 Transfers' : '1 Transfer'}
                  </span>
                )}
              </div>
            ) : (
              <span
                className={`font-sans text-xs font-medium ${
                  isLight ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                Select destination to view first train & fare
              </span>
            )}

            {/* Depart later? Action */}
            {!selectedTime ? (
              !isTimePickerOpen ? (
                <button
                  type="button"
                  onClick={() => setIsTimePickerOpen(true)}
                  className={`flex items-center gap-1.5 text-xs font-semibold transition-colors py-1 px-2.5 rounded-lg border active:scale-95 ${
                    isLight
                      ? 'text-teal-700 bg-teal-50 border-teal-200 hover:bg-teal-100'
                      : 'text-sky-400 bg-sky-500/10 border-sky-500/20 hover:text-sky-300'
                  }`}
                >
                  <Clock size={12} strokeWidth={2.2} />
                  <span>Depart later?</span>
                </button>
              ) : (
                <div
                  className={`flex items-center gap-1.5 p-1.5 rounded-xl border ${
                    isLight ? 'bg-white border-slate-200 shadow-lg' : 'bg-[#0B0F19] border-white/15'
                  }`}
                >
                  <input
                    type="time"
                    value={customTimeInput}
                    onChange={(e) => setCustomTimeInput(e.target.value)}
                    className={`border rounded px-1.5 py-0.5 text-xs font-mono font-bold focus:outline-none ${
                      isLight
                        ? 'bg-slate-50 text-slate-900 border-slate-200 focus:border-teal-600'
                        : 'bg-transparent text-white border-white/10 focus:border-sky-400'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleApplyCustomTime}
                    className={`px-2 py-0.5 rounded text-xs font-sans font-bold text-white transition-colors ${
                      isLight ? 'bg-teal-600 hover:bg-teal-700' : 'bg-sky-500 hover:bg-sky-400'
                    }`}
                  >
                    Set
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTimePickerOpen(false)}
                    className={`p-0.5 ${isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-400 hover:text-white'}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              )
            ) : (
              <div
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-sans ${
                  isLight
                    ? 'bg-teal-50 border-teal-200 text-teal-800'
                    : 'bg-sky-500/15 border-sky-400/30 text-sky-300'
                }`}
              >
                <Clock size={12} />
                <span>After <strong>{formatTime12h(selectedTime)}</strong></span>
                <button
                  type="button"
                  onClick={handleResetToNow}
                  className={`ml-1 ${isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-400 hover:text-white'}`}
                  title="Reset to Live"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          {/* PRIMARY TRAIN PILL (FIRST TRAIN) OR STEP-BY-STEP INTERCHANGE CARD */}
          {destinationStation && (
            tripPlan?.isInterchange ? (
              <TransferJourneyCard
                interchangeDetails={tripPlan.interchangeDetails}
                originStation={currentStation}
                destinationStation={destinationStation}
                leg1LiveTrain={firstTrain}
                selectedTime={selectedTime}
                isLight={isLight}
                onSelectLeg1Train={(t) => t?.id && navigate(`/train/${t.id}`)}
              />
            ) : firstTrain ? (
              <TrainJourneyCard
                train={firstTrain}
                liveTrainData={firstTrain.isLive ? trains.find((t) => t.id === firstTrain.id) : null}
                isPrimary={true}
                isLight={isLight}
                onSelect={() => firstTrain.id && navigate(`/train/${firstTrain.id}`)}
              />
            ) : null
          )}

          {/* Toggle Button in Minimized Mode to reveal upcoming trains */}
          {destinationStation && !isDrawerExpanded && subsequentTrains.length > 0 && (
            <button
              type="button"
              onClick={() => setIsDrawerExpanded(true)}
              className={`w-full py-1.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all active:scale-98 ${
                isLight
                  ? 'bg-slate-100/80 hover:bg-slate-200/80 border-slate-200 text-slate-700 hover:text-slate-900'
                  : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              <span>View {subsequentTrains.length} more upcoming metros</span>
              <ChevronUp size={14} />
            </button>
          )}

          {/* Drawer Expandable Body (Visible when maximized / expanded) */}
          <AnimatePresence>
            {isDrawerExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-y-auto flex flex-col gap-2.5 pr-1 pb-1 overscroll-contain"
              >
                {/* Off-Hours Service Closed Alert */}
                {!isOpen && (
                  <div
                    className={`p-3 rounded-2xl border flex items-start gap-2.5 text-xs ${
                      isLight
                        ? 'border-amber-200 bg-amber-50 text-amber-900'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                    }`}
                  >
                    <Moon size={15} className={`shrink-0 mt-0.5 ${isLight ? 'text-amber-600' : 'text-amber-400'}`} />
                    <div className="flex flex-col gap-0.5">
                      <span className={`font-sans font-bold ${isLight ? 'text-amber-900' : 'text-amber-300'}`}>
                        Service Closed for the Night
                      </span>
                      <span className={`text-[11px] leading-relaxed ${isLight ? 'text-amber-800' : 'text-slate-300'}`}>
                        {currentCity === 'bengaluru' ? 'Namma Metro' : 'Kochi Metro'} trains have concluded operations for today. Tomorrow's morning services resume at{' '}
                        <strong className={isLight ? 'text-amber-950 font-bold' : 'text-white font-semibold'}>
                          {opensAt || '06:00 AM'} IST
                        </strong>.
                      </span>
                    </div>
                  </div>
                )}

                {/* Subsequent Trains Header */}
                {destinationStation && subsequentTrains.length > 0 && (
                  <div className="flex items-center justify-between px-1 pt-1">
                    <span
                      className={`font-sans text-[11px] uppercase tracking-wider font-extrabold ${
                        isLight ? 'text-slate-500' : 'text-slate-400'
                      }`}
                    >
                      {tripPlan?.isInterchange ? 'LATER LEG 1 DEPARTURES' : 'LATER DEPARTURES'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsDrawerExpanded(false)}
                      className={`text-xs flex items-center gap-1 transition-colors ${
                        isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>Minimize</span>
                      <ChevronDown size={13} />
                    </button>
                  </div>
                )}

                {/* Subsequent Trains Cards */}
                {destinationStation && subsequentTrains.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {subsequentTrains.slice(0, 3).map((train, idx) => (
                      <TrainJourneyCard
                        key={train.id || idx}
                        train={train}
                        liveTrainData={train.isLive ? trains.find((t) => t.id === train.id) : null}
                        isPrimary={false}
                        isLight={isLight}
                        onSelect={() => train.id && navigate(`/train/${train.id}`)}
                      />
                    ))}
                  </div>
                ) : destinationStation && !firstTrain && !tripPlan?.isInterchange ? (
                  <div
                    className={`p-6 rounded-2xl border text-center font-sans text-xs font-medium ${
                      isLight ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-white/10 bg-[#0B0F19]/80 text-slate-400'
                    }`}
                  >
                    {isLoadingSchedule ? 'Checking metro schedules...' : 'No upcoming trains found for this route.'}
                  </div>
                ) : null}

                {/* Platform Departures When No Destination is Chosen */}
                {!destinationStation && (
                  <div className="flex flex-col gap-2.5">
                    {currentStation?.id === 'BLR-MAJ-15' ? (
                      <>
                        {/* Majestic 4-Platform Bi-Level Breakdown */}
                        {/* 1. Green Line Elevated Level */}
                        <div className="flex items-center gap-1.5 pt-1 px-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                          <span className={`font-sans text-[11px] font-extrabold uppercase tracking-wider ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                            Green Line • Elevated Level
                          </span>
                        </div>

                        {/* Platform 1: Towards Madavara */}
                        <div className={`p-3 rounded-2xl border flex flex-col gap-2 ${isLight ? 'border-slate-200 bg-slate-50/70' : 'border-white/10 bg-white/[0.02]'}`}>
                          <div className={`flex items-center justify-between border-b pb-1.5 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                            <span className={`font-sans text-xs sm:text-sm font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                              Towards Madavara (BIEC)
                            </span>
                            <span className={`font-sans text-[10px] font-bold uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                              Platform 1
                            </span>
                          </div>
                          {liveStationArrivals.greenNorth.length > 0 ? (
                            <div className="flex flex-col gap-1.5">
                              {liveStationArrivals.greenNorth.slice(0, 3).map((arr) => (
                                <div
                                  key={arr.train.id}
                                  onClick={() => arr.train?.id && navigate(`/train/${arr.train.id}`)}
                                  className={`p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all active:scale-[0.99] ${
                                    isLight ? 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-100/70 text-slate-900 shadow-xs' : 'bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.06] text-white'
                                  }`}
                                  title={`Track Train ${arr.train.id} Live`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                    <span className={`font-bold shrink-0 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                      {arr.train.id}
                                    </span>
                                    {arr.train?.destination && (
                                      <span className={`text-[10px] font-sans truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                        ➔ {arr.train.destination}
                                      </span>
                                    )}
                                  </div>
                                  <span className={`font-mono font-bold shrink-0 ml-2 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
                                    {arr.etaSeconds <= 0 ? 'Arriving now' : `in ${Math.floor(arr.etaSeconds / 60)}m`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className={`text-[11px] py-1 text-center ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                              {isOpen ? 'No approaching trains' : `Service opens at ${opensAt || '06:00 AM'}`}
                            </span>
                          )}
                        </div>

                        {/* Platform 2: Towards Silk Institute */}
                        <div className={`p-3 rounded-2xl border flex flex-col gap-2 ${isLight ? 'border-slate-200 bg-slate-50/70' : 'border-white/10 bg-white/[0.02]'}`}>
                          <div className={`flex items-center justify-between border-b pb-1.5 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                            <span className={`font-sans text-xs sm:text-sm font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                              Towards Silk Institute
                            </span>
                            <span className={`font-sans text-[10px] font-bold uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                              Platform 2
                            </span>
                          </div>
                          {liveStationArrivals.greenSouth.length > 0 ? (
                            <div className="flex flex-col gap-1.5">
                              {liveStationArrivals.greenSouth.slice(0, 3).map((arr) => (
                                <div
                                  key={arr.train.id}
                                  onClick={() => arr.train?.id && navigate(`/train/${arr.train.id}`)}
                                  className={`p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all active:scale-[0.99] ${
                                    isLight ? 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-100/70 text-slate-900 shadow-xs' : 'bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.06] text-white'
                                  }`}
                                  title={`Track Train ${arr.train.id} Live`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                    <span className={`font-bold shrink-0 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                      {arr.train.id}
                                    </span>
                                    {arr.train?.destination && (
                                      <span className={`text-[10px] font-sans truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                        ➔ {arr.train.destination}
                                      </span>
                                    )}
                                  </div>
                                  <span className={`font-mono font-bold shrink-0 ml-2 ${isLight ? 'text-amber-600' : 'text-amber-400'}`}>
                                    {arr.etaSeconds <= 0 ? 'Arriving now' : `in ${Math.floor(arr.etaSeconds / 60)}m`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className={`text-[11px] py-1 text-center ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                              {isOpen ? 'No approaching trains' : `Service opens at ${opensAt || '06:00 AM'}`}
                            </span>
                          )}
                        </div>

                        {/* 2. Purple Line Underground Level */}
                        <div className="flex items-center gap-1.5 pt-2 px-1">
                          <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.8)]" />
                          <span className={`font-sans text-[11px] font-extrabold uppercase tracking-wider ${isLight ? 'text-purple-700' : 'text-purple-400'}`}>
                            Purple Line • Underground Level
                          </span>
                        </div>

                        {/* Platform 3: Towards Whitefield */}
                        <div className={`p-3 rounded-2xl border flex flex-col gap-2 ${isLight ? 'border-slate-200 bg-slate-50/70' : 'border-white/10 bg-white/[0.02]'}`}>
                          <div className={`flex items-center justify-between border-b pb-1.5 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                            <span className={`font-sans text-xs sm:text-sm font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                              Towards Whitefield (Kadugodi)
                            </span>
                            <span className={`font-sans text-[10px] font-bold uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                              Platform 3
                            </span>
                          </div>
                          {liveStationArrivals.purpleEast.length > 0 ? (
                            <div className="flex flex-col gap-1.5">
                              {liveStationArrivals.purpleEast.slice(0, 3).map((arr) => (
                                <div
                                  key={arr.train.id}
                                  onClick={() => arr.train?.id && navigate(`/train/${arr.train.id}`)}
                                  className={`p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all active:scale-[0.99] ${
                                    isLight ? 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-100/70 text-slate-900 shadow-xs' : 'bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.06] text-white'
                                  }`}
                                  title={`Track Train ${arr.train.id} Live`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                                    <span className={`font-bold shrink-0 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                      {arr.train.id}
                                    </span>
                                    {arr.train?.destination && (
                                      <span className={`text-[10px] font-sans truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                        ➔ {arr.train.destination}
                                      </span>
                                    )}
                                  </div>
                                  <span className={`font-mono font-bold shrink-0 ml-2 ${isLight ? 'text-purple-600' : 'text-purple-400'}`}>
                                    {arr.etaSeconds <= 0 ? 'Arriving now' : `in ${Math.floor(arr.etaSeconds / 60)}m`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className={`text-[11px] py-1 text-center ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                              {isOpen ? 'No approaching trains' : `Service opens at ${opensAt || '06:00 AM'}`}
                            </span>
                          )}
                        </div>

                        {/* Platform 4: Towards Challaghatta */}
                        <div className={`p-3 rounded-2xl border flex flex-col gap-2 ${isLight ? 'border-slate-200 bg-slate-50/70' : 'border-white/10 bg-white/[0.02]'}`}>
                          <div className={`flex items-center justify-between border-b pb-1.5 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                            <span className={`font-sans text-xs sm:text-sm font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                              Towards Challaghatta
                            </span>
                            <span className={`font-sans text-[10px] font-bold uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                              Platform 4
                            </span>
                          </div>
                          {liveStationArrivals.purpleWest.length > 0 ? (
                            <div className="flex flex-col gap-1.5">
                              {liveStationArrivals.purpleWest.slice(0, 3).map((arr) => (
                                <div
                                  key={arr.train.id}
                                  onClick={() => arr.train?.id && navigate(`/train/${arr.train.id}`)}
                                  className={`p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all active:scale-[0.99] ${
                                    isLight ? 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-100/70 text-slate-900 shadow-xs' : 'bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.06] text-white'
                                  }`}
                                  title={`Track Train ${arr.train.id} Live`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                                    <span className={`font-bold shrink-0 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                      {arr.train.id}
                                    </span>
                                    {arr.train?.destination && (
                                      <span className={`text-[10px] font-sans truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                        ➔ {arr.train.destination}
                                      </span>
                                    )}
                                  </div>
                                  <span className={`font-mono font-bold shrink-0 ml-2 ${isLight ? 'text-purple-600' : 'text-purple-400'}`}>
                                    {arr.etaSeconds <= 0 ? 'Arriving now' : `in ${Math.floor(arr.etaSeconds / 60)}m`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className={`text-[11px] py-1 text-center ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                              {isOpen ? 'No approaching trains' : `Service opens at ${opensAt || '06:00 AM'}`}
                            </span>
                          )}
                        </div>
                      </>
                    ) : currentStation?.id === 'BLR-GRN-23' ? (
                      <>
                        {/* RV Road 4-Platform Interchange Breakdown */}
                        {/* 1. Green Line Elevated Level */}
                        <div className="flex items-center gap-1.5 pt-1 px-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                          <span className={`font-sans text-[11px] font-extrabold uppercase tracking-wider ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                            Green Line • Concourse Level
                          </span>
                        </div>

                        {/* Platform 1: Towards Madavara */}
                        <div className={`p-3 rounded-2xl border flex flex-col gap-2 ${isLight ? 'border-slate-200 bg-slate-50/70' : 'border-white/10 bg-white/[0.02]'}`}>
                          <div className={`flex items-center justify-between border-b pb-1.5 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                            <span className={`font-sans text-xs sm:text-sm font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                              Towards Madavara (BIEC)
                            </span>
                            <span className={`font-sans text-[10px] font-bold uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                              Platform 1
                            </span>
                          </div>
                          {liveStationArrivals.greenNorth.length > 0 ? (
                            <div className="flex flex-col gap-1.5">
                              {liveStationArrivals.greenNorth.slice(0, 3).map((arr) => (
                                <div
                                  key={arr.train.id}
                                  onClick={() => arr.train?.id && navigate(`/train/${arr.train.id}`)}
                                  className={`p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all active:scale-[0.99] ${
                                    isLight ? 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-100/70 text-slate-900 shadow-xs' : 'bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.06] text-white'
                                  }`}
                                  title={`Track Train ${arr.train.id} Live`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                    <span className={`font-bold shrink-0 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                      {arr.train.id}
                                    </span>
                                    {arr.train?.destination && (
                                      <span className={`text-[10px] font-sans truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                        ➔ {arr.train.destination}
                                      </span>
                                    )}
                                  </div>
                                  <span className={`font-mono font-bold shrink-0 ml-2 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
                                    {arr.etaSeconds <= 0 ? 'Arriving now' : `in ${Math.floor(arr.etaSeconds / 60)}m`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className={`text-[11px] py-1 text-center ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                              {isOpen ? 'No approaching trains' : `Service opens at ${opensAt || '06:00 AM'}`}
                            </span>
                          )}
                        </div>

                        {/* Platform 2: Towards Silk Institute */}
                        <div className={`p-3 rounded-2xl border flex flex-col gap-2 ${isLight ? 'border-slate-200 bg-slate-50/70' : 'border-white/10 bg-white/[0.02]'}`}>
                          <div className={`flex items-center justify-between border-b pb-1.5 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                            <span className={`font-sans text-xs sm:text-sm font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                              Towards Silk Institute
                            </span>
                            <span className={`font-sans text-[10px] font-bold uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                              Platform 2
                            </span>
                          </div>
                          {liveStationArrivals.greenSouth.length > 0 ? (
                            <div className="flex flex-col gap-1.5">
                              {liveStationArrivals.greenSouth.slice(0, 3).map((arr) => (
                                <div
                                  key={arr.train.id}
                                  onClick={() => arr.train?.id && navigate(`/train/${arr.train.id}`)}
                                  className={`p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all active:scale-[0.99] ${
                                    isLight ? 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-100/70 text-slate-900 shadow-xs' : 'bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.06] text-white'
                                  }`}
                                  title={`Track Train ${arr.train.id} Live`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                    <span className={`font-bold shrink-0 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                      {arr.train.id}
                                    </span>
                                    {arr.train?.destination && (
                                      <span className={`text-[10px] font-sans truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                        ➔ {arr.train.destination}
                                      </span>
                                    )}
                                  </div>
                                  <span className={`font-mono font-bold shrink-0 ml-2 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
                                    {arr.etaSeconds <= 0 ? 'Arriving now' : `in ${Math.floor(arr.etaSeconds / 60)}m`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className={`text-[11px] py-1 text-center ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                              {isOpen ? 'No approaching trains' : `Service opens at ${opensAt || '06:00 AM'}`}
                            </span>
                          )}
                        </div>

                        {/* 2. Yellow Line Terminus Level */}
                        <div className="flex items-center gap-1.5 pt-2 px-1">
                          <span className="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.8)]" />
                          <span className={`font-sans text-[11px] font-extrabold uppercase tracking-wider ${isLight ? 'text-amber-700' : 'text-yellow-400'}`}>
                            Yellow Line • Platform Level
                          </span>
                        </div>

                        {/* Platform 3: Towards Bommasandra */}
                        <div className={`p-3 rounded-2xl border flex flex-col gap-2 ${isLight ? 'border-slate-200 bg-slate-50/70' : 'border-white/10 bg-white/[0.02]'}`}>
                          <div className={`flex items-center justify-between border-b pb-1.5 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                            <span className={`font-sans text-xs sm:text-sm font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                              Towards Bommasandra (Delta Electronics)
                            </span>
                            <span className={`font-sans text-[10px] font-bold uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                              Platform 3
                            </span>
                          </div>
                          {liveStationArrivals.yellowSouth.length > 0 ? (
                            <div className="flex flex-col gap-1.5">
                              {liveStationArrivals.yellowSouth.slice(0, 3).map((arr) => (
                                <div
                                  key={arr.train.id}
                                  onClick={() => arr.train?.id && navigate(`/train/${arr.train.id}`)}
                                  className={`p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all active:scale-[0.99] ${
                                    isLight ? 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-100/70 text-slate-900 shadow-xs' : 'bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.06] text-white'
                                  }`}
                                  title={`Track Train ${arr.train.id} Live`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
                                    <span className={`font-bold shrink-0 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                      {arr.train.id}
                                    </span>
                                    {arr.train?.destination && (
                                      <span className={`text-[10px] font-sans truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                        ➔ {arr.train.destination}
                                      </span>
                                    )}
                                  </div>
                                  <span className={`font-mono font-bold shrink-0 ml-2 ${isLight ? 'text-amber-600' : 'text-yellow-400'}`}>
                                    {arr.etaSeconds <= 0 ? 'Arriving now' : `in ${Math.floor(arr.etaSeconds / 60)}m`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className={`text-[11px] py-1 text-center ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                              {isOpen ? 'No approaching trains' : `Service opens at ${opensAt || '06:00 AM'}`}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Standard 2-Platform Stations */}
                        <div
                          className={`p-3 rounded-2xl border flex flex-col gap-2 ${
                            isLight ? 'border-slate-200 bg-slate-50/70' : 'border-white/10 bg-white/[0.02]'
                          }`}
                        >
                          <div
                            className={`flex items-center justify-between border-b pb-1.5 ${
                              isLight ? 'border-slate-200' : 'border-white/10'
                            }`}
                          >
                            <span
                              className={`font-sans text-xs sm:text-sm font-bold tracking-tight ${
                                isLight ? 'text-slate-900' : 'text-white'
                              }`}
                            >
                              {currentCity === 'bengaluru'
                                ? currentStation?.line === 'green'
                                  ? 'Towards Madavara (BIEC)'
                                  : currentStation?.line === 'yellow'
                                    ? 'Towards Rashtreeya Vidyalaya Road'
                                    : 'Towards Whitefield (Kadugodi)'
                                : 'Towards Aluva'}
                            </span>
                            <span
                              className={`font-sans text-[10px] font-bold uppercase ${
                                isLight ? 'text-slate-500' : 'text-slate-400'
                              }`}
                            >
                              Platform 1
                            </span>
                          </div>

                          {liveStationArrivals.north.length > 0 ? (
                            <div className="flex flex-col gap-1.5">
                              {liveStationArrivals.north.slice(0, 3).map((arr) => {
                                const name = arr.train.id.startsWith('BMRCL-')
                                  ? arr.train.id
                                  : `KMRL-${arr.train.id.replace('KMRL-', '')}`;
                                const isPurple = arr.train.line === 'purple';
                                const isGreen = arr.train.line === 'green';
                                const isYellow = arr.train.line === 'yellow' || arr.train.id.includes('-Y');
                                return (
                                  <div
                                    key={arr.train.id}
                                    onClick={() => arr.train?.id && navigate(`/train/${arr.train.id}`)}
                                    className={`p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all active:scale-[0.99] ${
                                      isLight
                                        ? 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-100/70 text-slate-900 shadow-xs'
                                        : 'bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.06] text-white'
                                    }`}
                                    title={`Track Train ${name} Live`}
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      {isPurple && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                                      )}
                                      {isGreen && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                      )}
                                      {isYellow && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
                                      )}
                                      <span className={`font-bold shrink-0 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                        {name}
                                      </span>
                                      {arr.train?.destination && (
                                        <span className={`text-[10px] font-sans truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                          ➔ {arr.train.destination}
                                        </span>
                                      )}
                                    </div>
                                    <span
                                      className={`font-mono font-bold shrink-0 ml-2 ${
                                        isYellow
                                          ? isLight
                                            ? 'text-amber-600'
                                            : 'text-yellow-400'
                                          : isLight
                                          ? 'text-emerald-600'
                                          : 'text-emerald-400'
                                      }`}
                                    >
                                      {arr.etaSeconds <= 0 ? 'Arriving now' : `in ${Math.floor(arr.etaSeconds / 60)}m`}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className={`text-[11px] py-1 text-center ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                              {isOpen ? 'No approaching trains' : `Service opens at ${opensAt || '06:00 AM'}`}
                            </span>
                          )}
                        </div>

                        <div
                          className={`p-3 rounded-2xl border flex flex-col gap-2 ${
                            isLight ? 'border-slate-200 bg-slate-50/70' : 'border-white/10 bg-white/[0.02]'
                          }`}
                        >
                          <div
                            className={`flex items-center justify-between border-b pb-1.5 ${
                              isLight ? 'border-slate-200' : 'border-white/10'
                            }`}
                          >
                            <span
                              className={`font-sans text-xs sm:text-sm font-bold tracking-tight ${
                                isLight ? 'text-slate-900' : 'text-white'
                              }`}
                            >
                              {currentCity === 'bengaluru'
                                ? currentStation?.line === 'green'
                                  ? 'Towards Silk Institute'
                                  : currentStation?.line === 'yellow'
                                    ? 'Towards Bommasandra'
                                    : 'Towards Challaghatta'
                                : 'Towards Thripunithura'}
                            </span>
                            <span
                              className={`font-sans text-[10px] font-bold uppercase ${
                                isLight ? 'text-slate-500' : 'text-slate-400'
                              }`}
                            >
                              Platform 2
                            </span>
                          </div>

                          {liveStationArrivals.south.length > 0 ? (
                            <div className="flex flex-col gap-1.5">
                              {liveStationArrivals.south.slice(0, 3).map((arr) => {
                                const name = arr.train.id.startsWith('BMRCL-')
                                  ? arr.train.id
                                  : `KMRL-${arr.train.id.replace('KMRL-', '')}`;
                                const isPurple = arr.train.line === 'purple';
                                const isGreen = arr.train.line === 'green';
                                const isYellow = arr.train.line === 'yellow' || arr.train.id.includes('-Y');
                                return (
                                  <div
                                    key={arr.train.id}
                                    onClick={() => arr.train?.id && navigate(`/train/${arr.train.id}`)}
                                    className={`p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all active:scale-[0.99] ${
                                      isLight
                                        ? 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-100/70 text-slate-900 shadow-xs'
                                        : 'bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.06] text-white'
                                    }`}
                                    title={`Track Train ${name} Live`}
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      {isPurple && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                                      )}
                                      {isGreen && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                      )}
                                      {isYellow && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
                                      )}
                                      <span className={`font-bold shrink-0 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                        {name}
                                      </span>
                                      {arr.train?.destination && (
                                        <span className={`text-[10px] font-sans truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                          ➔ {arr.train.destination}
                                        </span>
                                      )}
                                    </div>
                                    <span
                                      className={`font-mono font-bold shrink-0 ml-2 ${
                                        isYellow
                                          ? isLight
                                            ? 'text-amber-600'
                                            : 'text-yellow-400'
                                          : isLight
                                          ? 'text-amber-600'
                                          : 'text-amber-400'
                                      }`}
                                    >
                                      {arr.etaSeconds <= 0 ? 'Arriving now' : `in ${Math.floor(arr.etaSeconds / 60)}m`}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className={`text-[11px] py-1 text-center ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                              {isOpen ? 'No approaching trains' : `Service opens at ${opensAt || '06:00 AM'}`}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Station Picker Modal (No Search Input) */}
      <StationPickerModal
        isOpen={stationPickerMode !== null}
        onClose={() => setStationPickerMode(null)}
        mode={stationPickerMode || 'origin'}
        stations={stations}
        activeStation={currentStation}
        destinationStation={destinationStation}
        theme={currentTheme}
        cityConfig={cityConfig}
        onSelectStation={(st, isDestination) => {
          if (isDestination) {
            setDestinationStation(st);
          } else {
            handleSelectStation(st);
          }
        }}
      />
    </div>
  );
}
