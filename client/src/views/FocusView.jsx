import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Train,
  Clock,
  Gauge,
  MapPin,
  Share2,
  Crosshair,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { MapBase } from '../components/MapBase.jsx';
import { useStationContext } from '../context/useStationContext.jsx';

export function FocusView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { trains, stations, istTime } = useStationContext();

  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768
  );
  const [isDrawerExpanded, setIsDrawerExpanded] = useState(true);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Compute dynamic map padding so the focused train is offset above the mobile sheet
  const mapPadding = useMemo(() => {
    if (isMobile) {
      return {
        bottom: Math.round(window.innerHeight * 0.48),
        top: 20,
        left: 16,
        right: 16,
      };
    }
    return {
      bottom: 40,
      top: 40,
      left: 480,
      right: 40,
    };
  }, [isMobile]);

  const train = useMemo(() => {
    if (!id) return null;
    return trains.find((t) => t.id.toLowerCase() === id.toLowerCase());
  }, [trains, id]);

  const trainShortId = train ? train.id.replace('KMRL-', '') : (id ? id.replace('KMRL-', '') : '');

  const [viewState, setViewState] = useState({
    longitude: 76.315,
    latitude: 10.025,
    zoom: 14,
  });

  const [isLockedOnTrain, setIsLockedOnTrain] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  // Smooth camera lock-on
  useEffect(() => {
    if (train && isLockedOnTrain) {
      setViewState((prev) => ({
        ...prev,
        longitude: train.lng,
        latitude: train.lat,
        zoom: 14,
      }));
    }
  }, [train?.lng, train?.lat, isLockedOnTrain]);

  useEffect(() => {
    if (train) {
      setViewState({
        longitude: train.lng,
        latitude: train.lat,
        zoom: 14,
      });
    }
  }, [train?.id]);

  // Direction-specific station list
  const progressionStations = useMemo(() => {
    if (!stations || stations.length === 0) return [];

    const isNorthbound = train ? train.directionId === 1 : false;
    const ordered = isNorthbound ? [...stations].reverse() : [...stations];

    if (!train) return ordered.map((s) => ({ ...s, state: 'upcoming' }));

    const nextIdx = ordered.findIndex(
      (s) => s.id === train.nextStationId || s.name.toLowerCase() === train.nextStation.toLowerCase()
    );

    return ordered.map((s, idx) => {
      let state = 'upcoming';
      if (nextIdx !== -1) {
        if (idx < nextIdx) state = 'passed';
        else if (idx === nextIdx) state = 'next';
        else state = 'upcoming';
      }
      return {
        ...s,
        state,
        isNext: state === 'next',
        isPassed: state === 'passed',
      };
    });
  }, [stations, train]);

  const passedCount = useMemo(
    () => progressionStations.filter((s) => s.isPassed).length,
    [progressionStations]
  );

  const handleCopyShareLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleRecenter = () => {
    if (train) {
      setIsLockedOnTrain(true);
      setViewState((prev) => ({
        ...prev,
        longitude: train.lng,
        latitude: train.lat,
        zoom: 14,
      }));
    }
  };

  return (
    <div className="w-full min-h-[100dvh] h-[100dvh] relative overflow-hidden bg-[#0B0F19] text-white font-sans select-none overscroll-y-contain">
      {/* Pure Circuit Schematic Map */}
      <MapBase
        viewState={viewState}
        onViewStateChange={(newView) => {
          setViewState(newView);
        }}
        padding={mapPadding}
        selectedTrainId={train?.id}
      />

      {/* Top Header Information Bar */}
      <header className="absolute top-4 sm:top-6 left-4 sm:left-6 right-4 sm:right-6 z-20 flex flex-wrap items-center justify-between pointer-events-none gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-4 pointer-events-auto">
          <button
            onClick={() => navigate('/')}
            className="p-3 sm:p-4 rounded-xl border border-white/5 bg-[#0E1524]/90 backdrop-blur-md flex items-center gap-2 font-mono text-xs font-medium text-white hover:border-white/10 transition-colors"
          >
            <ArrowLeft size={16} strokeWidth={1.5} className="text-slate-400" />
            <span className="hidden sm:inline">BACK TO FULL MAP</span>
            <span className="sm:hidden">MAP</span>
          </button>

          <div className="p-3 sm:p-4 rounded-xl border border-white/5 bg-[#0E1524]/90 backdrop-blur-md flex items-center gap-3 sm:gap-6">
            <div className="flex items-center gap-2">
              <Train size={16} strokeWidth={1.5} className="text-slate-400" />
              <span className="font-mono text-xs font-bold text-white uppercase">
                TRAIN {trainShortId}
              </span>
              <span className="font-mono text-[9px] text-[#00A896] uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 border border-white/5 hidden sm:inline-block">
                LIVE TRACKING
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
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-4 pointer-events-auto">
          <button
            onClick={handleRecenter}
            className={`p-3 sm:p-4 rounded-xl border flex items-center gap-2 font-mono text-xs transition-colors backdrop-blur-md ${
              isLockedOnTrain
                ? 'border-white/20 bg-white/10 text-white font-bold'
                : 'border-white/5 bg-[#0E1524]/90 text-slate-400 hover:text-white hover:border-white/10'
            }`}
          >
            <Crosshair size={16} strokeWidth={1.5} className="text-current" />
            <span className="hidden sm:inline">
              {isLockedOnTrain ? 'LOCKED ON TRAIN' : 'LOCK ON TRAIN'}
            </span>
          </button>

          <button
            onClick={handleCopyShareLink}
            className="p-3 sm:p-4 rounded-xl border border-white/5 bg-[#0E1524]/90 hover:border-white/10 text-slate-400 hover:text-white transition-colors font-mono text-xs flex items-center gap-2 backdrop-blur-md"
          >
            <Share2 size={16} strokeWidth={1.5} className="text-current" />
            <span className="hidden sm:inline">
              {copiedLink ? 'LINK COPIED' : 'SHARE'}
            </span>
          </button>
        </div>
      </header>

      {/* Floating Bento Focus Drawer / Mobile Swipeable Bottom Sheet */}
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
        animate={{ y: isDrawerExpanded ? 0 : isMobile ? 'calc(100% - 60px)' : 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 sm:absolute sm:bottom-6 sm:left-6 sm:right-auto sm:w-[480px] z-30 pointer-events-auto overscroll-y-contain"
      >
        {trains.length === 0 ? (
          /* Connecting to Telemetry / Awaiting initial payload */
          <div className="p-6 rounded-t-3xl sm:rounded-2xl border border-white/5 bg-[#0E1524]/95 backdrop-blur-md flex flex-col items-center justify-center gap-4 text-center min-h-[180px]">
            <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-semibold">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping" />
              <span>CONNECTING TO TELEMETRY...</span>
            </div>
            <p className="font-mono text-xs text-slate-400 max-w-xs">
              Awaiting real-time dispatch signals for Train {trainShortId}
            </p>
          </div>
        ) : train ? (
          <div className="p-6 rounded-t-3xl sm:rounded-2xl border border-white/5 bg-[#0E1524]/95 backdrop-blur-md flex flex-col gap-4 sm:gap-6 max-h-[82vh] sm:max-h-[78vh] overflow-hidden">
            {/* Mobile Swipe Grab Bar Indicator */}
            <div
              onClick={() => setIsDrawerExpanded(!isDrawerExpanded)}
              className="w-12 h-1.5 rounded-full bg-white/20 mx-auto cursor-grab active:cursor-grabbing sm:hidden"
            />

            {/* Mobile Drawer Header Toggle */}
            <div
              onClick={() => setIsDrawerExpanded(!isDrawerExpanded)}
              className="flex items-center justify-between cursor-pointer border-b border-white/5 pb-3 select-none sm:hidden"
            >
              <div className="flex items-center gap-3">
                <Train size={16} strokeWidth={1.5} className="text-slate-400" />
                <span className="font-mono text-xs font-bold text-white uppercase">
                  TRAIN {trainShortId}
                </span>
                <span className="font-mono text-[9px] text-[#00A896] uppercase px-2 py-0.5 rounded bg-white/5 border border-white/5">
                  {train.speed} KM/H
                </span>
              </div>
              <button className="text-slate-400 hover:text-white p-1">
                {isDrawerExpanded ? <ChevronDown size={18} strokeWidth={1.5} /> : <ChevronUp size={18} strokeWidth={1.5} />}
              </button>
            </div>

            {/* Train Overview Bento Section */}
            <div className="p-4 rounded-xl border border-white/5 bg-[#0B0F19]/60 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Train size={18} strokeWidth={1.5} className="text-slate-400" />
                  <span className="font-mono text-sm font-bold text-white">
                    TRAIN {trainShortId}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-slate-400 tracking-wider uppercase">
                    {train.directionId === 0 ? 'TOWARDS SOUTH' : 'TOWARDS NORTH'}
                  </span>
                  <span className="font-mono text-[10px] text-[#00A896] px-2 py-0.5 rounded bg-white/5 border border-white/5 uppercase">
                    ON SCHEDULE
                  </span>
                </div>
              </div>

              {/* Corridor Progress Bar */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between font-mono text-xs text-slate-300">
                  <span>FROM {train.origin.toUpperCase()}</span>
                  <span className="text-slate-500">
                    {Math.round(train.progress || 0)}% TRIP
                  </span>
                  <span>TO {train.destination.toUpperCase()}</span>
                </div>
                <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#00A896] transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(2, train.progress || 0))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Telemetry Metrics Grid - Responsive: 1 col on small mobile, 2 col on sm/md */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Speed Bento Card */}
              <div className="p-4 rounded-xl border border-white/5 bg-[#0B0F19]/60 flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-mono text-[10px] tracking-wider uppercase">
                    SPEED
                  </span>
                  <Gauge size={16} strokeWidth={1.5} className="text-slate-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-2xl font-bold text-white">
                    {train.speed}
                  </span>
                  <span className="font-mono text-xs text-slate-500">KM/H</span>
                </div>
                <span className="font-mono text-[10px] text-slate-400">
                  {train.isDwelling ? 'STOPPED AT PLATFORM' : 'ON THE MOVE'}
                </span>
              </div>

              {/* Next Station Bento Card */}
              <div className="p-4 rounded-xl border border-white/5 bg-[#0B0F19]/60 flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-mono text-[10px] tracking-wider uppercase">
                    NEXT STATION
                  </span>
                  <MapPin size={18} strokeWidth={1.5} className="text-slate-400" />
                </div>
                <div className="font-mono text-sm font-bold text-white truncate">
                  {train.nextStation.toUpperCase()}
                </div>
                <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 pt-1 border-t border-white/5">
                  <span>ARRIVING IN</span>
                  <span className="text-white font-medium flex items-center gap-1.5">
                    {train.etaSeconds == null ? (
                      <>
                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping" />
                        <span>ESTIMATING</span>
                      </>
                    ) : train.etaSeconds <= 0 ? (
                      'ARRIVING NOW'
                    ) : (
                      `${Math.floor(train.etaSeconds / 60)}M ${train.etaSeconds % 60}S`
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between font-mono text-[10px] text-slate-500">
                  <span>DISTANCE</span>
                  <span>{train.distanceToNextMeters} METERS</span>
                </div>
              </div>
            </div>

            {/* Station Progression Sequence */}
            <div className="p-4 rounded-xl border border-white/5 bg-[#0B0F19]/60 flex flex-col gap-4 overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="font-mono text-xs font-semibold text-white tracking-wider uppercase">
                  STATIONS ON ROUTE
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  {passedCount} / {progressionStations.length} COMPLETED
                </span>
              </div>

              <div className="flex flex-col gap-2 max-h-44 sm:max-h-52 overflow-y-auto pr-1">
                {progressionStations.map((st) => (
                  <div
                    key={st.id}
                    className={`flex items-center justify-between py-1 font-mono text-xs transition-colors ${
                      st.isNext
                        ? 'p-2 rounded-lg bg-white/5 border border-white/10 text-white font-bold'
                        : st.isPassed
                        ? 'text-slate-500 line-through'
                        : 'text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {st.isPassed ? (
                        <div className="w-2 h-2 rounded-full bg-slate-700 flex items-center justify-center">
                          <Check size={10} strokeWidth={2} className="text-slate-400" />
                        </div>
                      ) : st.isNext ? (
                        <div className="w-2.5 h-2.5 rounded-full bg-white ring-2 ring-[#00A896]" />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                      )}
                      <span>{st.name.toUpperCase()}</span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-slate-600">{st.id}</span>
                      {st.isNext && (
                        <span className="text-[#00A896] uppercase font-bold">
                          NEXT STATION
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Train Inactive Bento Card */
          <div className="p-6 sm:p-8 rounded-t-3xl sm:rounded-2xl border border-white/5 bg-[#0E1524]/95 backdrop-blur-md text-center flex flex-col items-center gap-4">
            <Train size={24} strokeWidth={1.5} className="text-slate-400" />
            <div className="flex flex-col gap-1">
              <h3 className="font-mono text-sm font-bold text-white uppercase">
                TRAIN {trainShortId} INACTIVE
              </h3>
              <p className="font-mono text-xs text-slate-400 max-w-xs">
                This train is currently not in active service or outside operating hours.
              </p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-mono text-xs font-semibold transition-colors flex items-center gap-2"
            >
              <ArrowLeft size={16} strokeWidth={1.5} className="text-current" />
              <span>BACK TO FULL MAP</span>
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
