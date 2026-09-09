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
  Moon,
  Sun,
} from 'lucide-react';
import { MapBase } from '../components/MapBase.jsx';
import { useStationContext } from '../context/useStationContext.jsx';
import { THEMES, getStoredTheme, saveTheme } from '../utils/themeConfig.js';

export function FocusView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { trains, stations, istTime } = useStationContext();

  const [themeKey, setThemeKey] = useState(getStoredTheme);
  const currentTheme = THEMES[themeKey] || THEMES.dark;
  const isLight = currentTheme.isLight;

  const toggleTheme = () => {
    const nextTheme = themeKey === 'light' ? 'dark' : 'light';
    setThemeKey(nextTheme);
    saveTheme(nextTheme);
  };

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
    if (!id || !trains.length) return null;
    const cleanId = id.toLowerCase().replace('kmrl-', '');
    return trains.find((t) => {
      const tClean = (t.id || '').toLowerCase().replace('kmrl-', '');
      return tClean === cleanId || (t.id || '').toLowerCase() === id.toLowerCase();
    });
  }, [trains, id]);

  const trainShortId = train ? train.id.replace('KMRL-', '') : (id ? id.replace('KMRL-', '') : '');

  const isNorthbound = useMemo(() => {
    if (!train) return false;
    return (
      train.directionId === 1 ||
      train.direction === 1 ||
      (train.id && train.id.includes('-N')) ||
      (train.destination && train.destination.toLowerCase().includes('aluva'))
    );
  }, [train]);

  const [viewState, setViewState] = useState({
    longitude: 76.315,
    latitude: 10.025,
    zoom: 14,
  });

  const [isLockedOnTrain, setIsLockedOnTrain] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  // Smooth camera lock-on
  useEffect(() => {
    if (train && isLockedOnTrain && typeof train.lng === 'number' && typeof train.lat === 'number') {
      setViewState((prev) => ({
        ...prev,
        longitude: train.lng,
        latitude: train.lat,
        zoom: 14,
      }));
    }
  }, [train?.lng, train?.lat, isLockedOnTrain]);

  useEffect(() => {
    if (train && typeof train.lng === 'number' && typeof train.lat === 'number') {
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

    const ordered = isNorthbound ? [...stations].reverse() : [...stations];

    if (!train) return ordered.map((s) => ({ ...s, state: 'upcoming' }));

    const nextStationName = (train.nextStation || '').toLowerCase();
    const nextStationId = train.nextStationId || '';

    const nextIdx = ordered.findIndex(
      (s) =>
        (nextStationId && s.id === nextStationId) ||
        (nextStationName && s.name && s.name.toLowerCase() === nextStationName)
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
  }, [stations, train, isNorthbound]);

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
    <div
      className="w-full min-h-[100dvh] h-[100dvh] relative overflow-hidden font-sans select-none overscroll-y-contain transition-colors duration-300"
      style={{ backgroundColor: currentTheme.bgApp }}
    >
      {/* Pure Circuit Schematic Map */}
      <MapBase
        viewState={viewState}
        onViewStateChange={(newView) => {
          setViewState(newView);
        }}
        padding={mapPadding}
        selectedTrainId={train?.id}
        onSelectTrain={(t) => navigate(`/train/${t.id}`)}
        theme={currentTheme}
      />

      {/* Top Header Information Bar */}
      <header className="absolute top-4 sm:top-6 left-4 sm:left-6 right-4 sm:right-6 z-20 flex flex-wrap items-center justify-between pointer-events-none gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-4 pointer-events-auto">
          <button
            onClick={() => navigate('/')}
            className={`p-3 sm:p-4 rounded-xl border backdrop-blur-md flex items-center gap-2 font-mono text-xs font-medium transition-all ${
              isLight
                ? 'border-slate-200 bg-white/95 text-slate-800 hover:text-slate-950 hover:bg-slate-50 shadow-md'
                : 'border-white/5 bg-[#0E1524]/90 text-white hover:border-white/10'
            }`}
          >
            <ArrowLeft size={16} strokeWidth={1.5} className={isLight ? 'text-slate-600' : 'text-slate-400'} />
            <span className="hidden sm:inline">BACK TO FULL MAP</span>
            <span className="sm:hidden">MAP</span>
          </button>

          <div
            className={`p-3 sm:p-4 rounded-xl border backdrop-blur-md flex items-center gap-3 sm:gap-6 ${
              isLight
                ? 'border-slate-200 bg-white/95 text-slate-900 shadow-md'
                : 'border-white/5 bg-[#0E1524]/90 text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Train size={16} strokeWidth={1.5} className={isLight ? 'text-teal-700' : 'text-slate-400'} />
              <span className={`font-mono text-xs font-bold uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>
                TRAIN {trainShortId}
              </span>
              <span
                className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border hidden sm:inline-block ${
                  isLight
                    ? 'text-teal-800 bg-teal-50 border-teal-200 font-bold'
                    : 'text-[#00A896] bg-white/5 border-white/5'
                }`}
              >
                LIVE TRACKING
              </span>
            </div>

            <div className={`h-4 w-[1px] ${isLight ? 'bg-slate-200' : 'bg-white/10'} hidden sm:block`} />

            <div className={`hidden sm:flex items-center gap-2 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              <Clock size={16} strokeWidth={1.5} className="text-current" />
              <span className={`font-mono text-xs font-medium ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {istTime || '--:--:--'} IST
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto">
          <button
            onClick={handleRecenter}
            className={`p-3 sm:p-4 rounded-xl border flex items-center gap-2 font-mono text-xs transition-colors backdrop-blur-md shadow-md ${
              isLockedOnTrain
                ? isLight
                  ? 'border-teal-500 bg-teal-50 text-teal-800 font-bold'
                  : 'border-white/20 bg-white/10 text-white font-bold'
                : isLight
                ? 'border-slate-200 bg-white/95 text-slate-700 hover:text-slate-950 hover:bg-slate-50'
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
            className={`p-3 sm:p-4 rounded-xl border transition-colors font-mono text-xs flex items-center gap-2 backdrop-blur-md shadow-md ${
              isLight
                ? 'border-slate-200 bg-white/95 hover:bg-slate-50 text-slate-700 hover:text-slate-950'
                : 'border-white/5 bg-[#0E1524]/90 hover:border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            <Share2 size={16} strokeWidth={1.5} className="text-current" />
            <span className="hidden sm:inline">
              {copiedLink ? 'LINK COPIED' : 'SHARE'}
            </span>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className={`p-3 sm:p-4 rounded-xl border transition-colors font-mono text-xs flex items-center gap-2 backdrop-blur-md shadow-md active:scale-95 ${
              isLight
                ? 'border-slate-200 bg-white/95 text-amber-500 hover:text-amber-600 hover:bg-slate-50'
                : 'border-white/5 bg-[#0E1524]/90 text-sky-400 hover:text-sky-300'
            }`}
            title={`Switch to ${isLight ? 'Dark' : 'Light'} Mode`}
          >
            {isLight ? <Moon size={16} strokeWidth={2} /> : <Sun size={16} strokeWidth={2} />}
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
          <div
            className={`p-6 rounded-t-3xl sm:rounded-2xl border backdrop-blur-md flex flex-col items-center justify-center gap-4 text-center min-h-[180px] ${
              isLight ? 'border-slate-200 bg-white/95 text-slate-900 shadow-2xl' : 'border-white/5 bg-[#0E1524]/95 text-white'
            }`}
          >
            <div className={`flex items-center gap-2 font-mono text-xs font-semibold ${isLight ? 'text-teal-600' : 'text-cyan-400'}`}>
              <div className={`w-2 h-2 rounded-full animate-ping ${isLight ? 'bg-teal-600' : 'bg-cyan-400'}`} />
              <span>CONNECTING TO TELEMETRY...</span>
            </div>
            <p className={`font-mono text-xs max-w-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Awaiting real-time dispatch signals for Train {trainShortId}
            </p>
          </div>
        ) : train ? (
          <div
            className={`p-6 rounded-t-3xl sm:rounded-2xl border backdrop-blur-md flex flex-col gap-4 sm:gap-6 max-h-[82vh] sm:max-h-[78vh] overflow-hidden ${
              isLight ? 'border-slate-200 bg-white/95 text-slate-900 shadow-2xl' : 'border-white/5 bg-[#0E1524]/95 text-white'
            }`}
          >
            {/* Mobile Swipe Grab Bar Indicator */}
            <div
              onClick={() => setIsDrawerExpanded(!isDrawerExpanded)}
              className={`w-12 h-1.5 rounded-full mx-auto cursor-grab active:cursor-grabbing sm:hidden ${
                isLight ? 'bg-slate-300' : 'bg-white/20'
              }`}
            />

            {/* Mobile Drawer Header Toggle */}
            <div
              onClick={() => setIsDrawerExpanded(!isDrawerExpanded)}
              className={`flex items-center justify-between cursor-pointer border-b pb-3 select-none sm:hidden ${
                isLight ? 'border-slate-200' : 'border-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <Train size={16} strokeWidth={1.5} className={isLight ? 'text-teal-700' : 'text-slate-400'} />
                <span className={`font-mono text-xs font-bold uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  TRAIN {trainShortId}
                </span>
                <span
                  className={`font-mono text-[9px] uppercase px-2 py-0.5 rounded border ${
                    isLight ? 'text-teal-800 bg-teal-50 border-teal-200 font-bold' : 'text-[#00A896] bg-white/5 border-white/5'
                  }`}
                >
                  {train.speed} KM/H
                </span>
              </div>
              <button className={`p-1 ${isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-white'}`}>
                {isDrawerExpanded ? <ChevronDown size={18} strokeWidth={1.5} /> : <ChevronUp size={18} strokeWidth={1.5} />}
              </button>
            </div>

            {/* Train Overview Bento Section */}
            <div
              className={`p-4 rounded-xl border flex flex-col gap-4 ${
                isLight ? 'border-slate-200 bg-slate-50/80 text-slate-900' : 'border-white/5 bg-[#0B0F19]/60 text-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Train size={18} strokeWidth={1.5} className={isLight ? 'text-teal-700' : 'text-slate-400'} />
                  <span className={`font-mono text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    TRAIN {trainShortId}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`font-mono text-[10px] tracking-wider uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    {isNorthbound ? 'TOWARDS NORTH' : 'TOWARDS SOUTH'}
                  </span>
                  <span
                    className={`font-mono text-[10px] px-2 py-0.5 rounded border uppercase ${
                      isLight ? 'text-teal-800 bg-teal-50 border-teal-200 font-bold' : 'text-[#00A896] bg-white/5 border-white/5'
                    }`}
                  >
                    ON SCHEDULE
                  </span>
                </div>
              </div>

              {/* Corridor Progress Bar */}
              <div className="flex flex-col gap-2">
                <div className={`flex items-center justify-between font-mono text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  <span>FROM {(train.origin || 'Aluva').toUpperCase()}</span>
                  <span className={isLight ? 'text-slate-400' : 'text-slate-500'}>
                    {Math.round(train.progress || 0)}% TRIP
                  </span>
                  <span>TO {(train.destination || 'Thripunithura').toUpperCase()}</span>
                </div>
                <div className={`w-full h-1 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-white/5'}`}>
                  <div
                    className={`h-full transition-all duration-300 ${isLight ? 'bg-teal-600' : 'bg-[#00A896]'}`}
                    style={{ width: `${Math.min(100, Math.max(2, train.progress || 0))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Telemetry Metrics Grid - Responsive: 1 col on small mobile, 2 col on sm/md */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Speed Bento Card */}
              <div
                className={`p-4 rounded-xl border flex flex-col justify-between gap-2 ${
                  isLight ? 'border-slate-200 bg-slate-50/80 text-slate-900' : 'border-white/5 bg-[#0B0F19]/60 text-white'
                }`}
              >
                <div className={`flex items-center justify-between ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  <span className="font-mono text-[10px] tracking-wider uppercase">
                    SPEED
                  </span>
                  <Gauge size={16} strokeWidth={1.5} className="text-current" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`font-mono text-2xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {train.speed ?? 0}
                  </span>
                  <span className={`font-mono text-xs ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>KM/H</span>
                </div>
                <span className={`font-mono text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  {train.isDwelling ? 'STOPPED AT PLATFORM' : 'ON THE MOVE'}
                </span>
              </div>

              {/* Next Station Bento Card */}
              <div
                className={`p-4 rounded-xl border flex flex-col justify-between gap-2 ${
                  isLight ? 'border-slate-200 bg-slate-50/80 text-slate-900' : 'border-white/5 bg-[#0B0F19]/60 text-white'
                }`}
              >
                <div className={`flex items-center justify-between ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  <span className="font-mono text-[10px] tracking-wider uppercase">
                    NEXT STATION
                  </span>
                  <MapPin size={18} strokeWidth={1.5} className="text-current" />
                </div>
                <div className={`font-mono text-sm font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {(train.nextStation || train.nextStationId || 'Next Stop').toUpperCase()}
                </div>
                <div
                  className={`flex items-center justify-between font-mono text-[10px] pt-1 border-t ${
                    isLight ? 'border-slate-200 text-slate-500' : 'border-white/5 text-slate-400'
                  }`}
                >
                  <span>ARRIVING IN</span>
                  <span className={`font-medium flex items-center gap-1.5 ${isLight ? 'text-teal-700 font-bold' : 'text-white'}`}>
                    {train.etaSeconds == null ? (
                      <>
                        <div className={`w-2 h-2 rounded-full animate-ping ${isLight ? 'bg-teal-600' : 'bg-cyan-400'}`} />
                        <span>ESTIMATING</span>
                      </>
                    ) : train.etaSeconds <= 0 ? (
                      'ARRIVING NOW'
                    ) : (
                      `${Math.floor(train.etaSeconds / 60)}M ${train.etaSeconds % 60}S`
                    )}
                  </span>
                </div>
                <div className={`flex items-center justify-between font-mono text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  <span>DISTANCE</span>
                  <span>{train.distanceToNextMeters} METERS</span>
                </div>
              </div>
            </div>

            {/* Station Progression Sequence */}
            <div
              className={`p-4 rounded-xl border flex flex-col gap-4 overflow-hidden ${
                isLight ? 'border-slate-200 bg-slate-50/80 text-slate-900' : 'border-white/5 bg-[#0B0F19]/60 text-white'
              }`}
            >
              <div className={`flex items-center justify-between border-b pb-2 ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
                <span className={`font-mono text-xs font-semibold tracking-wider uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  STATIONS ON ROUTE
                </span>
                <span className={`font-mono text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  {passedCount} / {progressionStations.length} COMPLETED
                </span>
              </div>

              <div className="flex flex-col gap-2 max-h-44 sm:max-h-52 overflow-y-auto pr-1">
                {progressionStations.map((st) => (
                  <div
                    key={st.id}
                    className={`flex items-center justify-between py-1 font-mono text-xs transition-colors ${
                      st.isNext
                        ? isLight
                          ? 'p-2 rounded-lg bg-teal-50 border border-teal-200 text-teal-900 font-bold shadow-xs'
                          : 'p-2 rounded-lg bg-white/5 border border-white/10 text-white font-bold'
                        : st.isPassed
                        ? isLight
                          ? 'text-slate-400 line-through'
                          : 'text-slate-500 line-through'
                        : isLight
                        ? 'text-slate-600'
                        : 'text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {st.isPassed ? (
                        <div
                          className={`w-2 h-2 rounded-full flex items-center justify-center ${
                            isLight ? 'bg-slate-200 text-slate-500' : 'bg-slate-700 text-slate-400'
                          }`}
                        >
                          <Check size={10} strokeWidth={2} />
                        </div>
                      ) : st.isNext ? (
                        <div
                          className={`w-2.5 h-2.5 rounded-full ring-2 ${
                            isLight ? 'bg-teal-600 ring-teal-600' : 'bg-white ring-[#00A896]'
                          }`}
                        />
                      ) : (
                        <div className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-slate-300' : 'bg-slate-800'}`} />
                      )}
                      <span>{st.name.toUpperCase()}</span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px]">
                      <span className={isLight ? 'text-slate-400' : 'text-slate-600'}>{st.id}</span>
                      {st.isNext && (
                        <span className={`uppercase font-bold ${isLight ? 'text-teal-700' : 'text-[#00A896]'}`}>
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
          <div
            className={`p-6 sm:p-8 rounded-t-3xl sm:rounded-2xl border backdrop-blur-md text-center flex flex-col items-center gap-4 ${
              isLight ? 'border-slate-200 bg-white/95 text-slate-900 shadow-2xl' : 'border-white/5 bg-[#0E1524]/95 text-white'
            }`}
          >
            <Train size={24} strokeWidth={1.5} className={isLight ? 'text-slate-500' : 'text-slate-400'} />
            <div className="flex flex-col gap-1">
              <h3 className={`font-mono text-sm font-bold uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>
                TRAIN {trainShortId} INACTIVE
              </h3>
              <p className={`font-mono text-xs max-w-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                This train is currently not in active service or outside operating hours.
              </p>
            </div>
            <button
              onClick={() => navigate('/')}
              className={`p-4 rounded-xl border font-mono text-xs font-semibold transition-colors flex items-center gap-2 ${
                isLight
                  ? 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 shadow-sm'
                  : 'border-white/10 bg-white/5 hover:bg-white/10 text-white'
              }`}
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
