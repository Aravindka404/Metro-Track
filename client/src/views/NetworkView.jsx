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

  // Time-based travel planning state (null = "Leave Now")
  const [selectedTime, setSelectedTime] = useState(null); // 'HH:MM' or null
  const [customTimeInput, setCustomTimeInput] = useState('17:30');
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [scheduledDepartures, setScheduledDepartures] = useState([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);

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

  // Fetch scheduled departures when custom time is selected or origin/destination changes
  useEffect(() => {
    if (!selectedTime || !currentStation) {
      setScheduledDepartures([]);
      return;
    }

    setIsLoadingSchedule(true);
    const originId = currentStation.id;
    const destId = destinationStation?.id || '';
    const url = `/api/plan?origin=${originId}&destination=${destId}&time=${selectedTime}`;

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

  // Combined Trip Intelligence (Readily Available First Train + Next 3 Upcoming Trains)
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
    if (selectedTime && scheduledDepartures.length > 0) {
      const firstAvailable = scheduledDepartures[0];
      const upcomingThree = scheduledDepartures.slice(1, 4);

      return {
        isCustomTime: true,
        selectedTimeStr: selectedTime,
        fare,
        hops,
        rideMinutes: firstAvailable.rideMinutes || rideMinutes,
        firstTrain: {
          id: firstAvailable.trainId,
          displayId: firstAvailable.trainId.replace('KMRL-', ''),
          depTime: firstAvailable.depTime,
          arrTime: firstAvailable.arrTime,
          waitMin: Math.max(0, Math.round(firstAvailable.etaSeconds / 60)),
          status: `Scheduled Departure at ${firstAvailable.depTime}`,
        },
        upcomingThree: upcomingThree.map((dep) => ({
          id: dep.trainId,
          displayId: dep.trainId.replace('KMRL-', ''),
          depTime: dep.depTime,
          arrTime: dep.arrTime,
          status: `Departs at ${dep.depTime}`,
        })),
      };
    }

    // Otherwise, calculate from real-time live trains
    const normDestId = normalizeStationId(destinationStation.id);
    const relevantLiveArrivals = (direction === 1 ? liveStationArrivals.north : liveStationArrivals.south).filter(
      (arr) => {
        if (!arr.train.remainingStops || arr.train.remainingStops.length === 0) return true;
        return arr.train.remainingStops.some(
          (s) => normalizeStationId(s.stopId) === normDestId
        );
      }
    );

    const firstAvailableLive = relevantLiveArrivals[0] || null;
    // Show the next 3 upcoming trains
    const upcomingThree = relevantLiveArrivals.slice(1, 4);

    let arrivalTimeStr = '--:--';
    if (firstAvailableLive) {
      const totalTripSeconds = firstAvailableLive.etaSeconds + rideMinutes * 60;
      const arrivalDate = new Date(Date.now() + totalTripSeconds * 1000);
      arrivalTimeStr = arrivalDate.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }

    return {
      isCustomTime: false,
      fare,
      hops,
      rideMinutes,
      recommendedTrainId: firstAvailableLive?.train?.id || null,
      firstTrain: firstAvailableLive
        ? {
            id: firstAvailableLive.train.id,
            displayId: firstAvailableLive.train.id.replace('KMRL-', ''),
            waitEtaSeconds: firstAvailableLive.etaSeconds,
            status: firstAvailableLive.currentLocation,
            arrivalTimeStr,
          }
        : null,
      upcomingThree: upcomingThree.map((arr) => ({
        id: arr.train.id,
        displayId: arr.train.id.replace('KMRL-', ''),
        etaSeconds: arr.etaSeconds,
        status: arr.currentLocation,
      })),
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

  return (
    <div className="w-full min-h-[100dvh] h-[100dvh] relative overflow-hidden bg-[#0B0F19] text-white font-sans select-none overscroll-y-contain">
      {/* 2D Schematic Circuit Map */}
      <MapBase
        viewState={viewState}
        onViewStateChange={setViewState}
        onSelectStation={handleSelectStation}
        padding={mapPadding}
        recommendedTrainId={tripPlan?.recommendedTrainId || null}
        routeHighlight={
          destinationStation && currentStation
            ? { originId: currentStation.id, destinationId: destinationStation.id }
            : null
        }
      />

      {/* Clean Minimal Header Bar */}
      <header className="absolute top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-6 z-20 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto px-4 py-2.5 rounded-xl border border-white/10 bg-[#0E1524]/90 backdrop-blur-md flex items-center gap-3 shadow-lg">
          <span className="font-mono text-xs font-bold tracking-widest text-white uppercase">
            KOCHI METRO
          </span>
          <div className="h-3 w-[1px] bg-white/15" />
          <span className="font-mono text-[11px] text-slate-300">
            {activeTrainsCount} trains active
          </span>
          <div className="h-3 w-[1px] bg-white/15 hidden sm:block" />
          <span className="font-mono text-[11px] text-slate-400 hidden sm:inline">
            {istTime || '--:--:--'} IST
          </span>
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
        className="absolute bottom-0 left-0 right-0 sm:bottom-6 sm:left-6 sm:right-auto sm:w-[480px] z-30 pointer-events-auto overscroll-y-contain"
      >
        <div className="p-5 sm:p-6 rounded-t-3xl sm:rounded-2xl border border-white/10 bg-[#0D1526]/95 backdrop-blur-xl flex flex-col gap-4 max-h-[82vh] sm:max-h-[78vh] overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
          {/* Mobile Swipe Grab Bar */}
          <div
            onClick={() => setIsDrawerExpanded(!isDrawerExpanded)}
            className="w-12 h-1.5 rounded-full bg-white/25 mx-auto cursor-grab active:cursor-grabbing sm:hidden mb-1"
          />

          {/* Drawer Header Toggle */}
          <div
            onClick={() => setIsDrawerExpanded(!isDrawerExpanded)}
            className="flex items-center justify-between cursor-pointer border-b border-white/10 pb-3 select-none"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-white uppercase tracking-wide">
                {destinationStation
                  ? `${currentStation?.name} ➔ ${destinationStation.name}`
                  : `${currentStation?.name || 'Kochi'} Station`}
              </span>
              {destinationStation && tripPlan && (
                <span className="font-mono text-xs text-[#00A896] font-bold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60">
                  ₹{tripPlan.fare}
                </span>
              )}
            </div>

            <button className="text-slate-400 hover:text-white p-1 transition-colors">
              {isDrawerExpanded ? <ChevronDown size={18} strokeWidth={2} /> : <ChevronUp size={18} strokeWidth={2} />}
            </button>
          </div>

          {/* Drawer Body Area */}
          <div className="overflow-y-auto flex flex-col gap-4 pr-1">
            {/* Premium Station Selector Card */}
            <div className="p-4 rounded-2xl border border-white/10 bg-[#0B0F19]/80 flex flex-col gap-3 relative shadow-inner">
              {/* Boarding Station Field */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0E1626] border border-white/10 focus-within:border-emerald-500/60 transition-colors">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-500/20 shrink-0" />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-mono text-[9px] text-slate-400 uppercase tracking-widest font-semibold">
                    BOARDING FROM
                  </span>
                  <select
                    value={currentStation?.id || ''}
                    onChange={(e) => {
                      const selected = stations.find((s) => s.id === e.target.value);
                      if (selected) handleSelectStation(selected);
                    }}
                    className="w-full bg-transparent text-white font-mono text-xs sm:text-sm font-semibold focus:outline-none cursor-pointer truncate pr-6 pt-0.5"
                  >
                    {stations.map((st) => (
                      <option key={st.id} value={st.id} className="bg-[#0E1626] text-white">
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Floating Swap Button */}
              <div className="absolute right-6 top-[54px] z-10">
                <button
                  onClick={handleSwapStations}
                  disabled={!destinationStation}
                  title="Swap Stations"
                  className="p-2 rounded-full bg-[#162238] border border-white/20 text-slate-300 hover:text-white hover:border-white/40 disabled:opacity-20 disabled:cursor-not-allowed shadow-xl active:scale-90 transition-all"
                >
                  <ArrowUpDown size={14} strokeWidth={2.5} />
                </button>
              </div>

              {/* Destination Station Field */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0E1626] border border-white/10 focus-within:border-cyan-500/60 transition-colors">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 ring-4 ring-cyan-500/20 shrink-0" />
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] text-slate-400 uppercase tracking-widest font-semibold">
                      DESTINATION
                    </span>
                    {destinationStation && (
                      <button
                        onClick={handleClearDestination}
                        className="text-[10px] text-slate-400 hover:text-white font-mono transition-colors mr-2"
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
                    className="w-full bg-transparent text-white font-mono text-xs sm:text-sm font-semibold focus:outline-none cursor-pointer truncate pr-6 pt-0.5"
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

              {/* Departure Time Control Bar */}
              <div className="flex items-center justify-between pt-1 border-t border-white/5 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <Clock size={13} strokeWidth={2} className="text-slate-400" />
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">DEPARTURE:</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleResetToNow}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
                      !selectedTime
                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    LEAVE NOW
                  </button>

                  <div className="relative">
                    {!isTimePickerOpen && selectedTime ? (
                      <button
                        onClick={() => setIsTimePickerOpen(true)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-cyan-500/20 border border-cyan-500/60 text-cyan-300 flex items-center gap-1.5"
                      >
                        <span>AT {selectedTime}</span>
                        <X
                          size={12}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResetToNow();
                          }}
                          className="hover:text-white"
                        />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          type="time"
                          value={customTimeInput}
                          onChange={(e) => setCustomTimeInput(e.target.value)}
                          className="bg-[#0E1626] text-white border border-white/15 rounded-lg px-2 py-0.5 text-[10px] font-mono focus:outline-none focus:border-cyan-500"
                        />
                        <button
                          onClick={handleApplyCustomTime}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15"
                        >
                          SET
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* STATE A: Destination Selected (First Available Train + Upcoming 3 Trains)  */}
            {/* ========================================================================= */}
            {destinationStation && tripPlan && (
              <div className="p-4 sm:p-5 rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-[#0E223D]/70 to-[#0A1629]/70 flex flex-col gap-4 shadow-[0_8px_30px_rgba(6,182,212,0.12)]">
                {/* 1st Readily Available Train Hero */}
                {tripPlan.firstTrain ? (
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                        <span className="font-mono text-sm font-bold text-white uppercase tracking-wide">
                          TRAIN {tripPlan.firstTrain.displayId}
                        </span>
                        <span className="font-mono text-[9px] text-cyan-300 uppercase px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-700/60 font-semibold">
                          {tripPlan.isCustomTime ? 'EARLIEST TRAIN' : 'READILY AVAILABLE'}
                        </span>
                      </div>

                      <span className="font-mono text-xs font-bold text-cyan-300">
                        {tripPlan.isCustomTime
                          ? `Departs ${tripPlan.firstTrain.depTime}`
                          : tripPlan.firstTrain.waitEtaSeconds <= 0
                          ? 'Arriving now'
                          : `in ${Math.floor(tripPlan.firstTrain.waitEtaSeconds / 60)}m ${tripPlan.firstTrain.waitEtaSeconds % 60}s`}
                      </span>
                    </div>

                    <div className="text-xs font-mono text-slate-300 pl-4 border-l-2 border-cyan-500/40">
                      Status: <span className="text-white font-medium">{tripPlan.firstTrain.status}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center font-mono text-xs text-slate-400 py-2">
                    {isLoadingSchedule ? 'Searching schedules...' : 'No trains found for this time'}
                  </div>
                )}

                {/* Single Non-Redundant Journey Summary Bar */}
                <div className="p-3 rounded-xl bg-[#0B0F19]/80 border border-white/10 flex items-center justify-between font-mono text-xs shadow-sm">
                  <span className="text-slate-200 font-medium">
                    {tripPlan.rideMinutes} mins • {tripPlan.hops} stops
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-[#00A896] font-bold">
                    Fare ₹{tripPlan.fare}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-200 font-medium">
                    {tripPlan.isCustomTime
                      ? `Arrives ${tripPlan.firstTrain?.arrTime || '--:--'}`
                      : `Reaching ${tripPlan.firstTrain?.arrivalTimeStr || '--:--'}`}
                  </span>
                </div>

                {/* Upcoming 3 Trains Section */}
                {tripPlan.upcomingThree.length > 0 && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between pb-1">
                      <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                        UPCOMING 3 TRAINS
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {tripPlan.isCustomTime ? 'FOLLOWING SCHEDULE' : 'NEXT DEPARTURES'}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {tripPlan.upcomingThree.map((dep, idx) => (
                        <div
                          key={dep.id + idx}
                          className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] flex items-center justify-between font-mono text-xs text-slate-300 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">
                              Train {dep.displayId}
                            </span>
                            <span className="text-slate-600">•</span>
                            <span className="text-slate-400 text-[11px] truncate max-w-[180px]">
                              {dep.status}
                            </span>
                          </div>

                          <span className="text-slate-300 font-medium">
                            {tripPlan.isCustomTime
                              ? dep.depTime
                              : `in ${Math.floor(dep.etaSeconds / 60)}m`}
                          </span>
                        </div>
                      ))}
                    </div>
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
                  <div className="p-4 rounded-2xl border border-white/10 bg-[#0B0F19]/70 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span className="font-mono text-xs font-bold text-white uppercase tracking-wide">
                        Towards Aluva
                      </span>
                      <span className="font-mono text-[10px] text-slate-500 font-semibold">
                        Platform 1
                      </span>
                    </div>

                    {liveStationArrivals.north.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {liveStationArrivals.north.slice(0, 3).map((arr, idx) => (
                          <div
                            key={arr.train.id}
                            className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] flex items-center justify-between font-mono text-xs text-slate-300 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">
                                Train {arr.train.id.replace('KMRL-', '')}
                              </span>
                              <span className="text-slate-600">•</span>
                              <span className="text-slate-400 text-[11px] truncate max-w-[170px]">
                                {arr.currentLocation}
                              </span>
                            </div>

                            <span className={idx === 0 ? 'text-[#00A896] font-bold' : 'text-slate-400'}>
                              {arr.etaSeconds <= 0
                                ? 'Arriving now'
                                : `in ${Math.floor(arr.etaSeconds / 60)}m ${arr.etaSeconds % 60}s`}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="font-mono text-xs text-slate-500 py-2 text-center">
                        No trains currently approaching
                      </div>
                    )}
                  </div>
                )}

                {/* Towards Thripunithura */}
                {!isTerminalSouth && (
                  <div className="p-4 rounded-2xl border border-white/10 bg-[#0B0F19]/70 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span className="font-mono text-xs font-bold text-white uppercase tracking-wide">
                        Towards Thripunithura
                      </span>
                      <span className="font-mono text-[10px] text-slate-500 font-semibold">
                        Platform 2
                      </span>
                    </div>

                    {liveStationArrivals.south.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {liveStationArrivals.south.slice(0, 3).map((arr, idx) => (
                          <div
                            key={arr.train.id}
                            className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] flex items-center justify-between font-mono text-xs text-slate-300 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">
                                Train {arr.train.id.replace('KMRL-', '')}
                              </span>
                              <span className="text-slate-600">•</span>
                              <span className="text-slate-400 text-[11px] truncate max-w-[170px]">
                                {arr.currentLocation}
                              </span>
                            </div>

                            <span className={idx === 0 ? 'text-[#00A896] font-bold' : 'text-slate-400'}>
                              {arr.etaSeconds <= 0
                                ? 'Arriving now'
                                : `in ${Math.floor(arr.etaSeconds / 60)}m ${arr.etaSeconds % 60}s`}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="font-mono text-xs text-slate-500 py-2 text-center">
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
