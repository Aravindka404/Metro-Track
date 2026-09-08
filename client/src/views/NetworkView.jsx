import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  Clock,
  Train,
  ArrowRight,
  ChevronUp,
  ChevronDown,
  Search,
} from 'lucide-react';
import { MapBase } from '../components/MapBase.jsx';
import { useStationContext } from '../context/useStationContext.jsx';

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

  const [directionFilter, setDirectionFilter] = useState('ALL'); // 'ALL' | '0' (Southbound) | '1' (Northbound)
  const [searchQuery, setSearchQuery] = useState('');
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
      left: 480,
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
          s.id === 'TRPN' ||
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

  // Phase 3: Search input 300ms debounce with automatic routing to FocusView
  useEffect(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return;

    const timer = setTimeout(() => {
      const matched = trains.find((t) => {
        const fullId = t.id.toLowerCase();
        const shortId = t.id.replace('KMRL-', '').toLowerCase();
        return fullId === trimmed || shortId === trimmed;
      });

      if (matched) {
        navigate(`/train/${matched.id}`);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, trains, navigate]);

  // Filtered train dataset
  const filteredTrains = useMemo(() => {
    return trains.filter((t) => {
      const matchesDir =
        directionFilter === 'ALL' || String(t.directionId) === directionFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        t.id.toLowerCase().includes(q) ||
        t.origin.toLowerCase().includes(q) ||
        t.destination.toLowerCase().includes(q) ||
        t.nextStation.toLowerCase().includes(q);
      return matchesDir && matchesQuery;
    });
  }, [trains, directionFilter, searchQuery]);

  // Next arrivals at active or nearest station
  const stationDepartures = useMemo(() => {
    const target = activeStation || nearestStation;
    if (!target) return [];

    return trains
      .filter((t) => t.nextStationId === target.id || t.nextStation === target.name)
      .sort((a, b) => a.etaSeconds - b.etaSeconds);
  }, [trains, activeStation, nearestStation]);

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

  return (
    <div className="w-full min-h-[100dvh] h-[100dvh] relative overflow-hidden bg-[#0B0F19] text-white font-sans select-none overscroll-y-contain">
      {/* Pure Circuit Schematic Map with Dynamic Padding */}
      <MapBase
        viewState={viewState}
        onViewStateChange={setViewState}
        onSelectTrain={handleSelectTrain}
        onSelectStation={handleSelectStation}
        padding={mapPadding}
      />

      {/* Top Header Information Bar */}
      <header className="absolute top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-6 z-20 flex flex-wrap items-center justify-between pointer-events-none gap-4">
        <div className="pointer-events-auto p-4 rounded-xl border border-white/5 bg-[#0E1524]/90 backdrop-blur-md flex items-center gap-4 sm:gap-6">
          <div className="flex flex-col">
            <span className="font-mono text-xs font-bold tracking-widest text-white uppercase">
              KOCHI METRO
            </span>
            <span className="font-mono text-[9px] tracking-wider text-slate-400 uppercase">
              LIVE METRO MAP
            </span>
          </div>

          <div className="h-4 w-[1px] bg-white/10 hidden sm:block" />

          <div className="flex items-center gap-2 text-slate-400">
            <Train size={16} strokeWidth={1.5} className="text-current" />
            <span className="font-mono text-xs text-white font-medium">
              {activeTrainsCount} TRAINS ACTIVE
            </span>
          </div>

          <div className="h-4 w-[1px] bg-white/10 hidden md:block" />

          <div className="hidden md:flex items-center gap-2 text-slate-400">
            <Clock size={16} strokeWidth={1.5} className="text-current" />
            <span className="font-mono text-xs text-white font-medium">
              {istTime || '--:--:--'} IST
            </span>
          </div>
        </div>

        {/* Nearest Station Pill */}
        {nearestStation && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => handleSelectStation(nearestStation)}
            className="pointer-events-auto p-4 rounded-xl border border-white/5 bg-[#0E1524]/90 backdrop-blur-md flex items-center gap-4 cursor-pointer hover:border-white/10 transition-colors"
          >
            <MapPin size={18} strokeWidth={1.5} className="text-slate-400" />
            <div className="flex flex-col">
              <span className="font-mono text-[9px] tracking-wider text-slate-400 uppercase">
                NEAREST STATION
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-medium text-white">
                  {nearestStation.name}
                </span>
                {nearestStation.distanceKm && (
                  <span className="font-mono text-[10px] text-slate-400">
                    ({nearestStation.distanceKm < 1
                      ? `${Math.round(nearestStation.distanceKm * 1000)} M AWAY`
                      : `${nearestStation.distanceKm.toFixed(1)} KM AWAY`})
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </header>

      {/* Swipeable Mobile Bottom Sheet & Bento Container */}
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 200 }}
        dragElastic={0.15}
        onDragEnd={(e, info) => {
          if (info.offset.y > 60) {
            setIsDrawerExpanded(false);
          } else if (info.offset.y < -60) {
            setIsDrawerExpanded(true);
          }
        }}
        animate={{ y: isDrawerExpanded ? 0 : 'calc(100% - 56px)' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute bottom-0 left-0 right-0 sm:bottom-6 sm:left-6 sm:right-auto sm:w-[480px] md:w-[560px] z-30 pointer-events-auto overscroll-y-contain"
      >
        <div className="p-6 rounded-t-3xl sm:rounded-2xl border border-white/5 bg-[#0E1524]/95 backdrop-blur-md flex flex-col gap-6 max-h-[82vh] sm:max-h-[78vh] overflow-hidden">
          {/* Mobile Swipe Grab Bar Indicator */}
          <div
            onClick={() => setIsDrawerExpanded(!isDrawerExpanded)}
            className="w-12 h-1.5 rounded-full bg-white/20 mx-auto cursor-grab active:cursor-grabbing sm:hidden"
          />

          {/* Drawer Header Handle */}
          <div
            onClick={() => setIsDrawerExpanded(!isDrawerExpanded)}
            className="flex items-center justify-between cursor-pointer border-b border-white/5 pb-4 select-none"
          >
            <div className="flex items-center gap-4">
              <Train size={18} strokeWidth={1.5} className="text-slate-400" />
              <div className="flex items-center gap-4">
                <span className="font-mono text-xs tracking-wider uppercase text-white font-semibold">
                  ACTIVE TRAINS
                </span>
                <span className="font-mono text-[10px] tracking-wider uppercase text-slate-400 px-2 py-0.5 rounded bg-white/5 border border-white/5">
                  {filteredTrains.length} RUNNING
                </span>
              </div>
            </div>
            <button className="text-slate-400 hover:text-white p-1">
              {isDrawerExpanded ? <ChevronDown size={18} strokeWidth={1.5} /> : <ChevronUp size={18} strokeWidth={1.5} />}
            </button>
          </div>

          {/* Drawer Content Area */}
          <div className="overflow-y-auto flex flex-col gap-6 pr-1">
            {/* Bento Responsive Grid: Left (Departures) + Right (Search & Filters) on md: */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Active / Nearest Station Departures Bento Card */}
              <div className="p-4 rounded-xl border border-white/5 bg-[#0B0F19]/60 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <MapPin size={18} strokeWidth={1.5} className="text-slate-400" />
                    <span className="font-mono text-xs font-semibold text-white truncate max-w-[120px]">
                      {(activeStation || nearestStation)?.name || 'STATION'}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {(activeStation || nearestStation)?.id}
                    </span>
                  </div>
                  <span className="font-mono text-[9px] text-slate-400 tracking-wider uppercase">
                    NEXT TRAINS
                  </span>
                </div>

                {stationDepartures.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {stationDepartures.slice(0, 2).map((dep) => (
                      <div
                        key={dep.id}
                        onClick={() => handleSelectTrain(dep)}
                        className="p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-white">
                              TRAIN {dep.id.replace('KMRL-', '')}
                            </span>
                            <div className="flex items-center gap-1 font-mono text-[10px] text-slate-400">
                              <ArrowRight size={14} strokeWidth={1.5} className="text-slate-400" />
                              <span className="truncate max-w-[80px]">{dep.destination.toUpperCase()}</span>
                            </div>
                          </div>
                          <span className="font-mono text-[9px] text-slate-500">
                            {dep.distanceToNextMeters} M AWAY
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="font-mono text-xs font-bold text-white">
                            {dep.etaSeconds <= 0
                              ? 'ARRIVING'
                              : `${Math.floor(dep.etaSeconds / 60)}M ${dep.etaSeconds % 60}S`}
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
                        <span>LOCATING TRAINS...</span>
                      </div>
                    ) : (
                      <span className="font-mono text-[10px] text-slate-500 text-center">
                        NO TRAINS APPROACHING THIS STATION
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Filter and Search Bento Controls */}
              <div className="p-4 rounded-xl border border-white/5 bg-[#0B0F19]/60 flex flex-col gap-3">
                <div className="relative">
                  <Search size={18} strokeWidth={1.5} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="SEARCH TRAIN ID OR STATION..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full font-mono text-xs pl-10 pr-3 py-2 bg-transparent focus:ring-0 focus:outline-none text-white placeholder-slate-500 uppercase border border-white/5 rounded-lg transition-colors"
                  />
                </div>

                {/* Direction Tabs */}
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => setDirectionFilter('ALL')}
                    className={`p-1.5 rounded-lg font-mono text-[9px] tracking-wider uppercase border transition-colors text-center ${
                      directionFilter === 'ALL'
                        ? 'bg-white/10 border-white/20 text-white font-bold'
                        : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    ALL
                  </button>
                  <button
                    onClick={() => setDirectionFilter('0')}
                    className={`p-1.5 rounded-lg font-mono text-[9px] tracking-wider uppercase border transition-colors text-center ${
                      directionFilter === '0'
                        ? 'bg-white/10 border-white/20 text-white font-bold'
                        : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    SOUTH
                  </button>
                  <button
                    onClick={() => setDirectionFilter('1')}
                    className={`p-1.5 rounded-lg font-mono text-[9px] tracking-wider uppercase border transition-colors text-center ${
                      directionFilter === '1'
                        ? 'bg-white/10 border-white/20 text-white font-bold'
                        : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    NORTH
                  </button>
                </div>
              </div>
            </div>

            {/* List of Active Trains */}
            <div className="flex flex-col gap-2">
              {filteredTrains.map((train) => (
                <div
                  key={train.id}
                  onClick={() => handleSelectTrain(train)}
                  className="group p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer transition-colors flex items-center justify-between"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-xs font-bold text-white">
                        TRAIN {train.id.replace('KMRL-', '')}
                      </span>
                      <span className="font-mono text-[10px] text-[#00A896]">
                        {train.isDwelling ? 'AT STATION' : 'ON THE MOVE'}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {train.speed} KM/H
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-xs text-slate-300">
                      <span>{train.origin.toUpperCase()}</span>
                      <ArrowRight size={16} strokeWidth={1.5} className="text-slate-400" />
                      <span>{train.destination.toUpperCase()}</span>
                    </div>

                    <div className="font-mono text-[10px] text-slate-500">
                      NEXT STATION: {train.nextStation.toUpperCase()} ({train.distanceToNextMeters} METERS)
                    </div>
                  </div>

                  <ArrowRight size={16} strokeWidth={1.5} className="text-slate-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </div>
              ))}

              {filteredTrains.length === 0 && (
                <div className="p-8 text-center font-mono text-xs text-slate-500 rounded-xl border border-white/5 bg-white/[0.01]">
                  {trains.length === 0 ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping" />
                      <span>CONNECTING TO SATELLITE TELEMETRY...</span>
                    </div>
                  ) : (
                    'NO ACTIVE TRAINS FOUND'
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
