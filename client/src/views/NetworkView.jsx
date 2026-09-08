import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
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
      left: 480,
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

  // Full-corridor arrival calculations for currentStation
  const stationArrivals = useMemo(() => {
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
      .sort((a, b) => a.etaSeconds - b.etaSeconds)
      .slice(0, 3);

    const south = arrivals
      .filter((a) => a.directionId === 0)
      .sort((a, b) => a.etaSeconds - b.etaSeconds)
      .slice(0, 3);

    return { north, south };
  }, [currentStation, trains]);

  // Active Journey Trip Intelligence (when Destination is chosen)
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
      direction,
      fare,
      hops,
      rideMinutes,
      recommendedTrain: recommended?.train || null,
      recommendedTrainStatus: recommended?.currentLocation || '',
      waitEtaSeconds: recommended?.etaSeconds ?? null,
      arrivalTimeStr,
      laterTrains,
    };
  }, [currentStation, destinationStation, stationArrivals]);

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
        recommendedTrainId={tripPlan?.recommendedTrain?.id || null}
        routeHighlight={
          destinationStation && currentStation
            ? { originId: currentStation.id, destinationId: destinationStation.id }
            : null
        }
      />

      {/* Clean Minimal Header Bar */}
      <header className="absolute top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-6 z-20 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto px-4 py-2.5 rounded-xl border border-white/5 bg-[#0E1524]/90 backdrop-blur-md flex items-center gap-3">
          <span className="font-mono text-xs font-bold tracking-widest text-white uppercase">
            KOCHI METRO
          </span>
          <div className="h-3 w-[1px] bg-white/10" />
          <span className="font-mono text-[11px] text-slate-400">
            {activeTrainsCount} trains active
          </span>
          <div className="h-3 w-[1px] bg-white/10 hidden sm:block" />
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
        animate={{ y: isDrawerExpanded ? 0 : 'calc(100% - 60px)' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute bottom-0 left-0 right-0 sm:bottom-6 sm:left-6 sm:right-auto sm:w-[460px] z-30 pointer-events-auto overscroll-y-contain"
      >
        <div className="p-4 sm:p-5 rounded-t-3xl sm:rounded-2xl border border-white/5 bg-[#0E1524]/95 backdrop-blur-md flex flex-col gap-3.5 max-h-[82vh] sm:max-h-[78vh] overflow-hidden">
          {/* Mobile Swipe Grab Bar */}
          <div
            onClick={() => setIsDrawerExpanded(!isDrawerExpanded)}
            className="w-12 h-1.5 rounded-full bg-white/20 mx-auto cursor-grab active:cursor-grabbing sm:hidden"
          />

          {/* Drawer Top Toggle Header */}
          <div
            onClick={() => setIsDrawerExpanded(!isDrawerExpanded)}
            className="flex items-center justify-between cursor-pointer border-b border-white/5 pb-2.5 select-none"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-white uppercase">
                {destinationStation
                  ? `${currentStation?.name} ➔ ${destinationStation.name}`
                  : `${currentStation?.name || 'Kochi'} Station`}
              </span>
              {destinationStation && tripPlan && (
                <span className="font-mono text-[10px] text-[#00A896]">
                  ₹{tripPlan.fare}
                </span>
              )}
            </div>

            <button className="text-slate-400 hover:text-white p-1">
              {isDrawerExpanded ? <ChevronDown size={16} strokeWidth={1.5} /> : <ChevronUp size={16} strokeWidth={1.5} />}
            </button>
          </div>

          {/* Drawer Body Area */}
          <div className="overflow-y-auto flex flex-col gap-3 pr-1">
            {/* Classic Boarding & Departing Station Selector */}
            <div className="p-3.5 rounded-xl border border-white/5 bg-[#0B0F19]/70 flex flex-col gap-2.5">
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                {/* Boarding Station Dropdown */}
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[9px] text-slate-400 uppercase tracking-wider">
                    Boarding Station
                  </label>
                  <select
                    value={currentStation?.id || ''}
                    onChange={(e) => {
                      const selected = stations.find((s) => s.id === e.target.value);
                      if (selected) handleSelectStation(selected);
                    }}
                    className="w-full font-mono text-xs bg-[#0E1524] text-white border border-white/10 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    {stations.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Swap Button */}
                <div className="flex pb-0.5">
                  <button
                    onClick={handleSwapStations}
                    disabled={!destinationStation}
                    title="Swap Stations"
                    className="p-1.5 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed text-slate-300 hover:text-white transition-colors"
                  >
                    <ArrowUpDown size={14} strokeWidth={2} />
                  </button>
                </div>

                {/* Destination Dropdown */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="font-mono text-[9px] text-slate-400 uppercase tracking-wider">
                      Destination
                    </label>
                    {destinationStation && (
                      <button
                        onClick={handleClearDestination}
                        className="text-[9px] text-slate-400 hover:text-white transition-colors"
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
                    className="w-full font-mono text-xs bg-[#0E1524] text-white border border-white/10 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="">Select destination...</option>
                    {stations
                      .filter((st) => normalizeStationId(st.id) !== normalizeStationId(currentStation?.id))
                      .map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            {/* STATE A: When Destination is Selected (Active Journey Details) */}
            {destinationStation && tripPlan && (
              <div className="p-3.5 rounded-xl border border-cyan-500/25 bg-gradient-to-b from-[#0E2038]/60 to-[#0B1526]/60 flex flex-col gap-3 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                {/* Next Train Row */}
                {tripPlan.recommendedTrain ? (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                        <span className="font-mono text-xs font-bold text-white uppercase">
                          Next Train: KMRL-{tripPlan.recommendedTrain.id.replace('KMRL-', '')}
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-cyan-300">
                        {tripPlan.waitEtaSeconds <= 0
                          ? 'Arriving now'
                          : `in ${Math.floor(tripPlan.waitEtaSeconds / 60)}m ${tripPlan.waitEtaSeconds % 60}s`}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-400">
                      Status: <span className="text-slate-200">{tripPlan.recommendedTrainStatus}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center font-mono text-xs text-slate-400 py-1">
                    No train currently scheduled for this route
                  </div>
                )}

                {/* Single Non-Redundant Journey Summary Bar */}
                <div className="p-2.5 rounded-lg bg-[#0B0F19]/60 border border-white/5 flex items-center justify-between font-mono text-xs">
                  <span className="text-slate-300">
                    {tripPlan.rideMinutes} mins • {tripPlan.hops} stops
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-[#00A896] font-bold">
                    Fare ₹{tripPlan.fare}
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-300">
                    Reach {tripPlan.arrivalTimeStr}
                  </span>
                </div>

                {/* Following Departures */}
                {tripPlan.laterTrains.length > 0 && (
                  <div className="flex flex-col gap-1 pt-1.5 border-t border-white/5">
                    <span className="font-mono text-[9px] text-slate-500 uppercase tracking-wider">
                      Following trains:
                    </span>
                    {tripPlan.laterTrains.map((later) => (
                      <div
                        key={later.train.id}
                        className="flex items-center justify-between font-mono text-xs text-slate-300 py-0.5"
                      >
                        <span>Train {later.train.id.replace('KMRL-', '')} • {later.currentLocation}</span>
                        <span className="text-slate-400">in {Math.floor(later.etaSeconds / 60)}m</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* STATE B: When Only Boarding Station is Selected (Station Departures) */}
            {!destinationStation && (
              <div className="flex flex-col gap-2.5">
                {/* Towards Aluva */}
                {!isTerminalNorth && (
                  <div className="p-3 rounded-xl border border-white/5 bg-[#0B0F19]/60 flex flex-col gap-2">
                    <div className="flex items-center justify-between border-b border-white/5 pb-1">
                      <span className="font-mono text-xs font-bold text-white uppercase">
                        Towards Aluva
                      </span>
                      <span className="font-mono text-[9px] text-slate-500">
                        Platform 1
                      </span>
                    </div>

                    {stationArrivals.north.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        {stationArrivals.north.map((arr, idx) => (
                          <div
                            key={arr.train.id}
                            className="flex items-center justify-between font-mono text-xs text-slate-300 py-0.5"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white">
                                Train {arr.train.id.replace('KMRL-', '')}
                              </span>
                              <span className="text-slate-500">•</span>
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
                      <div className="font-mono text-[11px] text-slate-500 py-1.5 text-center">
                        No trains currently approaching
                      </div>
                    )}
                  </div>
                )}

                {/* Towards Thripunithura */}
                {!isTerminalSouth && (
                  <div className="p-3 rounded-xl border border-white/5 bg-[#0B0F19]/60 flex flex-col gap-2">
                    <div className="flex items-center justify-between border-b border-white/5 pb-1">
                      <span className="font-mono text-xs font-bold text-white uppercase">
                        Towards Thripunithura
                      </span>
                      <span className="font-mono text-[9px] text-slate-500">
                        Platform 2
                      </span>
                    </div>

                    {stationArrivals.south.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        {stationArrivals.south.map((arr, idx) => (
                          <div
                            key={arr.train.id}
                            className="flex items-center justify-between font-mono text-xs text-slate-300 py-0.5"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white">
                                Train {arr.train.id.replace('KMRL-', '')}
                              </span>
                              <span className="text-slate-500">•</span>
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
                      <div className="font-mono text-[11px] text-slate-500 py-1.5 text-center">
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
