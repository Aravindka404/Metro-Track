import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, MapPin, Navigation, ShoppingBag, Ship, Plane, Train, Check } from 'lucide-react';
import { normalizeStationId } from '../utils/fareCalculator';

// Multi-modal interchange metadata for Kochi Metro
const INTERCHANGES = {
  ALVA: { icon: Plane, label: 'Airport Feeder Bus', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  EDAP: { icon: ShoppingBag, label: 'LuLu Mall Direct Skywalk', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  VYTL: { icon: Ship, label: 'Kochi Water Metro & Hub', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
  ERNS: { icon: Train, label: 'Indian Railways (South)', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  LSSE: { icon: Train, label: 'Indian Railways (Town / North)', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' },
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
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef(null);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Filter stations based on query
  const filteredStations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter(
      (st) =>
        st.name.toLowerCase().includes(q) ||
        st.id.toLowerCase().includes(q) ||
        normalizeStationId(st.id).toLowerCase().includes(q) ||
        INTERCHANGES[normalizeStationId(st.id)]?.label.toLowerCase().includes(q)
    );
  }, [stations, searchQuery]);

  const isDestination = mode === 'destination';
  const selectedStationId = isDestination ? destinationStation?.id : activeStation?.id;
  const otherStationId = isDestination ? activeStation?.id : destinationStation?.id;

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

          {/* Modal / Bottom Drawer Container */}
          <motion.div
            initial={{ y: '100%', opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full sm:max-w-lg bg-[#0E1626] border border-white/15 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] sm:max-h-[80vh] flex flex-col z-10"
          >
            {/* Header Area */}
            <div className="p-4 sm:p-5 border-b border-white/10 flex flex-col gap-3 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      isDestination ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' : 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]'
                    }`}
                  />
                  <h3 className="font-sans text-base font-bold text-white tracking-tight">
                    {isDestination ? 'Select Destination Station' : 'Select Boarding Station'}
                  </h3>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Instant Search Bar */}
              <div className="relative flex items-center">
                <Search size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search 25 stations (e.g. Aluva, Edapally, LuLu)..."
                  className="w-full bg-[#151F33] border border-white/15 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-sky-400 transition-colors font-sans"
                />
                {searchQuery.length > 0 && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 text-slate-400 hover:text-white p-1"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Stations Scroll List */}
            <div className="overflow-y-auto divide-y divide-white/5 p-2 sm:p-3 flex-1 overscroll-contain">
              {filteredStations.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-sans text-sm">
                  No station found matching "{searchQuery}"
                </div>
              ) : (
                filteredStations.map((station, idx) => {
                  const normId = normalizeStationId(station.id);
                  const interchange = INTERCHANGES[normId];
                  const isSelected = selectedStationId === station.id;
                  const isOther = otherStationId === station.id;

                  return (
                    <button
                      key={station.id}
                      onClick={() => {
                        onSelectStation(station, isDestination);
                        onClose();
                      }}
                      className={`w-full px-3.5 py-3 rounded-xl flex items-center justify-between text-left transition-all ${
                        isSelected
                          ? 'bg-sky-500/15 border border-sky-400/40'
                          : isOther
                          ? 'opacity-60 hover:opacity-100 hover:bg-white/5'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Station sequence badge */}
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                            isSelected
                              ? 'bg-sky-500 text-white shadow-[0_0_10px_rgba(14,165,233,0.5)]'
                              : 'bg-white/5 text-slate-400 border border-white/10'
                          }`}
                        >
                          {idx + 1}
                        </div>

                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-sans text-sm font-bold text-white tracking-tight truncate">
                              {station.name}
                            </span>
                            <span className="font-mono text-[10px] font-semibold text-slate-400 uppercase">
                              {station.id}
                            </span>
                          </div>

                          {/* Multi-modal interchange tag */}
                          {interchange && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${interchange.color}`}>
                                <interchange.icon size={10} strokeWidth={2.5} />
                                {interchange.label}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Indicator / Distance / Selection */}
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {isOther && (
                          <span className="text-[10px] font-semibold text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                            {isDestination ? 'Origin' : 'Dest'}
                          </span>
                        )}
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center text-white">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer Tip */}
            <div className="p-3 bg-[#0A0F1A] border-t border-white/10 text-center font-sans text-[11px] text-slate-400">
              Kochi Metro Line 1 Corridor • Aluva to Thripunithura (25 Stations)
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
