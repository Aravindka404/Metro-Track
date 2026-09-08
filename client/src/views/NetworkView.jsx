import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  Clock,
  Train,
  ArrowRight,
  ChevronUp,
  ChevronDown,
  Search,
  X,
  Compass,
  CreditCard,
  Sparkles,
  ArrowUpRight,
  Navigation,
  Check,
} from 'lucide-react';
import { MapBase } from '../components/MapBase.jsx';
import { useStationContext } from '../context/useStationContext.jsx';
import {
  calculateKochiMetroFare,
  estimateRideDurationMinutes,
  getTripDirection,
  getStationHopCount,
  normalizeStationId,
  KMRL_STATION_IDS,
} from '../utils/fareCalculator.js';

// Precision Haversine algorithm for nearest corridor station
function getNearestStation(userLat, userLon, stations) {
  const R = 6371; // Earth radius in km
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

// Popular transit hubs for quick 1-tap destination selection
const POPULAR_DESTINATIONS = [
  { id: 'ALVA', name: 'Aluva' },
  { id: 'EDAP', name: 'Edapally' },
  { id: 'MGRD', name: 'MG Road' },
  { id: 'MACE', name: 'Maharajas' },
  { id: 'VYTA', name: 'Vyttila' },
  { id: 'TPHT', name: 'Tripunithura' },
];

export function NetworkView() {
  const navigate = useNavigate();
  const {
    trains,
    activeTrainsCount,
    istTime,
    connectionStatus,
    stations,
    activeStation,
    setActiveStation,
    nearestStation,
    setNearestStation,
    userLocation,
    setUserLocation,
  } = useStationContext();

  const currentStation = activeStation || nearestStation;

  // Trip Destination State
  const [destinationStation, setDestinationStation] = useState(null);
  const [isDestPickerOpen, setIsDestPickerOpen] = useState(false);
  const [destSearchQuery, setDestSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('ALL'); // 'ALL' | 'NORTH' | 'SOUTH'
  const [isDrawerExpanded, setIsDrawerExpanded] = useState(true);

  // Responsive state for dynamic map padding
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate dynamic map padding so objects are never hidden behind the bottom sheet
  const mapPadding = useMemo(() => {
    if (isMobile) {
      return {
        bottom: Math.round(window.innerHeight * 0.5),
        top: 20,
        left: 20,
        right: 20,
      };
    }
    return {
      bottom: 40,
      top: 40,
      left: 540,
      right: 40,
    };
  }, [isMobile]);

  const [viewState, setViewState] = useState({
    longitude: 76.315,
    latitude: 10.025,
    zoom: 12.5,
  });

  // Smart helper for Tripunithura fallback station
  const getTripunithuraStation = useCallback((stList) => {
    if (!stList || stList.length === 0) return null;
    return (
      stList.find(
        (s) =>
          normalizeStationId(s.id) === 'TPHT' ||
          s.name.toLowerCase().includes('tripunithura') ||
          s.name.toLowerCase().includes('thripunithura')
      ) || stList[stList.length - 1]
    );
  }, []);

  // Geolocation detection on mount with graceful failure fallback to Tripunithura
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
        (err) => {
          console.warn('[Geolocation] Graceful fallback to Tripunithura:', err.message);
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

  // Recalculate if stations load after location resolution
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

  // Reset destination if user picks the same station as origin
  useEffect(() => {
    if (currentStation && destinationStation) {
      if (normalizeStationId(currentStation.id) === normalizeStationId(destinationStation.id)) {
        setDestinationStation(null);
      }
    }
  }, [currentStation, destinationStation]);

  // Full-Corridor Upstream Arrival Calculations for currentStation
  const stationArrivals = useMemo(() => {
    if (!currentStation || !trains || trains.length === 0) {
      return { north: [], south: [], all: [] };
    }

    const normTargetId = normalizeStationId(currentStation.id);
    const targetName = currentStation.name.toLowerCase();

    const arrivals = [];

    for (const train of trains) {
      let etaSec = null;
      let distMeters = null;

      // 1. Check if currentStation is the immediate next stop
      if (
        normalizeStationId(train.nextStationId) === normTargetId ||
        train.nextStation.toLowerCase() === targetName
      ) {
        etaSec = train.etaSeconds;
        distMeters = train.distanceToNextMeters;
      } else if (train.remainingStops && train.remainingStops.length > 0) {
        // 2. Check in future remaining stops
        const matchedStop = train.remainingStops.find(
          (s) =>
            normalizeStationId(s.stopId) === normTargetId ||
            s.stopName.toLowerCase() === targetName
        );
        if (matchedStop) {
          etaSec = matchedStop.etaSeconds;
          distMeters = matchedStop.distanceMeters;
        }
      }

      if (etaSec !== null) {
        arrivals.push({
          train,
          etaSeconds: etaSec,
          distanceMeters: distMeters || 0,
          directionId: train.directionId, // 0 = Southbound (Tripunithura), 1 = Northbound (Aluva)
          currentLocation: train.isDwelling
            ? `At ${train.nextStation}`
            : `Near ${train.nextStation}`,
        });
      }
    }

    const north = arrivals
      .filter((a) => a.directionId === 1)
      .sort((a, b) => a.etaSeconds - b.etaSeconds)
      .slice(0, 3);

    const south = arrivals
      .filter((a) => a.directionId === 0)
      .sort((a, b) => a.etaSeconds - b.etaSeconds)
      .slice(0, 3);

    const all = [...arrivals].sort((a, b) => a.etaSeconds - b.etaSeconds);

    return { north, south, all };
  }, [currentStation, trains]);

  // Trip Intelligence Planning (When Destination is Active)
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

    // Candidates in matching direction that stop at currentStation then destinationStation
    const normDestId = normalizeStationId(destinationStation.id);
    const relevantArrivals = (direction === 1 ? stationArrivals.north : stationArrivals.south).filter(
      (arr) => {
        if (!arr.train.remainingStops || arr.train.remainingStops.length === 0) return true;
        return arr.train.remainingStops.some(
          (s) => normalizeStationId(s.stopId) === normDestId
        );
      }
    );

    const recommended = relevantArrivals[0] || null;
    const laterTrains = relevantArrivals.slice(1, 3);

    let arrivalTimeStr = '--:--';
    if (recommended) {
      const totalTripSeconds = recommended.etaSeconds + rideMinutes * 60;
      const arrivalDate = new Date(Date.now() + totalTripSeconds * 1000);
      arrivalTimeStr = arrivalDate.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }

    return {
      direction, // 0 = South, 1 = North
      directionLabel: direction === 1 ? 'TOWARDS NORTH (ALUVA)' : 'TOWARDS SOUTH (TRIPUNITHURA)',
      fare,
      hops,
      rideMinutes,
      recommendedTrain: recommended?.train || null,
      waitEtaSeconds: recommended?.etaSeconds ?? null,
      arrivalTimeStr,
      laterTrains,
    };
  }, [currentStation, destinationStation, stationArrivals]);

  // Filtered station search for destination picker
  const filteredDestinationStations = useMemo(() => {
    if (!stations) return [];
    const q = destSearchQuery.trim().toLowerCase();
    return stations
      .filter((st) => normalizeStationId(st.id) !== normalizeStationId(currentStation?.id))
      .filter((st) => !q || st.name.toLowerCase().includes(q) || st.id.toLowerCase().includes(q));
  }, [stations, currentStation, destSearchQuery]);

  const handleSelectTrain = useCallback(
    (train) => {
      navigate(`/train/${train.id}`);
    },
    [navigate]
  );

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

  const handleSelectDestination = (st) => {
    setDestinationStation(st);
    setIsDestPickerOpen(false);
    setDestSearchQuery('');
  };

  const handleClearDestination = () => {
    setDestinationStation(null);
    setIsDestPickerOpen(false);
    setDestSearchQuery('');
  };

  const isTerminalNorth = currentStation && normalizeStationId(currentStation.id) === 'ALVA';
  const isTerminalSouth = currentStation && normalizeStationId(currentStation.id) === 'TPHT';

  return (
    <div className="w-full min-h-[100dvh] h-[100dvh] relative overflow-hidden bg-[#0B0F19] text-white font-sans select-none overscroll-y-contain">
      {/* Pure Circuit Schematic Map with Route Segment Highlighting */}
      <MapBase
        viewState={viewState}
        onViewStateChange={setViewState}
        onSelectTrain={handleSelectTrain}
        onSelectStation={handleSelectStation}
        padding={mapPadding}
        recommendedTrainId={tripPlan?.recommendedTrain?.id || null}
        routeHighlight={
          destinationStation && currentStation
            ? { originId: currentStation.id, destinationId: destinationStation.id }
            : null
        }
      />

      {/* Top Header Information Bar */}
      <header className="absolute top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-6 z-20 flex flex-wrap items-center justify-between pointer-events-none gap-4">
        <div className="pointer-events-auto p-3.5 sm:p-4 rounded-xl border border-white/5 bg-[#0E1524]/90 backdrop-blur-md flex items-center gap-3 sm:gap-6">
          <div className="flex flex-col">
            <span className="font-mono text-xs font-bold tracking-widest text-white uppercase">
              KOCHI METRO
            </span>
            <span className="font-mono text-[9px] tracking-wider text-slate-400 uppercase">
              COMMUTER STATION HUB
            </span>
          </div>

          <div className="h-4 w-[1px] bg-white/10 hidden sm:block" />

          <div className="flex items-center gap-2 text-slate-400">
            <Train size={16} strokeWidth={1.5} className="text-current" />
            <span className="font-mono text-xs text-white font-medium">
              {activeTrainsCount} TRAINS ACTIVE
            </span>
          </div>

          <div className="h-4 w-[1px] bg-white/10 hidden sm:block" />

          <div className="hidden sm:flex items-center gap-2 text-slate-400">
            <Clock size={16} strokeWidth={1.5} className="text-current" />
            <span className="font-mono text-xs text-white font-medium">
              {istTime || '--:--:--'} IST
            </span>
          </div>
        </div>

        {/* Active Origin Station Indicator */}
        <div className="pointer-events-auto p-3.5 sm:p-4 rounded-xl border border-white/5 bg-[#0E1524]/90 backdrop-blur-md flex items-center gap-3">
          <MapPin size={16} strokeWidth={1.5} className="text-[#00A896]" />
          <div className="flex flex-col">
            <span className="font-mono text-[9px] text-slate-400 uppercase tracking-wider">
              ACTIVE STATION
            </span>
            <span className="font-mono text-xs font-bold text-white uppercase">
              {currentStation?.name || 'LOCATING...'}
            </span>
          </div>
        </div>
      </header>

      {/* Floating Bento Commuter Drawer / Mobile Swipeable Bottom Sheet */}
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
        className="absolute bottom-0 left-0 right-0 sm:bottom-6 sm:left-6 sm:right-auto sm:w-[500px] md:w-[540px] z-30 pointer-events-auto overscroll-y-contain"
      >
        <div className="p-5 sm:p-6 rounded-t-3xl sm:rounded-2xl border border-white/5 bg-[#0E1524]/95 backdrop-blur-md flex flex-col gap-4 sm:gap-5 max-h-[84vh] sm:max-h-[80vh] overflow-hidden">
          {/* Mobile Swipe Grab Bar Indicator */}
          <div
            onClick={() => setIsDrawerExpanded(!isDrawerExpanded)}
            className="w-12 h-1.5 rounded-full bg-white/20 mx-auto cursor-grab active:cursor-grabbing sm:hidden"
          />

          {/* Drawer Top Header Handle */}
          <div
            onClick={() => setIsDrawerExpanded(!isDrawerExpanded)}
            className="flex items-center justify-between cursor-pointer border-b border-white/5 pb-3 select-none"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                <Compass size={16} strokeWidth={1.5} className="text-[#00A896]" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs tracking-wider uppercase text-white font-bold">
                    {destinationStation
                      ? `${currentStation?.name.toUpperCase()} ➔ ${destinationStation.name.toUpperCase()}`
                      : `${currentStation?.name.toUpperCase() || 'STATION'} HUB`}
                  </span>
                  <span className="font-mono text-[9px] text-[#00A896] px-1.5 py-0.5 rounded bg-white/5 border border-white/5 uppercase">
                    {destinationStation ? 'TRIP PLAN' : 'LIVE PIDS'}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-slate-400">
                  {destinationStation && tripPlan
                    ? `REACH BY ${tripPlan.arrivalTimeStr} • FARE ₹${tripPlan.fare}`
                    : 'REAL-TIME PLATFORM DEPARTURES'}
                </span>
              </div>
            </div>

            <button className="text-slate-400 hover:text-white p-1">
              {isDrawerExpanded ? <ChevronDown size={18} strokeWidth={1.5} /> : <ChevronUp size={18} strokeWidth={1.5} />}
            </button>
          </div>

          {/* Drawer Scrollable Content Area */}
          <div className="overflow-y-auto flex flex-col gap-4 pr-1">
            {/* "Where to?" Destination Action Selector */}
            <div className="p-3.5 sm:p-4 rounded-xl border border-white/5 bg-[#0B0F19]/60 flex flex-col gap-2.5">
              {!destinationStation ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">
                      PLAN A JOURNEY FROM {currentStation?.name.toUpperCase()}
                    </span>
                    <span className="font-mono text-[9px] text-slate-500">
                      SELECT DESTINATION
                    </span>
                  </div>

                  {/* Destination Search Box */}
                  <div className="relative">
                    <Search size={16} strokeWidth={1.5} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="WHERE ARE YOU GOING? (E.G. ALUVA, MG ROAD)..."
                      value={destSearchQuery}
                      onFocus={() => setIsDestPickerOpen(true)}
                      onChange={(e) => {
                        setDestSearchQuery(e.target.value);
                        setIsDestPickerOpen(true);
                      }}
                      className="w-full font-mono text-xs pl-9 pr-3 py-2 bg-white/[0.02] hover:bg-white/[0.04] focus:bg-white/[0.05] focus:ring-0 focus:outline-none text-white placeholder-slate-500 uppercase border border-white/5 rounded-lg transition-colors"
                    />
                  </div>

                  {/* Popular Destinations Quick Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="font-mono text-[9px] text-slate-500 mr-1">QUICK:</span>
                    {POPULAR_DESTINATIONS.filter(
                      (p) => normalizeStationId(p.id) !== normalizeStationId(currentStation?.id)
                    ).map((hub) => (
                      <button
                        key={hub.id}
                        onClick={() => {
                          const matched = stations.find((s) => normalizeStationId(s.id) === normalizeStationId(hub.id));
                          if (matched) handleSelectDestination(matched);
                        }}
                        className="px-2 py-1 rounded-md font-mono text-[9px] tracking-wider uppercase border border-white/5 bg-white/[0.02] hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                      >
                        {hub.name}
                      </button>
                    ))}
                  </div>

                  {/* Full Station Dropdown Modal/List */}
                  <AnimatePresence>
                    {isDestPickerOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border border-white/5 rounded-lg bg-[#0E1524] mt-1 max-h-48 overflow-y-auto flex flex-col divide-y divide-white/5 shadow-2xl"
                      >
                        {filteredDestinationStations.map((st) => (
                          <div
                            key={st.id}
                            onClick={() => handleSelectDestination(st)}
                            className="p-2.5 hover:bg-white/5 cursor-pointer flex items-center justify-between font-mono text-xs transition-colors"
                          >
                            <span className="text-white font-medium uppercase">{st.name}</span>
                            <span className="text-[10px] text-slate-500 uppercase">{st.id}</span>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                /* Active Route Pill Bar */
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#00A896]" />
                    <span className="font-mono text-xs font-bold text-white uppercase">
                      {currentStation?.name} ➔ {destinationStation.name}
                    </span>
                    <span className="font-mono text-[9px] text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-1.5 py-0.5 rounded">
                      ACTIVE ROUTE
                    </span>
                  </div>

                  <button
                    onClick={handleClearDestination}
                    className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-mono text-[10px] flex items-center gap-1 transition-colors"
                  >
                    <X size={12} strokeWidth={2} />
                    <span>RESET</span>
                  </button>
                </div>
              )}
            </div>

            {/* ========================================================================= */}
            {/* TRIP PLANNER ACTIVE MODE: When user selected a destination                */}
            {/* ========================================================================= */}
            {destinationStation && tripPlan && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-4"
              >
                {/* The Recommended Train Card */}
                {tripPlan.recommendedTrain ? (
                  <div className="p-4 rounded-xl border border-cyan-500/30 bg-gradient-to-b from-[#0E2038]/80 to-[#0B1526]/80 flex flex-col gap-4 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                        <span className="font-mono text-xs font-bold text-white uppercase">
                          TRAIN {tripPlan.recommendedTrain.id.replace('KMRL-', '')}
                        </span>
                        <span className="font-mono text-[9px] text-cyan-300 uppercase px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-700/50">
                          RECOMMENDED
                        </span>
                      </div>

                      <span className="font-mono text-[10px] text-slate-400 uppercase">
                        {tripPlan.directionLabel}
                      </span>
                    </div>

                    {/* 4-Metric Bento Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {/* Metric 1: Board In */}
                      <div className="p-3 rounded-lg border border-white/5 bg-[#0B0F19]/60 flex flex-col justify-between">
                        <span className="font-mono text-[9px] text-slate-400 uppercase tracking-wider">
                          BOARD IN
                        </span>
                        <span className="font-mono text-sm sm:text-base font-bold text-white pt-1">
                          {tripPlan.waitEtaSeconds <= 0
                            ? 'ARRIVING NOW'
                            : `${Math.floor(tripPlan.waitEtaSeconds / 60)}M ${tripPlan.waitEtaSeconds % 60}S`}
                        </span>
                      </div>

                      {/* Metric 2: Travel Duration */}
                      <div className="p-3 rounded-lg border border-white/5 bg-[#0B0F19]/60 flex flex-col justify-between">
                        <span className="font-mono text-[9px] text-slate-400 uppercase tracking-wider">
                          RIDE TIME
                        </span>
                        <span className="font-mono text-sm sm:text-base font-bold text-white pt-1">
                          {tripPlan.rideMinutes} MIN
                        </span>
                        <span className="font-mono text-[9px] text-slate-500">
                          {tripPlan.hops} STATIONS
                        </span>
                      </div>

                      {/* Metric 3: Reach Destination */}
                      <div className="p-3 rounded-lg border border-white/5 bg-[#0B0F19]/60 flex flex-col justify-between">
                        <span className="font-mono text-[9px] text-slate-400 uppercase tracking-wider">
                          REACH AT
                        </span>
                        <span className="font-mono text-sm sm:text-base font-bold text-white pt-1">
                          {tripPlan.arrivalTimeStr}
                        </span>
                      </div>

                      {/* Metric 4: Fare */}
                      <div className="p-3 rounded-lg border border-white/5 bg-[#0B0F19]/60 flex flex-col justify-between">
                        <span className="font-mono text-[9px] text-slate-400 uppercase tracking-wider">
                          METRO FARE
                        </span>
                        <span className="font-mono text-sm sm:text-base font-bold text-[#00A896] pt-1">
                          ₹{tripPlan.fare}
                        </span>
                        <span className="font-mono text-[9px] text-slate-500">KMRL TARIFF</span>
                      </div>
                    </div>

                    {/* Track Live Train Action Button */}
                    <button
                      onClick={() => handleSelectTrain(tripPlan.recommendedTrain)}
                      className="w-full p-3 rounded-lg border border-cyan-500/40 bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-300 font-mono text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <Navigation size={14} strokeWidth={2} />
                      <span>TRACK THIS TRAIN LIVE ON MAP</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-6 rounded-xl border border-white/5 bg-[#0B0F19]/60 text-center font-mono text-xs text-slate-500">
                    NO TRAIN CURRENTLY UPSTREAM TOWARDS {destinationStation.name.toUpperCase()}
                  </div>
                )}

                {/* Later Departures Section */}
                {tripPlan.laterTrains.length > 0 && (
                  <div className="p-4 rounded-xl border border-white/5 bg-[#0B0F19]/60 flex flex-col gap-2.5">
                    <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider border-b border-white/5 pb-2">
                      LATER TRAINS FOR THIS ROUTE
                    </span>

                    {tripPlan.laterTrains.map((later) => (
                      <div
                        key={later.train.id}
                        onClick={() => handleSelectTrain(later.train)}
                        className="p-2.5 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Train size={14} strokeWidth={1.5} className="text-slate-400" />
                          <span className="font-mono text-xs font-bold text-white">
                            TRAIN {later.train.id.replace('KMRL-', '')}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">
                            {later.currentLocation}
                          </span>
                        </div>

                        <div className="text-right font-mono text-xs text-slate-300">
                          <span>IN {Math.floor(later.etaSeconds / 60)}M {later.etaSeconds % 60}S</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ========================================================================= */}
            {/* DEFAULT STATION HUB MODE: Passenger Information Display System (PIDS)     */}
            {/* ========================================================================= */}
            {!destinationStation && (
              <div className="flex flex-col gap-4">
                {/* Platform Direction Switcher Tabs */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setPlatformFilter('ALL')}
                    className={`p-2 rounded-lg font-mono text-[10px] tracking-wider uppercase border transition-colors text-center ${
                      platformFilter === 'ALL'
                        ? 'bg-white/10 border-white/20 text-white font-bold'
                        : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    ALL PLATFORMS
                  </button>

                  <button
                    onClick={() => setPlatformFilter('NORTH')}
                    className={`p-2 rounded-lg font-mono text-[10px] tracking-wider uppercase border transition-colors text-center ${
                      platformFilter === 'NORTH'
                        ? 'bg-white/10 border-white/20 text-white font-bold'
                        : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    PLATFORM 1 (NORTH)
                  </button>

                  <button
                    onClick={() => setPlatformFilter('SOUTH')}
                    className={`p-2 rounded-lg font-mono text-[10px] tracking-wider uppercase border transition-colors text-center ${
                      platformFilter === 'SOUTH'
                        ? 'bg-white/10 border-white/20 text-white font-bold'
                        : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    PLATFORM 2 (SOUTH)
                  </button>
                </div>

                {/* Dual Platform Display Boards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Platform 1: Towards North (Aluva) */}
                  {(platformFilter === 'ALL' || platformFilter === 'NORTH') && (
                    <div className="p-4 rounded-xl border border-white/5 bg-[#0B0F19]/60 flex flex-col gap-3">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-700/60 text-cyan-300 font-bold uppercase">
                            PLATFORM 1
                          </span>
                          <span className="font-mono text-xs font-bold text-white uppercase">
                            TOWARDS ALUVA
                          </span>
                        </div>
                        <span className="font-mono text-[9px] text-slate-500 uppercase">
                          NORTHBOUND
                        </span>
                      </div>

                      {isTerminalNorth ? (
                        <div className="p-4 rounded-lg border border-white/5 bg-white/[0.01] text-center font-mono text-xs text-slate-500">
                          NORTHERN TERMINUS STATION (NO NORTHBOUND DEPARTURES)
                        </div>
                      ) : stationArrivals.north.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {stationArrivals.north.map((arr, idx) => (
                            <div
                              key={arr.train.id}
                              onClick={() => handleSelectTrain(arr.train)}
                              className="p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] cursor-pointer flex items-center justify-between transition-colors"
                            >
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-white">
                                    TRAIN {arr.train.id.replace('KMRL-', '')}
                                  </span>
                                  <span className="font-mono text-[9px] text-slate-400">
                                    {arr.currentLocation}
                                  </span>
                                </div>
                                <span className="font-mono text-[9px] text-slate-500">
                                  {arr.distanceMeters} METERS AWAY
                                </span>
                              </div>

                              <div className="text-right flex flex-col items-end">
                                <span className="font-mono text-xs font-bold text-white">
                                  {arr.etaSeconds <= 0
                                    ? 'ARRIVING NOW'
                                    : `${Math.floor(arr.etaSeconds / 60)}M ${arr.etaSeconds % 60}S`}
                                </span>
                                <span className="font-mono text-[9px] text-[#00A896]">
                                  {idx === 0 ? 'NEXT TRAIN' : `TRAIN #${idx + 1}`}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 rounded-lg border border-white/5 bg-white/[0.01] flex items-center justify-center min-h-[64px]">
                          {trains.length === 0 ? (
                            <div className="flex items-center gap-2 text-slate-500 font-mono text-xs">
                              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping" />
                              <span>CALCULATING TELEMETRY...</span>
                            </div>
                          ) : (
                            <span className="font-mono text-[10px] text-slate-500 text-center">
                              NO UPSTREAM TRAINS APPROACHING
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Platform 2: Towards South (Tripunithura) */}
                  {(platformFilter === 'ALL' || platformFilter === 'SOUTH') && (
                    <div className="p-4 rounded-xl border border-white/5 bg-[#0B0F19]/60 flex flex-col gap-3">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700/60 text-emerald-300 font-bold uppercase">
                            PLATFORM 2
                          </span>
                          <span className="font-mono text-xs font-bold text-white uppercase">
                            TOWARDS TRIPUNITHURA
                          </span>
                        </div>
                        <span className="font-mono text-[9px] text-slate-500 uppercase">
                          SOUTHBOUND
                        </span>
                      </div>

                      {isTerminalSouth ? (
                        <div className="p-4 rounded-lg border border-white/5 bg-white/[0.01] text-center font-mono text-xs text-slate-500">
                          SOUTHERN TERMINUS STATION (NO SOUTHBOUND DEPARTURES)
                        </div>
                      ) : stationArrivals.south.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {stationArrivals.south.map((arr, idx) => (
                            <div
                              key={arr.train.id}
                              onClick={() => handleSelectTrain(arr.train)}
                              className="p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] cursor-pointer flex items-center justify-between transition-colors"
                            >
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-white">
                                    TRAIN {arr.train.id.replace('KMRL-', '')}
                                  </span>
                                  <span className="font-mono text-[9px] text-slate-400">
                                    {arr.currentLocation}
                                  </span>
                                </div>
                                <span className="font-mono text-[9px] text-slate-500">
                                  {arr.distanceMeters} METERS AWAY
                                </span>
                              </div>

                              <div className="text-right flex flex-col items-end">
                                <span className="font-mono text-xs font-bold text-white">
                                  {arr.etaSeconds <= 0
                                    ? 'ARRIVING NOW'
                                    : `${Math.floor(arr.etaSeconds / 60)}M ${arr.etaSeconds % 60}S`}
                                </span>
                                <span className="font-mono text-[9px] text-[#00A896]">
                                  {idx === 0 ? 'NEXT TRAIN' : `TRAIN #${idx + 1}`}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 rounded-lg border border-white/5 bg-white/[0.01] flex items-center justify-center min-h-[64px]">
                          {trains.length === 0 ? (
                            <div className="flex items-center gap-2 text-slate-500 font-mono text-xs">
                              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping" />
                              <span>CALCULATING TELEMETRY...</span>
                            </div>
                          ) : (
                            <span className="font-mono text-[10px] text-slate-500 text-center">
                              NO UPSTREAM TRAINS APPROACHING
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
