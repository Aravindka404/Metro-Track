import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, Clock, X, Moon, Sun, Compass } from 'lucide-react';
import { BuyMeACoffeeIcon } from '../components/BuyMeACoffeeIcon.jsx';
import { MapBase } from '../components/MapBase.jsx';
import { StationPills } from '../components/StationPills.jsx';
import { StationPickerModal } from '../components/StationPickerModal.jsx';
import { useStationContext } from '../context/useStationContext.jsx';
import {
  calculateKochiMetroFare,
  estimateRideDurationMinutes,
  getTripDirection,
  getStationHopCount,
  normalizeStationId,
} from '../utils/fareCalculator.js';
import { THEMES, getStoredTheme, saveTheme } from '../utils/themeConfig.js';

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

// Safely extract train direction: 0 = Southbound (towards Tripunithura), 1 = Northbound (towards Aluva)
function getTrainDirection(train) {
  if (!train) return null;
  if (typeof train.directionId === 'number') return train.directionId;
  if (typeof train.direction === 'number') return train.direction;
  if (typeof train.id === 'string') {
    if (train.id.includes('-N')) return 1;
    if (train.id.includes('-S')) return 0;
  }
  return null;
}

export function NetworkView() {
  const {
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

  // Destination & Drawer state
  const [destinationStation, setDestinationStation] = useState(null);
  // Default is minimized / peek mode so user sees the map + first train immediately!
  const [isDrawerExpanded, setIsDrawerExpanded] = useState(false);
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

  // Map padding so corridor remains nicely framed above the drawer
  const mapPadding = useMemo(() => {
    if (isMobile) {
      return {
        bottom: isDrawerExpanded ? Math.round(window.innerHeight * 0.52) : 250,
        top: 80,
        left: 20,
        right: 20,
      };
    }
    return {
      bottom: 40,
      top: 40,
      left: 480,
      right: 40,
    };
  }, [isMobile, isDrawerExpanded]);

  const [viewState, setViewState] = useState({
    longitude: 76.315,
    latitude: 10.025,
    zoom: 12.5,
  });

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

  // Fallback initial station
  useEffect(() => {
    if (stations.length > 0 && !activeStation && !nearestStation) {
      setActiveStation(stations[0]);
    }
  }, [stations, activeStation, nearestStation, setActiveStation]);

  // Set default destination (e.g. Edapally if starting at Aluva)
  useEffect(() => {
    if (stations.length > 0 && !destinationStation && currentStation) {
      const edap = stations.find((s) => normalizeStationId(s.id) === 'EDAP');
      if (edap && edap.id !== currentStation.id) {
        setDestinationStation(edap);
      } else {
        const alt = stations.find((s) => s.id !== currentStation.id);
        if (alt) setDestinationStation(alt);
      }
    }
  }, [stations, currentStation, destinationStation]);

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

    fetch(`/api/plan?origin=${originId}&destination=${destId}${timeParam}`)
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
  }, [currentStation?.id, destinationStation?.id, selectedTime]);

  // Live approaching trains for current station
  const liveStationArrivals = useMemo(() => {
    if (!currentStation || !trains.length) {
      return { north: [], south: [] };
    }

    const currentId = normalizeStationId(currentStation.id);
    const arrivalsNorth = [];
    const arrivalsSouth = [];

    trains.forEach((train) => {
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
        } else if (dir === 0) {
          arrivalsSouth.push(item);
        }
      }
    });

    arrivalsNorth.sort((a, b) => a.etaSeconds - b.etaSeconds);
    arrivalsSouth.sort((a, b) => a.etaSeconds - b.etaSeconds);

    return { north: arrivalsNorth, south: arrivalsSouth };
  }, [currentStation, trains]);

  // Combined Trip Planning Computations
  const tripPlan = useMemo(() => {
    if (!currentStation || !destinationStation) return null;

    const fare = calculateKochiMetroFare(currentStation.id, destinationStation.id);
    const hops = getStationHopCount(currentStation.id, destinationStation.id);
    const rideMinutes = estimateRideDurationMinutes(currentStation.id, destinationStation.id);
    const direction = getTripDirection(currentStation.id, destinationStation.id);

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
          displayId: dep.trainId.replace('KMRL-', ''),
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

    const candidateLiveTrains = [];

    trains.forEach((train) => {
      // 1. Strict Direction Match: Only trains heading in the trip's direction are eligible
      const trainDir = getTrainDirection(train);
      if (trainDir !== direction) {
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
        waitSec <= 0
          ? 'Arriving now'
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
        displayId: train.id.replace('KMRL-', ''),
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
      for (const dep of scheduledDepartures) {
        if (journeyTrains.length >= 4) break;
        // Ensure scheduled departure strictly matches direction
        if (dep.directionId !== undefined && dep.directionId !== direction) {
          continue;
        }
        if (!journeyTrains.some((t) => t.id === dep.trainId)) {
          journeyTrains.push({
            id: dep.trainId,
            displayId: dep.trainId.replace('KMRL-', ''),
            isLive: false,
            direction: dep.directionId !== undefined ? dep.directionId : direction,
            depTime: dep.depTime,
            arrTime: dep.arrTime,
            departureDisplay: dep.depTime,
            status: `Scheduled at ${dep.depTime}`,
            waitEtaSeconds: dep.etaSeconds,
            rideMinutes: dep.rideMinutes || rideMinutes,
          });
        }
      }
    }

    return {
      isCustomTime: false,
      fare,
      hops,
      rideMinutes,
      journeyTrains,
    };
  }, [currentStation, destinationStation, selectedTime, scheduledDepartures, trains]);

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

  const handleRecenterCorridor = () => {
    setViewState({
      longitude: 76.315,
      latitude: 10.025,
      zoom: 12.5,
    });
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
            ? { originId: currentStation.id, destinationId: destinationStation.id }
            : null
        }
        onSelectTrain={(t) => navigate(`/train/${t.id}`)}
        theme={currentTheme}
      />

      {/* Floating Frosted Header HUD */}
      <header className="absolute top-3 left-3 right-3 sm:top-5 sm:left-6 sm:right-6 z-20 flex items-center justify-between pointer-events-none gap-2">
        <div
          className={`pointer-events-auto px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl border backdrop-blur-xl flex items-center gap-2.5 sm:gap-3 transition-colors ${
            isLight
              ? 'border-slate-200 bg-white/95 text-slate-900 shadow-md'
              : 'border-white/15 bg-[#0E1626]/90 text-white shadow-[0_4px_20px_rgba(0,0,0,0.5)]'
          }`}
        >
          <span
            className={`font-sans text-xs font-extrabold tracking-wider uppercase ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}
          >
            KOCHI METRO RADAR
          </span>
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

      {/* Floating Commuter Drawer / Mobile Bottom Sheet */}
      <motion.div
        drag={isMobile ? 'y' : false}
        dragConstraints={{ top: 0, bottom: 250 }}
        dragElastic={0.15}
        onDragEnd={(e, info) => {
          if (info.offset.y > 60) {
            setIsDrawerExpanded(false);
          } else if (info.offset.y < -60) {
            setIsDrawerExpanded(true);
          }
        }}
        animate={{
          y: isMobile
            ? isDrawerExpanded
              ? 0
              : 'calc(100% - 240px)'
            : 0,
        }}
        transition={{ type: 'spring', damping: 26, stiffness: 220 }}
        className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-6 sm:right-auto sm:w-[440px] z-30 pointer-events-auto overscroll-y-contain"
      >
        <div
          className={`p-4 sm:p-5 rounded-t-[28px] sm:rounded-3xl border ${currentTheme.drawerBorder} ${currentTheme.drawerBg} backdrop-blur-2xl flex flex-col gap-2.5 max-h-[84vh] sm:max-h-[82vh] overflow-hidden ${
            isLight ? 'shadow-[0_16px_50px_rgba(0,0,0,0.12)]' : 'shadow-[0_16px_50px_rgba(0,0,0,0.7)]'
          } transition-all duration-300`}
        >
          {/* Mobile Swipe Grab Handle & Tap-to-Toggle Header */}
          <div
            onClick={() => setIsDrawerExpanded(!isDrawerExpanded)}
            className="flex items-center justify-center cursor-pointer py-1 -mt-1 group"
          >
            <div
              className={`w-12 h-1.5 rounded-full transition-colors ${
                isLight ? 'bg-slate-300 group-hover:bg-slate-400' : 'bg-white/25 group-hover:bg-white/40'
              }`}
            />
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
              <div className="flex items-baseline gap-2">
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

          {/* FIRST TRAIN CARD - ALWAYS VISIBLE IN MINIMIZED AND EXPANDED MODES */}
          {destinationStation && firstTrain && (
            <div
              onClick={() => firstTrain.id && navigate(`/train/${firstTrain.id}`)}
              className={`p-3.5 rounded-2xl border flex flex-col gap-1.5 cursor-pointer transition-all active:scale-[0.99] ${
                isLight
                  ? 'border-teal-500/30 bg-teal-50/80 shadow-[0_4px_16px_rgba(15,118,110,0.08)] hover:bg-teal-100/70 hover:border-teal-500/50'
                  : 'border-sky-400/40 bg-sky-500/10 shadow-[0_4px_16px_rgba(14,165,233,0.12)] hover:bg-sky-500/15 hover:border-sky-400/70'
              }`}
              title={`Track Train KMRL-${firstTrain.displayId} Live`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      firstTrain.direction === 1
                        ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                        : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]'
                    }`}
                  />
                  <span
                    className={`font-sans text-sm font-extrabold tracking-tight ${
                      isLight ? 'text-slate-900' : 'text-white'
                    }`}
                  >
                    KMRL-{firstTrain.displayId}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                      isLight
                        ? 'bg-teal-100 text-teal-800 border-teal-300'
                        : 'bg-sky-500/20 text-sky-300 border-sky-400/30'
                    }`}
                  >
                    FIRST TRAIN
                  </span>
                </div>

                <span
                  className={`font-mono text-sm sm:text-base font-extrabold tabular-nums ${
                    isLight ? 'text-teal-700' : 'text-sky-400'
                  }`}
                >
                  {firstTrain.departureDisplay || firstTrain.depTime}
                </span>
              </div>

              {/* Single clean subtitle row with zero redundancy */}
              <div
                className={`flex items-center justify-between text-xs font-sans pt-1 border-t ${
                  isLight ? 'border-teal-200/60 text-slate-600' : 'border-white/10 text-slate-300'
                }`}
              >
                <span>Ride: <strong className={isLight ? 'text-slate-900 font-bold' : 'text-white'}>{firstTrain.rideMinutes} mins</strong></span>
                <span>Arrival: <strong className={`font-mono ${isLight ? 'text-slate-900 font-bold' : 'text-white'}`}>{firstTrain.arrTime || '--:--'}</strong></span>
                <span className={`text-[11px] truncate max-w-[120px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{firstTrain.status}</span>
              </div>
            </div>
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
                        Kochi Metro trains have concluded operations for today. Tomorrow's morning services resume at{' '}
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
                      LATER DEPARTURES
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
                    {subsequentTrains.map((train, idx) => {
                      const isNorth = train.direction === 1;
                      const dotColor = isNorth
                        ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                        : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]';

                      return (
                        <div
                          key={train.id || idx}
                          onClick={() => train.id && navigate(`/train/${train.id}`)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] ${
                            isLight
                              ? 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/90 hover:border-slate-300 text-slate-900 shadow-sm'
                              : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.07] hover:border-white/20 text-white'
                          }`}
                          title={`Track Train KMRL-${train.displayId} Live`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                              <span
                                className={`font-sans text-sm font-extrabold tracking-tight ${
                                  isLight ? 'text-slate-900' : 'text-white'
                                }`}
                              >
                                KMRL-{train.displayId}
                              </span>
                            </div>

                            <span
                              className={`font-mono text-sm font-bold tabular-nums ${
                                isLight ? 'text-teal-700' : 'text-sky-400'
                              }`}
                            >
                              {train.departureDisplay || train.depTime}
                            </span>
                          </div>

                          <div
                            className={`flex items-center justify-between mt-2 pt-2 border-t text-[11px] font-sans ${
                              isLight ? 'border-slate-200/70 text-slate-500' : 'border-white/5 text-slate-400'
                            }`}
                          >
                            <span>Ride: <strong className={isLight ? 'text-slate-800' : 'text-slate-200'}>{train.rideMinutes} mins</strong></span>
                            <span>Arrival: <strong className={`font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>{train.arrTime || '--:--'}</strong></span>
                            <span className={`truncate max-w-[120px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{train.status}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : destinationStation && !firstTrain ? (
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
                    {currentStation && normalizeStationId(currentStation.id) !== 'ALVA' && (
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
                            Towards Aluva
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
                            {liveStationArrivals.north.slice(0, 3).map((arr) => (
                              <div
                                key={arr.train.id}
                                onClick={() => arr.train?.id && navigate(`/train/${arr.train.id}`)}
                                className={`p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all active:scale-[0.99] ${
                                  isLight
                                    ? 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-100/70 text-slate-900 shadow-xs'
                                    : 'bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.06] text-white'
                                }`}
                                title={`Track Train KMRL-${arr.train.id.replace('KMRL-', '')} Live`}
                              >
                                <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                  KMRL-{arr.train.id.replace('KMRL-', '')}
                                </span>
                                <span
                                  className={`font-mono font-bold ${
                                    isLight ? 'text-emerald-600' : 'text-emerald-400'
                                  }`}
                                >
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
                    )}

                    {currentStation && normalizeStationId(currentStation.id) !== 'TPHT' && (
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
                            Towards Thripunithura
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
                            {liveStationArrivals.south.slice(0, 3).map((arr) => (
                              <div
                                key={arr.train.id}
                                onClick={() => arr.train?.id && navigate(`/train/${arr.train.id}`)}
                                className={`p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all active:scale-[0.99] ${
                                  isLight
                                    ? 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-100/70 text-slate-900 shadow-xs'
                                    : 'bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.06] text-white'
                                }`}
                                title={`Track Train KMRL-${arr.train.id.replace('KMRL-', '')} Live`}
                              >
                                <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                  KMRL-{arr.train.id.replace('KMRL-', '')}
                                </span>
                                <span
                                  className={`font-mono font-bold ${
                                    isLight ? 'text-amber-600' : 'text-amber-400'
                                  }`}
                                >
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
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </motion.div>

      {/* Interactive Station Picker Modal (No Search Input) */}
      <StationPickerModal
        isOpen={stationPickerMode !== null}
        onClose={() => setStationPickerMode(null)}
        mode={stationPickerMode || 'origin'}
        stations={stations}
        activeStation={currentStation}
        destinationStation={destinationStation}
        theme={currentTheme}
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
