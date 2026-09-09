import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, Clock, X, Sparkles, Moon, Navigation, Compass } from 'lucide-react';
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

  const currentStation = activeStation || nearestStation;

  // Destination & Drawer state
  const [destinationStation, setDestinationStation] = useState(null);
  const [isDrawerExpanded, setIsDrawerExpanded] = useState(true);
  const [selectedTrainIdx, setSelectedTrainIdx] = useState(0);

  // Station picker modal state ('origin' | 'destination' | null)
  const [stationPickerMode, setStationPickerMode] = useState(null);

  // Depart later time planning state (null = silent live default)
  const [selectedTime, setSelectedTime] = useState(null);
  const [customTimeInput, setCustomTimeInput] = useState('17:30');
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [scheduledDepartures, setScheduledDepartures] = useState([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);

  // Reset selected train index whenever route or time changes
  useEffect(() => {
    setSelectedTrainIdx(0);
  }, [currentStation?.id, destinationStation?.id, selectedTime]);

  const currentTheme = THEMES.nordic;

  // Responsive mobile detector
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
        bottom: isDrawerExpanded ? Math.round(window.innerHeight * 0.5) : 170,
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
          // Geolocation declined; fallback to first station (Aluva)
          if (stations.length > 0 && !activeStation) {
            setActiveStation(stations[0]);
          }
        },
        { enableHighAccuracy: false, timeout: 8000 }
      );
    }
  }, [stations, activeStation, setActiveStation, setNearestStation, setUserLocation]);

  // Fallback initial station if none set
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
          currentLocation: train.statusText || 'In transit',
        };
        if (train.direction === 1) {
          arrivalsNorth.push(item);
        } else {
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

    if (selectedTime) {
      const scheduledList = (scheduledDepartures || []).map((dep) => ({
        id: dep.trainId,
        displayId: dep.trainId.replace('KMRL-', ''),
        isLive: false,
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
        direction: arr.train.direction,
        depTime,
        arrTime,
        departureDisplay: depDisplay,
        status: arr.currentLocation,
        waitEtaSeconds: waitSec,
        rideMinutes,
      });
    }

    // 2. Backfill with scheduled departures if fewer than 4 live trains
    if (journeyTrains.length < 4 && scheduledDepartures && scheduledDepartures.length > 0) {
      for (const dep of scheduledDepartures) {
        if (journeyTrains.length >= 4) break;
        if (!journeyTrains.some((t) => t.id === dep.trainId)) {
          journeyTrains.push({
            id: dep.trainId,
            displayId: dep.trainId.replace('KMRL-', ''),
            isLive: false,
            direction: dep.directionId,
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

  const handleRecenterCorridor = () => {
    setViewState({
      longitude: 76.315,
      latitude: 10.025,
      zoom: 12.5,
    });
  };

  const activeTrain = tripPlan?.journeyTrains?.[selectedTrainIdx] || tripPlan?.journeyTrains?.[0];

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
        recommendedTrainId={activeTrain?.id || null}
        routeHighlight={
          destinationStation && currentStation
            ? { originId: currentStation.id, destinationId: destinationStation.id }
            : null
        }
        theme={currentTheme}
      />

      {/* Floating Frosted Header HUD */}
      <header className="absolute top-3 left-3 right-3 sm:top-5 sm:left-6 sm:right-6 z-20 flex items-center justify-between pointer-events-none gap-2">
        <div className="pointer-events-auto px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl border border-white/15 bg-[#0E1626]/90 backdrop-blur-xl flex items-center gap-2.5 sm:gap-3 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
          <span className="font-sans text-xs font-extrabold tracking-wider text-white uppercase">
            KOCHI METRO RADAR
          </span>
          <div className="h-3 w-[1px] bg-white/20" />
          {isOpen ? (
            <span className="font-sans text-xs text-slate-300 font-medium">
              <strong className="font-mono font-bold text-white">{activeTrainsCount}</strong> active
            </span>
          ) : (
            <span className="font-sans text-xs text-amber-300 font-semibold flex items-center gap-1.5">
              Service Closed
            </span>
          )}
          <div className="h-3 w-[1px] bg-white/20 hidden sm:block" />
          <span className="font-mono text-xs text-slate-400 hidden sm:inline tabular-nums">
            {istTime || '--:--:--'} <span className="font-sans text-[10px] font-bold text-slate-500">IST</span>
          </span>
        </div>

        {/* Live Network Status Badge + Recenter Action */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {isOpen ? (
            <div className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl border border-white/15 bg-[#0E1626]/90 backdrop-blur-xl flex items-center gap-2 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
              <span className="font-sans text-xs font-extrabold text-white tracking-wider">LIVE</span>
            </div>
          ) : (
            <div className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl border border-amber-500/30 bg-[#17141F]/90 backdrop-blur-xl flex items-center gap-2 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
              <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
              <span className="font-sans text-[11px] sm:text-xs font-bold text-amber-300 tracking-wide uppercase">
                Opens {opensAt || '06:00 AM'}
              </span>
            </div>
          )}

          {/* Recenter Map Button */}
          <button
            onClick={handleRecenterCorridor}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-white/15 bg-[#0E1626]/90 hover:bg-[#152238] backdrop-blur-xl flex items-center justify-center text-slate-300 hover:text-white shadow-lg active:scale-95 transition-all"
            title="Recenter Metro Corridor"
          >
            <Compass size={18} strokeWidth={2.2} />
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
              : 'calc(100% - 156px)'
            : 0,
        }}
        transition={{ type: 'spring', damping: 26, stiffness: 220 }}
        className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-6 sm:right-auto sm:w-[440px] z-30 pointer-events-auto overscroll-y-contain"
      >
        <div
          className={`p-4 sm:p-5 rounded-t-[28px] sm:rounded-3xl border ${currentTheme.drawerBorder} ${currentTheme.drawerBg} backdrop-blur-2xl flex flex-col gap-3 max-h-[82vh] sm:max-h-[80vh] overflow-hidden shadow-[0_16px_50px_rgba(0,0,0,0.7)] transition-all duration-300`}
        >
          {/* Mobile Swipe Grab Handle */}
          <div
            onClick={() => setIsDrawerExpanded(!isDrawerExpanded)}
            className="w-12 h-1.5 rounded-full bg-white/25 hover:bg-white/40 mx-auto cursor-grab active:cursor-grabbing sm:hidden -mt-1 mb-1"
          />

          {/* Interactive Station Pills Selector */}
          <StationPills
            originStation={currentStation}
            destinationStation={destinationStation}
            onOpenPicker={(mode) => setStationPickerMode(mode)}
            onSwap={handleSwapStations}
            onClearDestination={handleClearDestination}
            theme={currentTheme}
          />

          {/* Quick Route Stats Strip & Time Planning Row */}
          <div className="flex items-center justify-between px-1 border-b border-white/10 pb-2.5">
            {destinationStation && tripPlan ? (
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xl sm:text-2xl font-extrabold text-rose-500">
                  ₹{tripPlan.fare}
                </span>
                <span className="font-sans text-xs text-slate-300 font-medium">
                  {tripPlan.hops} stops • ~{tripPlan.rideMinutes} mins
                </span>
              </div>
            ) : (
              <span className="font-sans text-xs text-slate-400 font-medium">
                Choose destination to plan fare & route
              </span>
            )}

            {/* Depart Later Quick Action */}
            {!selectedTime ? (
              !isTimePickerOpen ? (
                <button
                  type="button"
                  onClick={() => setIsTimePickerOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors py-1 px-2 rounded-lg bg-sky-500/10 border border-sky-500/20 active:scale-95"
                >
                  <Clock size={12} strokeWidth={2.2} />
                  <span>Depart later</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 bg-[#0B0F19] p-1.5 rounded-xl border border-white/15">
                  <input
                    type="time"
                    value={customTimeInput}
                    onChange={(e) => setCustomTimeInput(e.target.value)}
                    className="bg-transparent text-white border border-white/10 rounded px-1.5 py-0.5 text-xs font-mono font-bold focus:outline-none focus:border-sky-400"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCustomTime}
                    className="px-2 py-0.5 rounded text-xs font-sans font-bold bg-sky-500 text-white hover:bg-sky-400 transition-colors"
                  >
                    Set
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTimePickerOpen(false)}
                    className="p-0.5 text-slate-400 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              )
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-sky-500/15 border border-sky-400/30 text-xs font-sans text-sky-300">
                <Clock size={12} />
                <span>After <strong>{formatTime12h(selectedTime)}</strong></span>
                <button
                  type="button"
                  onClick={handleResetToNow}
                  className="ml-1 text-slate-400 hover:text-white"
                  title="Reset to Live"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Drawer Body Scroll Area */}
          <div className="overflow-y-auto flex flex-col gap-3 pr-1 pb-1 overscroll-contain">
            {/* Off-Hours Service Closed Alert */}
            {!isOpen && (
              <div className="p-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-2.5 text-xs">
                <Moon size={15} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-sans font-bold text-amber-300">Service Closed for the Night</span>
                  <span className="text-slate-300 text-[11px] leading-relaxed">
                    Kochi Metro trains have concluded operations for today. Tomorrow's morning services commence at{' '}
                    <strong className="text-white font-semibold">{opensAt || '06:00 AM'} IST</strong>.
                  </span>
                </div>
              </div>
            )}

            {/* Upcoming Departures Header */}
            {destinationStation && tripPlan && (
              <div className="flex items-center justify-between px-1 pt-1">
                <span className="font-sans text-[11px] text-slate-400 uppercase tracking-wider font-extrabold">
                  {tripPlan.isCustomTime ? 'SCHEDULED DEPARTURES' : isOpen ? 'UPCOMING DEPARTURES' : 'MORNING DEPARTURES'}
                </span>
                <span className="font-sans text-[11px] text-slate-400 font-medium">
                  {tripPlan.journeyTrains?.length || 0} options available
                </span>
              </div>
            )}

            {/* ========================================================================= */}
            {/* STATE A: Destination Selected (Upcoming Clean Train Cards)                */}
            {/* ========================================================================= */}
            {destinationStation && tripPlan && tripPlan.journeyTrains && tripPlan.journeyTrains.length > 0 ? (
              <div className="flex flex-col gap-2">
                {tripPlan.journeyTrains.map((train, idx) => {
                  const isSelected = selectedTrainIdx === idx;
                  const isNorth = train.direction === 1;
                  const dotColor = isNorth ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]';

                  return (
                    <motion.div
                      key={train.id || idx}
                      layout
                      onClick={() => setSelectedTrainIdx(isSelected ? -1 : idx)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-sky-500/10 border-sky-400/40 shadow-[0_4px_20px_rgba(14,165,233,0.15)]'
                          : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/10'
                      }`}
                    >
                      {/* Top Row: Train ID + Departure Countdown/Time */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                          <span className="font-sans text-sm font-extrabold text-white tracking-tight">
                            KMRL-{train.displayId}
                          </span>
                          {idx === 0 && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/30">
                              Next
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-sky-400 tabular-nums">
                            {train.departureDisplay || train.depTime}
                          </span>
                          <ChevronDown
                            size={14}
                            className={`text-slate-400 transition-transform duration-200 ${
                              isSelected ? 'rotate-180 text-white' : ''
                            }`}
                          />
                        </div>
                      </div>

                      {/* Second Row: Ride Duration + Arrival Estimate */}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-[11px] text-slate-400 font-sans">
                        <span>Ride: <strong className="text-slate-200">{train.rideMinutes || tripPlan.rideMinutes} mins</strong></span>
                        <span>Arrival: <strong className="text-white font-mono">{train.arrTime || '--:--'}</strong></span>
                      </div>

                      {/* Expandable Journey Timeline & Telemetry */}
                      <AnimatePresence>
                        {isSelected && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden mt-3 pt-3 border-t border-white/10 flex flex-col gap-2"
                          >
                            <div className="text-xs font-sans text-slate-300 flex items-center justify-between">
                              <span>Status: <strong className="text-white">{train.status}</strong></span>
                              <span className="font-mono text-[11px] text-slate-400">
                                {train.waitEtaSeconds ? `ETA in ~${Math.ceil(train.waitEtaSeconds / 60)} mins` : ''}
                              </span>
                            </div>

                            <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between text-[11px] font-sans">
                              <span className="text-slate-300">
                                <strong>{currentStation.name}</strong> ➔ <strong>{destinationStation.name}</strong>
                              </span>
                              <span className="text-rose-400 font-mono font-bold">₹{tripPlan.fare}</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            ) : destinationStation ? (
              <div className="p-6 rounded-2xl border border-white/10 bg-[#0B0F19]/80 text-center font-sans text-xs font-medium text-slate-400">
                {isLoadingSchedule ? 'Checking metro schedules...' : 'No upcoming trains found for this route.'}
              </div>
            ) : null}

            {/* ========================================================================= */}
            {/* STATE B: Only Boarding Station Selected (General Platform Departures)      */}
            {/* ========================================================================= */}
            {!destinationStation && (
              <div className="flex flex-col gap-2.5">
                {/* Platform 1 Towards Aluva */}
                {currentStation && normalizeStationId(currentStation.id) !== 'ALVA' && (
                  <div className="p-3.5 rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col gap-2">
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                      <span className="font-sans text-xs sm:text-sm font-bold text-white tracking-tight">
                        Towards Aluva
                      </span>
                      <span className="font-sans text-[10px] text-slate-400 font-bold uppercase">
                        Platform 1
                      </span>
                    </div>

                    {liveStationArrivals.north.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        {liveStationArrivals.north.slice(0, 3).map((arr) => (
                          <div
                            key={arr.train.id}
                            className="p-2 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs"
                          >
                            <span className="font-bold text-white">
                              KMRL-{arr.train.id.replace('KMRL-', '')}
                            </span>
                            <span className="font-mono text-emerald-400 font-bold">
                              {arr.etaSeconds <= 0 ? 'Arriving now' : `in ${Math.floor(arr.etaSeconds / 60)}m`}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-500 py-1 text-center">
                        {isOpen ? 'No approaching trains' : `Service opens at ${opensAt || '06:00 AM'}`}
                      </span>
                    )}
                  </div>
                )}

                {/* Platform 2 Towards Thripunithura */}
                {currentStation && normalizeStationId(currentStation.id) !== 'TPHT' && (
                  <div className="p-3.5 rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col gap-2">
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                      <span className="font-sans text-xs sm:text-sm font-bold text-white tracking-tight">
                        Towards Thripunithura
                      </span>
                      <span className="font-sans text-[10px] text-slate-400 font-bold uppercase">
                        Platform 2
                      </span>
                    </div>

                    {liveStationArrivals.south.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        {liveStationArrivals.south.slice(0, 3).map((arr) => (
                          <div
                            key={arr.train.id}
                            className="p-2 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs"
                          >
                            <span className="font-bold text-white">
                              KMRL-{arr.train.id.replace('KMRL-', '')}
                            </span>
                            <span className="font-mono text-amber-400 font-bold">
                              {arr.etaSeconds <= 0 ? 'Arriving now' : `in ${Math.floor(arr.etaSeconds / 60)}m`}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-500 py-1 text-center">
                        {isOpen ? 'No approaching trains' : `Service opens at ${opensAt || '06:00 AM'}`}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Interactive Station Picker Search Modal */}
      <StationPickerModal
        isOpen={stationPickerMode !== null}
        onClose={() => setStationPickerMode(null)}
        mode={stationPickerMode || 'origin'}
        stations={stations}
        activeStation={currentStation}
        destinationStation={destinationStation}
        onSelectStation={(st, isDestination) => {
          if (isDestination) {
            setDestinationStation(st);
          } else {
            handleSelectStation(st);
          }
        }}
        theme={currentTheme}
      />
    </div>
  );
}
