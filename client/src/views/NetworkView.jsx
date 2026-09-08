import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, ArrowUpDown, Clock, X, Sparkles } from 'lucide-react';
import { MapBase } from '../components/MapBase.jsx';
import { useStationContext } from '../context/useStationContext.jsx';
import {
  calculateKochiMetroFare,
  estimateRideDurationMinutes,
  getTripDirection,
  getStationHopCount,
  normalizeStationId,
} from '../utils/fareCalculator.js';
import { THEMES } from '../utils/themeConfig.js';

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

export function NetworkView() {
  const {
    trains,
    activeTrainsCount,
    istTime,
    stations,
    activeStation,
    setActiveStation,
    nearestStation,
    setNearestStation,
    userLocation,
    setUserLocation,
  } = useStationContext();

  const currentStation = activeStation || nearestStation;

  // Boarding & Destination state
  const [destinationStation, setDestinationStation] = useState(null);
  const [isDrawerExpanded, setIsDrawerExpanded] = useState(true);

  // Accordion drawer: index of the currently expanded train (default: 0 = readily available)
  const [selectedTrainIdx, setSelectedTrainIdx] = useState(0);

  // Time-based travel planning state (null = silent live default)
  const [selectedTime, setSelectedTime] = useState(null); // 'HH:MM' or null
  const [customTimeInput, setCustomTimeInput] = useState('17:30');
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [scheduledDepartures, setScheduledDepartures] = useState([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);

  // Reset selected train index whenever origin, destination, or time changes
  useEffect(() => {
    setSelectedTrainIdx(0);
  }, [currentStation?.id, destinationStation?.id, selectedTime]);

  // Active visual style: Nordic Frost with Swiss Signal Red Route Highlight
  const currentTheme = THEMES.nordic;

  // Responsive mobile state
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const mapPadding = useMemo(() => {
    if (isMobile) {
      return {
        bottom: Math.round(window.innerHeight * 0.45),
        top: 20,
        left: 20,
        right: 20,
      };
    }
    return {
      bottom: 40,
      top: 40,
      left: 500,
      right: 40,
    };
  }, [isMobile]);

  const [viewState, setViewState] = useState({
    longitude: 76.315,
    latitude: 10.025,
    zoom: 12.5,
  });

  // Fallback to Tripunithura if location is denied
  const getTripunithuraStation = useCallback((stList) => {
    if (!stList || stList.length === 0) return null;
    return (
      stList.find(
        (s) =>
          normalizeStationId(s.id) === 'TPHT' ||
          s.name.toLowerCase().includes('tripunithura')
      ) || stList[stList.length - 1]
    );
  }, []);

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
            if (!activeStation) setActiveStation(nearest);
          }
        },
        () => {
          if (stations.length > 0) {
            const fallback = getTripunithuraStation(stations);
            if (fallback) {
              setNearestStation(fallback);
              if (!activeStation) setActiveStation(fallback);
            }
          }
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    } else if (stations.length > 0) {
      const fallback = getTripunithuraStation(stations);
      if (fallback) {
        setNearestStation(fallback);
        if (!activeStation) setActiveStation(fallback);
      }
    }
  }, [stations, setUserLocation, setNearestStation, setActiveStation, activeStation, getTripunithuraStation]);

  useEffect(() => {
    if (userLocation && stations.length > 0 && !nearestStation) {
      const nearest = getNearestStation(userLocation.lat, userLocation.lon, stations);
      setNearestStation(nearest);
      if (!activeStation) setActiveStation(nearest);
    } else if (stations.length > 0 && !activeStation) {
      const fallback = getTripunithuraStation(stations);
      if (fallback) setActiveStation(fallback);
    }
  }, [userLocation, stations, nearestStation, activeStation, setNearestStation, setActiveStation, getTripunithuraStation]);

  // Reset destination if user sets boarding station equal to destination
  useEffect(() => {
    if (currentStation && destinationStation) {
      if (normalizeStationId(currentStation.id) === normalizeStationId(destinationStation.id)) {
        setDestinationStation(null);
      }
    }
  }, [currentStation, destinationStation]);

  // Fetch scheduled departures when destination and origin are selected (or time changes)
  useEffect(() => {
    if (!currentStation || !destinationStation) {
      setScheduledDepartures([]);
      return;
    }

    setIsLoadingSchedule(true);
    const originId = currentStation.id;
    const destId = destinationStation.id;
    const url = `/api/plan?origin=${originId}&destination=${destId}&time=${selectedTime || ''}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setScheduledDepartures(data.departures || []);
        setIsLoadingSchedule(false);
      })
      .catch((err) => {
        console.warn('[Schedule] error querying plan:', err);
        setIsLoadingSchedule(false);
      });
  }, [selectedTime, currentStation?.id, destinationStation?.id]);

  // Full-corridor live arrivals for currentStation
  const liveStationArrivals = useMemo(() => {
    if (!currentStation || !trains || trains.length === 0) {
      return { north: [], south: [] };
    }

    const normTargetId = normalizeStationId(currentStation.id);
    const targetName = currentStation.name.toLowerCase();

    const arrivals = [];

    for (const train of trains) {
      let etaSec = null;

      if (
        normalizeStationId(train.nextStationId) === normTargetId ||
        train.nextStation.toLowerCase() === targetName
      ) {
        etaSec = train.etaSeconds;
      } else if (train.remainingStops && train.remainingStops.length > 0) {
        const matchedStop = train.remainingStops.find(
          (s) =>
            normalizeStationId(s.stopId) === normTargetId ||
            s.stopName.toLowerCase() === targetName
        );
        if (matchedStop) {
          etaSec = matchedStop.etaSeconds;
        }
      }

      if (etaSec !== null) {
        arrivals.push({
          train,
          etaSeconds: etaSec,
          directionId: train.directionId, // 1 = Towards Aluva, 0 = Towards Thripunithura
          currentLocation: train.isDwelling
            ? `At ${train.nextStation}`
            : `Approaching ${train.nextStation}`,
        });
      }
    }

    const north = arrivals
      .filter((a) => a.directionId === 1)
      .sort((a, b) => a.etaSeconds - b.etaSeconds);

    const south = arrivals
      .filter((a) => a.directionId === 0)
      .sort((a, b) => a.etaSeconds - b.etaSeconds);

    return { north, south };
  }, [currentStation, trains]);

  // Combined Trip Intelligence (Unified 4-Train Accordion: Readily Available + Next 3 Upcoming)
  const tripPlan = useMemo(() => {
    if (
      !currentStation ||
      !destinationStation ||
      normalizeStationId(currentStation.id) === normalizeStationId(destinationStation.id)
    ) {
      return null;
    }

    const direction = getTripDirection(currentStation.id, destinationStation.id);
    if (direction === null) return null;

    const fare = calculateKochiMetroFare(currentStation.id, destinationStation.id);
    const hops = getStationHopCount(currentStation.id, destinationStation.id);
    const rideMinutes = estimateRideDurationMinutes(currentStation.id, destinationStation.id);

    // If user selected a custom departure time (e.g. 5:30 PM):
    if (selectedTime) {
      const scheduledList = (scheduledDepartures || []).slice(0, 4).map((dep) => ({
        id: dep.trainId,
        displayId: dep.trainId.replace('KMRL-', ''),
        isLive: false,
        depTime: dep.depTime,
        arrTime: dep.arrTime,
        departureDisplay: `Departs ${dep.depTime}`,
        status: `Scheduled departure at ${dep.depTime}`,
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

    // Default: Live Mode (Readily Available First Train + Next 3 Upcoming Metros)
    const normDestId = normalizeStationId(destinationStation.id);
    const relevantLiveArrivals = (direction === 1 ? liveStationArrivals.north : liveStationArrivals.south).filter(
      (arr) => {
        if (!arr.train.remainingStops || arr.train.remainingStops.length === 0) return true;
        return arr.train.remainingStops.some(
          (s) => normalizeStationId(s.stopId) === normDestId
        );
      }
    );

    const journeyTrains = [];

    // 1. Add active live trains
    for (const arr of relevantLiveArrivals.slice(0, 4)) {
      const waitSec = arr.etaSeconds;
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

      const arrDate = new Date(Date.now() + (Math.max(0, waitSec) + rideMinutes * 60) * 1000);
      const arrTime = arrDate.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      journeyTrains.push({
        id: arr.train.id,
        displayId: arr.train.id.replace('KMRL-', ''),
        isLive: true,
        depTime,
        arrTime,
        departureDisplay: depDisplay,
        status: arr.currentLocation,
        waitEtaSeconds: waitSec,
        rideMinutes,
      });
    }

    // 2. Backfill with scheduled departures if fewer than 4 live trains to guarantee 4 options
    if (journeyTrains.length < 4 && scheduledDepartures && scheduledDepartures.length > 0) {
      for (const dep of scheduledDepartures) {
        if (journeyTrains.length >= 4) break;
        if (!journeyTrains.some((t) => t.id === dep.trainId)) {
          journeyTrains.push({
            id: dep.trainId,
            displayId: dep.trainId.replace('KMRL-', ''),
            isLive: false,
            depTime: dep.depTime,
            arrTime: dep.arrTime,
            departureDisplay: dep.depTime,
            status: `Scheduled departure at ${dep.depTime}`,
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
  }, [currentStation, destinationStation, selectedTime, scheduledDepartures, liveStationArrivals]);

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

  const isTerminalNorth = currentStation && normalizeStationId(currentStation.id) === 'ALVA';
  const isTerminalSouth = currentStation && normalizeStationId(currentStation.id) === 'TPHT';

  const activeTrain = tripPlan?.journeyTrains?.[selectedTrainIdx] || tripPlan?.journeyTrains?.[0];

  return (
    <div
      className="w-full min-h-[100dvh] h-[100dvh] relative overflow-hidden text-white font-sans select-none overscroll-y-contain transition-colors duration-300"
      style={{ backgroundColor: currentTheme.bgApp }}
    >
      {/* 2D Schematic Circuit Map */}
      <MapBase
        viewState={viewState}
        onViewStateChange={setViewState}
        onSelectStation={handleSelectStation}
        padding={mapPadding}
        recommendedTrainId={activeTrain?.id || null}
        routeHighlight={
          destinationStation && currentStation
            ? { originId: currentStation.id, destinationId: destinationStation.id }
            : null
        }
        theme={currentTheme}
      />

      {/* Clean Minimal Header Bar */}
      <header className="absolute top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-6 z-20 flex items-center justify-between pointer-events-none gap-2">
        <div className="pointer-events-auto px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl border border-white/10 bg-[#0E1524]/90 backdrop-blur-md flex items-center gap-2.5 sm:gap-3 shadow-lg">
          <span className="font-sans text-xs font-extrabold tracking-wider text-white uppercase">
            KOCHI METRO
          </span>
          <div className="h-3 w-[1px] bg-white/15" />
          <span className="font-sans text-xs text-slate-300 font-medium">
            <strong className="font-mono font-bold text-white">{activeTrainsCount}</strong> trains active
          </span>
          <div className="h-3 w-[1px] bg-white/15 hidden sm:block" />
          <span className="font-mono text-xs text-slate-400 hidden sm:inline tabular-nums">
            {istTime || '--:--:--'} <span className="font-sans text-[10px] font-semibold tracking-wider text-slate-500">IST</span>
          </span>
        </div>

        {/* Live Network Telemetry Badge */}
        <div className="pointer-events-auto px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-white/10 bg-[#0E1626]/85 backdrop-blur-md flex items-center gap-2 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span className="font-sans text-xs font-extrabold text-white tracking-wider">LIVE</span>
        </div>
      </header>

      {/* Floating Commuter Drawer / Mobile Bottom Sheet */}
      <motion.div
        drag={isMobile ? 'y' : false}
        dragConstraints={{ top: 0, bottom: 200 }}
        dragElastic={0.15}
        onDragEnd={(e, info) => {
          if (info.offset.y > 60) {
            setIsDrawerExpanded(false);
          } else if (info.offset.y < -60) {
            setIsDrawerExpanded(true);
          }
        }}
        animate={{ y: isDrawerExpanded ? 0 : 'calc(100% - 64px)' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute bottom-0 left-0 right-0 sm:bottom-6 sm:left-6 sm:right-auto sm:w-[460px] z-30 pointer-events-auto overscroll-y-contain"
      >
        <div
          className={`p-4 sm:p-5 rounded-t-3xl sm:rounded-2xl border ${currentTheme.drawerBorder} ${currentTheme.drawerBg} backdrop-blur-xl flex flex-col gap-3.5 max-h-[85vh] sm:max-h-[82vh] overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.6)] transition-colors duration-300`}
        >
          {/* Mobile Swipe Grab Bar */}
          <div
            onClick={() => setIsDrawerExpanded(!isDrawerExpanded)}
            className="w-12 h-1.5 rounded-full bg-white/25 mx-auto cursor-grab active:cursor-grabbing sm:hidden mb-0.5"
          />

          {/* Drawer Header Toggle (Price removed from header to eliminate redundancy) */}
          <div
            onClick={() => setIsDrawerExpanded(!isDrawerExpanded)}
            className="flex items-center justify-between cursor-pointer border-b border-white/10 pb-2.5 select-none"
          >
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <span className="font-sans text-sm sm:text-base font-bold text-white tracking-tight truncate">
                {destinationStation
                  ? `${currentStation?.name} ➔ ${destinationStation.name}`
                  : `${currentStation?.name || 'Kochi'} Station`}
              </span>
            </div>

            <button className="text-slate-400 hover:text-white p-1 transition-colors shrink-0">
              {isDrawerExpanded ? <ChevronDown size={18} strokeWidth={2} /> : <ChevronUp size={18} strokeWidth={2} />}
            </button>
          </div>

          {/* Drawer Body Area */}
          <div className="overflow-y-auto flex flex-col gap-3.5 pr-1 pb-1">
            {/* Premium Station Selector Card */}
            <div
              className={`p-3.5 sm:p-4 rounded-2xl border ${currentTheme.cardBorder} ${currentTheme.cardBg} flex flex-col gap-2.5 shadow-inner transition-colors duration-300`}
            >
              {/* Route Input Group + Dedicated Invert Button */}
              <div className="flex items-center gap-2 sm:gap-2.5">
                {/* Inputs Column */}
                <div className="flex-1 flex flex-col gap-2 min-w-0">
                  {/* Boarding Station Field */}
                  <div
                    className={`flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl ${currentTheme.inputBg} border ${currentTheme.inputBorder} ${currentTheme.inputFocus} transition-colors`}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: currentTheme.accentPrimary,
                        boxShadow: `0 0 0 4px ${currentTheme.accentPrimary}33`,
                      }}
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-sans text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                        BOARDING FROM
                      </span>
                      <select
                        value={currentStation?.id || ''}
                        onChange={(e) => {
                          const selected = stations.find((s) => s.id === e.target.value);
                          if (selected) handleSelectStation(selected);
                        }}
                        className="w-full bg-transparent text-white font-sans text-sm sm:text-base font-bold focus:outline-none cursor-pointer truncate pt-0.5 tracking-tight"
                      >
                        {stations.map((st) => (
                          <option key={st.id} value={st.id} className="bg-[#0E1626] text-white">
                            {st.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Destination Station Field */}
                  <div
                    className={`flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl ${currentTheme.inputBg} border ${currentTheme.inputBorder} ${currentTheme.inputFocus} transition-colors`}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: '#E11D48',
                        boxShadow: '0 0 0 4px rgba(225,29,72,0.25)',
                      }}
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-sans text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                          DESTINATION
                        </span>
                        {destinationStation && (
                          <button
                            onClick={handleClearDestination}
                            className="text-[11px] text-rose-400 hover:text-rose-300 font-sans font-bold transition-colors mr-0.5"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <select
                        value={destinationStation?.id || ''}
                        onChange={(e) => {
                          if (!e.target.value) {
                            setDestinationStation(null);
                          } else {
                            const selected = stations.find((s) => s.id === e.target.value);
                            if (selected) setDestinationStation(selected);
                          }
                        }}
                        className="w-full bg-transparent text-white font-sans text-sm sm:text-base font-bold focus:outline-none cursor-pointer truncate pt-0.5 tracking-tight"
                      >
                        <option value="" className="bg-[#0E1626] text-slate-400">
                          Select destination...
                        </option>
                        {stations
                          .filter((st) => normalizeStationId(st.id) !== normalizeStationId(currentStation?.id))
                          .map((st) => (
                            <option key={st.id} value={st.id} className="bg-[#0E1626] text-white">
                              {st.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Dedicated Invert/Swap Stations Button (Centered, Zero Overlap) */}
                <div className="shrink-0 flex items-center justify-center">
                  <button
                    onClick={handleSwapStations}
                    disabled={!destinationStation}
                    title="Swap Boarding & Destination"
                    aria-label="Swap Stations"
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl border flex items-center justify-center shadow-lg transition-all ${currentTheme.swapBtn} disabled:opacity-20 disabled:cursor-not-allowed hover:scale-105 active:scale-95`}
                  >
                    <ArrowUpDown size={16} strokeWidth={2.2} />
                  </button>
                </div>
              </div>

              {/* Departure Time Control (Subtle UX - Leave Now is silent default) */}
              <div className="pt-2 border-t border-white/5 font-sans text-xs">
                {!selectedTime ? (
                  !isTimePickerOpen ? (
                    <button
                      type="button"
                      onClick={() => setIsTimePickerOpen(true)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors py-0.5 px-1 rounded active:scale-95"
                    >
                      <Clock size={13} strokeWidth={2} className="text-slate-400" />
                      <span>Depart later?</span>
                    </button>
                  ) : (
                    <div className="flex items-center justify-between gap-2 bg-[#0E1626] p-2 rounded-xl border border-white/10">
                      <div className="flex items-center gap-2">
                        <Clock size={12} strokeWidth={2} className="text-cyan-400 shrink-0" />
                        <span className="text-[10px] font-sans text-slate-400 uppercase tracking-wider font-bold">Depart at:</span>
                        <input
                          type="time"
                          value={customTimeInput}
                          onChange={(e) => setCustomTimeInput(e.target.value)}
                          className="bg-black/40 text-white border border-white/15 rounded-lg px-2 py-0.5 text-xs font-mono font-bold focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleApplyCustomTime}
                          className={`px-2.5 py-1 rounded-lg text-xs font-sans font-bold transition-colors ${currentTheme.timeButton}`}
                        >
                          Check
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsTimePickerOpen(false)}
                          className="p-1 text-slate-400 hover:text-white transition-colors"
                          title="Cancel"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <div
                    className="flex items-center justify-between border px-3 py-1.5 rounded-xl"
                    style={{
                      backgroundColor: `${currentTheme.accentPrimary}15`,
                      borderColor: `${currentTheme.accentPrimary}40`,
                    }}
                  >
                    <div
                      className="flex items-center gap-2 text-xs font-sans font-semibold"
                      style={{ color: currentTheme.accentPrimary }}
                    >
                      <Clock size={12} />
                      <span>Departing after <strong className="font-mono font-bold">{formatTime12h(selectedTime)}</strong></span>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetToNow}
                      className="flex items-center gap-1 text-[11px] font-sans font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded border border-white/10 transition-colors"
                      title="Reset to current time"
                    >
                      <span>Live</span>
                      <X size={11} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ========================================================================= */}
            {/* STATE A: Destination Selected (First Train + Next 3 Upcoming Metros)      */}
            {/* Accordion / Drawer style: Selected train expands, others collapse         */}
            {/* ========================================================================= */}
            {destinationStation && tripPlan && (
              <div className="flex flex-col gap-2.5">
                {tripPlan.journeyTrains && tripPlan.journeyTrains.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between px-1">
                      <span className="font-sans text-[11px] text-slate-300 uppercase tracking-wider font-extrabold">
                        {tripPlan.isCustomTime ? 'SCHEDULED DEPARTURES' : 'AVAILABLE TRAINS'}
                      </span>
                      <span className="font-sans text-[11px] text-slate-400 font-medium">
                        Select train to track
                      </span>
                    </div>

                    <div className="flex flex-col gap-2">
                      {tripPlan.journeyTrains.map((train, idx) => {
                        const isSelected = selectedTrainIdx === idx;

                        if (isSelected) {
                          // Expanded Drawer Card
                          return (
                            <motion.div
                              key={train.id || idx}
                              layout
                              initial={{ opacity: 0.85, scale: 0.98 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.18 }}
                              className={`p-4 rounded-2xl border ${currentTheme.expandedTrainBorder} ${currentTheme.expandedTrainBg} flex flex-col gap-3 ${currentTheme.expandedTrainShadow} transition-colors duration-300`}
                            >
                              {/* Header Row */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-2.5 h-2.5 rounded-full ring-4 animate-pulse"
                                    style={{
                                      backgroundColor: currentTheme.accentPrimary,
                                      boxShadow: `0 0 0 4px ${currentTheme.accentPrimary}33`,
                                    }}
                                  />
                                  <span className="font-sans text-sm sm:text-base font-extrabold text-white tracking-tight">
                                    TRAIN {train.displayId}
                                  </span>
                                  <span
                                    className={`font-sans text-[10px] uppercase px-2 py-0.5 rounded ${currentTheme.activeBadgeBg} border ${currentTheme.activeBadgeBorder} ${currentTheme.activeBadgeText} font-bold tracking-wider`}
                                  >
                                    {idx === 0
                                      ? tripPlan.isCustomTime
                                        ? 'EARLIEST TRAIN'
                                        : 'READILY AVAILABLE'
                                      : 'SELECTED TRAIN'}
                                  </span>
                                </div>

                                <span
                                  className="font-mono text-xs sm:text-sm font-bold tabular-nums"
                                  style={{ color: currentTheme.accentPrimary }}
                                >
                                  {train.departureDisplay}
                                </span>
                              </div>

                              {/* Live/Scheduled Status */}
                              <div
                                className={`text-xs font-sans text-slate-300 pl-3 border-l-2 ${currentTheme.statusBorder}`}
                              >
                                Status: <span className="text-white font-semibold">{train.status}</span>
                              </div>

                              {/* Single Non-Redundant Journey Summary Bar */}
                              <div className="p-2.5 sm:p-3 rounded-xl bg-[#0B0F19]/90 border border-white/10 flex items-center justify-between font-sans text-[11px] sm:text-xs shadow-sm">
                                <span className="text-slate-200 font-semibold">
                                  {train.rideMinutes || tripPlan.rideMinutes} mins • {tripPlan.hops} stops
                                </span>
                                <span className="text-slate-600">•</span>
                                <span
                                  className="font-mono font-bold"
                                  style={{
                                    color:
                                      currentTheme.accentSecondary === '#FFFFFF'
                                        ? currentTheme.accentTertiary
                                        : currentTheme.accentSecondary,
                                  }}
                                >
                                  Fare ₹{tripPlan.fare}
                                </span>
                                <span className="text-slate-600">•</span>
                                <span className="text-slate-200 font-semibold">
                                  Reaching <strong className="font-mono font-bold text-white">{train.arrTime || '--:--'}</strong>
                                </span>
                              </div>
                            </motion.div>
                          );
                        }

                        // Collapsed Accordion Row
                        return (
                          <motion.div
                            key={train.id || idx}
                            layout
                            onClick={() => setSelectedTrainIdx(idx)}
                            className={`p-3 rounded-xl border border-white/5 bg-white/[0.02] ${currentTheme.hoverRow} flex items-center justify-between font-sans text-xs text-slate-300 cursor-pointer transition-all group`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className="w-1.5 h-1.5 rounded-full transition-colors shrink-0"
                                style={{ backgroundColor: currentTheme.accentPrimary }}
                              />
                              <span className="font-bold text-white shrink-0 tracking-tight">
                                Train {train.displayId}
                              </span>
                              <span className="text-slate-600">•</span>
                              <span className="text-slate-400 text-[11px] font-medium truncate">
                                {train.status}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <span className="text-slate-200 font-mono font-bold text-[11px] tabular-nums">
                                {train.departureDisplay}
                              </span>
                              <ChevronDown size={14} className="text-slate-500 group-hover:text-white transition-colors" />
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="p-6 rounded-2xl border border-white/10 bg-[#0B0F19]/80 text-center font-sans text-xs font-medium text-slate-400">
                    {isLoadingSchedule ? 'Checking metro schedules...' : 'No upcoming trains found for this route.'}
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* STATE B: Only Boarding Station Selected (General Station Departures)       */}
            {/* ========================================================================= */}
            {!destinationStation && (
              <div className="flex flex-col gap-3">
                {/* Towards Aluva */}
                {!isTerminalNorth && (
                  <div
                    className={`p-4 rounded-2xl border ${currentTheme.cardBorder} ${currentTheme.cardBg} flex flex-col gap-2.5 transition-colors duration-300`}
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span className="font-sans text-sm font-bold text-white tracking-tight">
                        Towards Aluva
                      </span>
                      <span className="font-sans text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Platform 1
                      </span>
                    </div>

                    {liveStationArrivals.north.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {liveStationArrivals.north.slice(0, 3).map((arr, idx) => (
                          <div
                            key={arr.train.id}
                            className={`p-2.5 rounded-xl border border-white/5 bg-white/[0.02] ${currentTheme.hoverRow} flex items-center justify-between font-sans text-xs text-slate-300 transition-colors`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white tracking-tight">
                                Train {arr.train.id.replace('KMRL-', '')}
                              </span>
                              <span className="text-slate-600">•</span>
                              <span className="text-slate-400 text-[11px] font-medium truncate max-w-[170px]">
                                {arr.currentLocation}
                              </span>
                            </div>

                            <span
                              className="font-mono font-bold text-xs tabular-nums"
                              style={{ color: idx === 0 ? currentTheme.accentPrimary : '#94A3B8' }}
                            >
                              {arr.etaSeconds <= 0
                                ? 'Arriving now'
                                : `in ${Math.floor(arr.etaSeconds / 60)}m ${arr.etaSeconds % 60}s`}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="font-sans text-xs font-medium text-slate-500 py-2 text-center">
                        No trains currently approaching
                      </div>
                    )}
                  </div>
                )}

                {/* Towards Thripunithura */}
                {!isTerminalSouth && (
                  <div
                    className={`p-4 rounded-2xl border ${currentTheme.cardBorder} ${currentTheme.cardBg} flex flex-col gap-2.5 transition-colors duration-300`}
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span className="font-sans text-sm font-bold text-white tracking-tight">
                        Towards Thripunithura
                      </span>
                      <span className="font-sans text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Platform 2
                      </span>
                    </div>

                    {liveStationArrivals.south.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {liveStationArrivals.south.slice(0, 3).map((arr, idx) => (
                          <div
                            key={arr.train.id}
                            className={`p-2.5 rounded-xl border border-white/5 bg-white/[0.02] ${currentTheme.hoverRow} flex items-center justify-between font-sans text-xs text-slate-300 transition-colors`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white tracking-tight">
                                Train {arr.train.id.replace('KMRL-', '')}
                              </span>
                              <span className="text-slate-600">•</span>
                              <span className="text-slate-400 text-[11px] font-medium truncate max-w-[170px]">
                                {arr.currentLocation}
                              </span>
                            </div>

                            <span
                              className="font-mono font-bold text-xs tabular-nums"
                              style={{ color: idx === 0 ? currentTheme.accentPrimary : '#94A3B8' }}
                            >
                              {arr.etaSeconds <= 0
                                ? 'Arriving now'
                                : `in ${Math.floor(arr.etaSeconds / 60)}m ${arr.etaSeconds % 60}s`}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="font-sans text-xs font-medium text-slate-500 py-2 text-center">
                        No trains currently approaching
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
