import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Search,
  Check,
  Repeat,
  Train,
  Plane,
  ShoppingBag,
  Ship,
} from 'lucide-react';
import {
  BENGALURU_PURPLE_IDS,
  BENGALURU_GREEN_IDS,
  BENGALURU_YELLOW_IDS,
  normalizeStationId,
} from '../utils/fareCalculator';

// Multi-modal interchange metadata for Kochi Metro
const KOCHI_INTERCHANGES = {
  ALVA: { icon: Plane, label: 'Airport Feeder Bus', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  EDAP: { icon: ShoppingBag, label: 'LuLu Mall Direct Skywalk', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  VYTL: { icon: Ship, label: 'Kochi Water Metro & Hub', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
  ERNS: { icon: Train, label: 'Indian Railways (South)', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  LSSE: { icon: Train, label: 'Indian Railways (Town / North)', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' },
};

// Rich interchange and hub metadata for Bengaluru Namma Metro
const BENGALURU_INTERCHANGES = {
  'BLR-MAJ-15': {
    isInterchange: true,
    lines: ['purple', 'green'],
    label: 'Majestic Interchange',
    transferDetails: 'Purple Line ⇄ Green Line',
    connections: 'KSR Bengaluru City Railway Station & BMTC Central Terminus',
    badgeClass: 'text-amber-400 bg-amber-500/10 border-amber-500/40',
    colorFrom: '#A855F7',
    colorTo: '#10B981',
  },
  'BLR-GRN-23': {
    isInterchange: true,
    lines: ['green', 'yellow'],
    label: 'RV Road Interchange',
    transferDetails: 'Green Line ⇄ Yellow Line',
    connections: 'Direct transfer to Electronics City Corridor',
    badgeClass: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/40',
    colorFrom: '#10B981',
    colorTo: '#EAB308',
  },
  'BLR-YEL-07': {
    isInterchange: true,
    lines: ['yellow', 'pink'],
    label: 'Jayadeva Interchange',
    transferDetails: 'Yellow Line ⇄ Pink Line (Upcoming)',
    connections: 'Multi-level elevated intersection',
    badgeClass: 'text-pink-400 bg-pink-500/10 border-pink-500/40',
    colorFrom: '#EAB308',
    colorTo: '#EC4899',
  },
  'BLR-PUR-14': {
    isInterchange: false,
    isRailway: true,
    lines: ['purple'],
    label: 'City Railway Station',
    transferDetails: 'Indian Railways (KSR Bengaluru)',
    connections: 'Direct Skywalk to Railway Platforms',
    badgeClass: 'text-blue-400 bg-blue-500/10 border-blue-500/40',
  },
  'BLR-GRN-12': {
    isInterchange: false,
    isRailway: true,
    lines: ['green'],
    label: 'Yeshwantpur Railway Station',
    transferDetails: 'Indian Railways (Yeshwantpur Junction)',
    connections: 'Direct Skywalk to YPR Railway Platforms',
    badgeClass: 'text-blue-400 bg-blue-500/10 border-blue-500/40',
  },
  'BLR-PUR-03': {
    isInterchange: false,
    isBusTerminal: true,
    lines: ['purple'],
    label: 'Kengeri Bus Terminal',
    transferDetails: 'KSRTC & BMTC Hub',
    connections: 'Intercity Mysore Road Bus Stand',
    badgeClass: 'text-orange-400 bg-orange-500/10 border-orange-500/40',
  },
};

export function StationPickerModal({
  isOpen,
  onClose,
  mode = 'origin', // 'origin' | 'destination'
  stations = [],
  activeStation = null,
  destinationStation = null,
  onSelectStation,
  theme,
  cityConfig,
}) {
  const isLight = theme?.isLight;
  const isDestination = mode === 'destination';
  const isBengaluru = cityConfig?.id === 'bengaluru';
  const selectedStationId = isDestination ? destinationStation?.id : activeStation?.id;
  const otherStationId = isDestination ? activeStation?.id : destinationStation?.id;

  // Search input state
  const [searchQuery, setSearchQuery] = useState('');

  // Option 1 Tab Filter ('all' | 'purple' | 'green' | 'yellow' | 'interchange')
  const [activeTab, setActiveTab] = useState('all');

  // Partition stations into official ordered lines
  const { purpleStations, greenStations, yellowStations, interchangeStations, allOrderedStations } =
    useMemo(() => {
      if (!isBengaluru) {
        return {
          purpleStations: [],
          greenStations: [],
          yellowStations: [],
          interchangeStations: [],
          allOrderedStations: stations,
        };
      }

      // Map stations by ID for instant O(1) lookup
      const byId = new Map(stations.map((s) => [s.id, s]));

      // 1. Purple Line ordered strictly from Challaghatta (0) to Whitefield (36)
      const purple = BENGALURU_PURPLE_IDS.map((id) => byId.get(id)).filter(Boolean);

      // 2. Green Line ordered strictly from Madavara (0) to Silk Institute (31)
      const green = BENGALURU_GREEN_IDS.map((id) => byId.get(id)).filter(Boolean);

      // 3. Yellow Line ordered strictly from RV Road (0) to Bommasandra (15)
      const yellow = BENGALURU_YELLOW_IDS.map((id) => byId.get(id)).filter(Boolean);

      // 4. Interchange Stations
      const interchangeIds = ['BLR-MAJ-15', 'BLR-GRN-23', 'BLR-YEL-07'];
      const interchanges = interchangeIds.map((id) => byId.get(id)).filter(Boolean);

      return {
        purpleStations: purple,
        greenStations: green,
        yellowStations: yellow,
        interchangeStations: interchanges,
        allOrderedStations: stations,
      };
    }, [stations, isBengaluru]);

  // Filter helper matching search query
  const matchesSearch = (station) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = station.name?.toLowerCase().includes(q);
    const idMatch = station.id?.toLowerCase().includes(q);
    const meta = BENGALURU_INTERCHANGES[station.id];
    const metaMatch =
      meta &&
      (meta.label?.toLowerCase().includes(q) ||
        meta.transferDetails?.toLowerCase().includes(q) ||
        meta.connections?.toLowerCase().includes(q));
    return nameMatch || idMatch || metaMatch;
  };

  // Filtered station groups
  const filteredPurple = useMemo(() => purpleStations.filter(matchesSearch), [purpleStations, searchQuery]);
  const filteredGreen = useMemo(() => greenStations.filter(matchesSearch), [greenStations, searchQuery]);
  const filteredYellow = useMemo(() => yellowStations.filter(matchesSearch), [yellowStations, searchQuery]);
  const filteredInterchanges = useMemo(
    () => interchangeStations.filter(matchesSearch),
    [interchangeStations, searchQuery]
  );
  const filteredAll = useMemo(() => allOrderedStations.filter(matchesSearch), [allOrderedStations, searchQuery]);

  // Dynamic stations for active tab
  const tabStations = useMemo(() => {
    if (!isBengaluru) return filteredAll;
    if (activeTab === 'purple') return filteredPurple;
    if (activeTab === 'green') return filteredGreen;
    if (activeTab === 'yellow') return filteredYellow;
    if (activeTab === 'interchange') return filteredInterchanges;
    return filteredAll;
  }, [activeTab, isBengaluru, filteredAll, filteredPurple, filteredGreen, filteredYellow, filteredInterchanges]);

  // Render individual station row button
  const renderStationRow = (station, seqIdx, lineTheme = 'default') => {
    const isSelected = selectedStationId === station.id;
    const isOther = otherStationId === station.id;
    const normId = normalizeStationId(station.id);
    const kochiMeta = !isBengaluru ? KOCHI_INTERCHANGES[normId] : null;
    const blrMeta = isBengaluru ? BENGALURU_INTERCHANGES[station.id] : null;

    // Line accent coloring for sequence badge
    let badgeBorderColor = isLight ? 'border-slate-200 text-slate-700 bg-slate-100' : 'border-white/10 text-slate-300 bg-white/5';
    let lineIndicatorTag = null;

    if (blrMeta?.isInterchange) {
      badgeBorderColor = 'border-amber-500/50 bg-amber-500/15 text-amber-300 font-extrabold shadow-[0_0_8px_rgba(245,158,11,0.25)]';
      lineIndicatorTag = (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md border text-amber-400 bg-amber-500/10 border-amber-500/30">
          <Repeat size={10} className="shrink-0" />
          {blrMeta.transferDetails}
        </span>
      );
    } else if (blrMeta?.isRailway) {
      badgeBorderColor = 'border-blue-500/50 bg-blue-500/15 text-blue-300';
      lineIndicatorTag = (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md border text-blue-400 bg-blue-500/10 border-blue-500/30">
          <Train size={10} className="shrink-0" />
          {blrMeta.transferDetails}
        </span>
      );
    } else if (blrMeta?.isBusTerminal) {
      badgeBorderColor = 'border-orange-500/50 bg-orange-500/15 text-orange-300';
      lineIndicatorTag = (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md border text-orange-400 bg-orange-500/10 border-orange-500/30">
          {blrMeta.transferDetails}
        </span>
      );
    } else if (lineTheme === 'purple' || station.line === 'purple') {
      badgeBorderColor = isLight
        ? 'border-purple-300 bg-purple-50 text-purple-700'
        : 'border-purple-500/30 bg-purple-500/10 text-purple-300';
      lineIndicatorTag = (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border text-purple-400 bg-purple-500/10 border-purple-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
          Purple Line
        </span>
      );
    } else if (lineTheme === 'green' || station.line === 'green') {
      badgeBorderColor = isLight
        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
      lineIndicatorTag = (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border text-emerald-400 bg-emerald-500/10 border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Green Line
        </span>
      );
    } else if (lineTheme === 'yellow' || station.line === 'yellow') {
      badgeBorderColor = isLight
        ? 'border-yellow-300 bg-yellow-50 text-yellow-800'
        : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300';
      lineIndicatorTag = (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border text-yellow-400 bg-yellow-500/10 border-yellow-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
          Yellow Line
        </span>
      );
    }

    return (
      <button
        key={`${station.id}-${lineTheme}`}
        type="button"
        onClick={() => {
          onSelectStation(station, isDestination);
          onClose();
        }}
        className={`w-full px-3.5 py-2.5 sm:py-3 rounded-xl flex items-center justify-between text-left transition-all ${
          isSelected
            ? isLight
              ? 'bg-teal-50 border border-teal-500/50 shadow-sm'
              : 'bg-sky-500/15 border border-sky-400/50 shadow-sm'
            : isOther
            ? isLight
              ? 'opacity-60 hover:opacity-100 hover:bg-slate-50'
              : 'opacity-60 hover:opacity-100 hover:bg-white/5'
            : isLight
            ? 'hover:bg-slate-50 active:bg-slate-100'
            : 'hover:bg-white/5 active:bg-white/10'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Station sequence badge */}
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-bold shrink-0 border ${
              isSelected
                ? isLight
                  ? 'bg-teal-600 text-white border-teal-600 shadow-[0_0_10px_rgba(15,118,110,0.4)]'
                  : 'bg-sky-500 text-white border-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]'
                : badgeBorderColor
            }`}
          >
            {seqIdx + 1}
          </div>

          <div className="flex flex-col min-w-0">
            <span
              className={`font-sans text-xs sm:text-sm font-bold tracking-tight truncate ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}
            >
              {station.name}
            </span>

            {/* Interchange or multi-modal line tag */}
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {kochiMeta ? (
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${kochiMeta.color}`}>
                  <kochiMeta.icon size={10} strokeWidth={2.5} />
                  {kochiMeta.label}
                </span>
              ) : (
                lineIndicatorTag
              )}

              {blrMeta?.connections && (
                <span className={`text-[10px] truncate max-w-[200px] sm:max-w-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  • {blrMeta.connections}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Indicator / Status */}
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {isOther && (
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                isLight
                  ? 'text-slate-600 bg-slate-100 border-slate-200'
                  : 'text-slate-400 bg-white/5 border-white/10'
              }`}
            >
              {isDestination ? 'Origin' : 'Dest'}
            </span>
          )}
          {isSelected && (
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-white ${
                isLight ? 'bg-teal-600' : 'bg-sky-500'
              }`}
            >
              <Check size={12} strokeWidth={3} />
            </div>
          )}
        </div>
      </button>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-auto">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ y: '100%', opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className={`relative w-full sm:max-w-2xl border rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] sm:max-h-[80vh] flex flex-col z-10 ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#0E1626] border-white/15'
            }`}
          >
            {/* Header Area */}
            <div
              className={`p-4 sm:p-5 border-b flex items-center justify-between shrink-0 ${
                isLight ? 'bg-white border-slate-100' : 'bg-[#0E1626] border-white/10'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                    isDestination
                      ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]'
                      : isLight
                      ? 'bg-teal-600 shadow-[0_0_10px_rgba(15,118,110,0.6)]'
                      : 'bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.6)]'
                  }`}
                />
                <div>
                  <h3
                    className={`font-sans text-base font-bold tracking-tight ${
                      isLight ? 'text-slate-900' : 'text-white'
                    }`}
                  >
                    {isDestination ? 'Select Destination Station' : 'Select Boarding Station'}
                  </h3>
                  <p className={`font-sans text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    {isBengaluru
                      ? 'Choose from 83 stations across Purple, Green & Yellow lines'
                      : 'Choose from 25 stations along Line 1 (Aluva ➔ Tripunithura)'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className={`p-1.5 rounded-full transition-colors ${
                  isLight
                    ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
                title="Close Station Picker"
              >
                <X size={20} />
              </button>
            </div>

            {/* Instant Search Bar */}
            <div className={`px-4 py-2.5 border-b ${isLight ? 'bg-slate-50/60 border-slate-100' : 'bg-white/[0.02] border-white/10'}`}>
              <div
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all ${
                  isLight
                    ? 'bg-white border-slate-200 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20'
                    : 'bg-white/5 border-white/10 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-400/20'
                }`}
              >
                <Search size={16} className={`shrink-0 ${isLight ? 'text-slate-400' : 'text-slate-400'}`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    isBengaluru
                      ? 'Search station (e.g. Majestic, Indiranagar, Jayadeva, Whitefield)...'
                      : 'Search station (e.g. Aluva, Edapally, MG Road)...'
                  }
                  className={`w-full bg-transparent text-xs sm:text-sm font-sans font-medium outline-hidden ${
                    isLight ? 'text-slate-900 placeholder:text-slate-400' : 'text-white placeholder:text-slate-500'
                  }`}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1 rounded-full text-slate-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Segmented Line Filter Pills (Bengaluru Metro) */}
            {isBengaluru && (
              <div
                className={`px-3 py-2 border-b flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 ${
                  isLight ? 'bg-slate-50 border-slate-100' : 'bg-white/[0.01] border-white/5'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 border ${
                    activeTab === 'all'
                      ? isLight
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-950 border-white shadow-xs'
                      : isLight
                      ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  All ({filteredAll.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('purple')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 border flex items-center gap-1.5 ${
                    activeTab === 'purple'
                      ? 'bg-purple-600 text-white border-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.5)]'
                      : isLight
                      ? 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'
                      : 'bg-purple-950/30 border-purple-500/30 text-purple-300 hover:bg-purple-950/60'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  Purple Line ({filteredPurple.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('green')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 border flex items-center gap-1.5 ${
                    activeTab === 'green'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                      : isLight
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300 hover:bg-emerald-950/60'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Green Line ({filteredGreen.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('yellow')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 border flex items-center gap-1.5 ${
                    activeTab === 'yellow'
                      ? 'bg-yellow-500 text-slate-950 border-yellow-400 shadow-[0_0_12px_rgba(234,179,8,0.5)] font-black'
                      : isLight
                      ? 'bg-yellow-50 border-yellow-200 text-yellow-800 hover:bg-yellow-100'
                      : 'bg-yellow-950/30 border-yellow-500/30 text-yellow-300 hover:bg-yellow-950/60'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-yellow-400" />
                  Yellow Line ({filteredYellow.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('interchange')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 border flex items-center gap-1.5 ${
                    activeTab === 'interchange'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)] font-black'
                      : isLight
                      ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                      : 'bg-amber-950/30 border-amber-500/30 text-amber-300 hover:bg-amber-950/60'
                  }`}
                >
                  <Repeat size={11} strokeWidth={2.5} />
                  Interchanges ({filteredInterchanges.length})
                </button>
              </div>
            )}

            {/* Scrollable Station List */}
            <div
              className={`overflow-y-auto p-2 sm:p-3 flex-1 overscroll-contain ${
                isLight ? 'bg-white' : 'bg-[#0E1626]'
              }`}
            >
              <div className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-white/5'}`}>
                {tabStations.length > 0 ? (
                  tabStations.map((station, idx) =>
                    renderStationRow(
                      station,
                      idx,
                      activeTab === 'all' || activeTab === 'interchange' ? station.line : activeTab
                    )
                  )
                ) : (
                  <div className="py-12 text-center flex flex-col items-center justify-center gap-2">
                    <Search size={24} className="text-slate-400" />
                    <span className={`font-sans text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      No stations found matching "{searchQuery}"
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              className={`p-3 border-t text-center font-sans text-[11px] flex items-center justify-between px-4 ${
                isLight
                  ? 'bg-slate-50 border-slate-100 text-slate-500'
                  : 'bg-[#0A0F1A] border-white/10 text-slate-400'
              }`}
            >
              <span>
                {isBengaluru
                  ? `${stations.length} Total Stations • Purple, Green & Yellow lines`
                  : `${stations.length} Stations • Direct Feeder & Water Metro Connections`}
              </span>
              <span className={`font-sans text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                {tabStations.length} {tabStations.length === 1 ? 'station' : 'stations'} shown
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
