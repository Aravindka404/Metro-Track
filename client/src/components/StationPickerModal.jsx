import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag, Ship, Plane, Train, Check } from 'lucide-react';
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
}) {
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

          {/* Modal Container */}
          <motion.div
            initial={{ y: '100%', opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full sm:max-w-lg bg-[#0E1626] border border-white/15 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] sm:max-h-[75vh] flex flex-col z-10"
          >
            {/* Header Area (No Search Bar to prevent mobile keyboard pop-up) */}
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#0E1626]">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-3 h-3 rounded-full ${
                    isDestination
                      ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                      : 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]'
                  }`}
                />
                <div>
                  <h3 className="font-sans text-base font-bold text-white tracking-tight">
                    {isDestination ? 'Select Destination' : 'Select Boarding Station'}
                  </h3>
                  <p className="font-sans text-xs text-slate-400">
                    Tap a station along Line 1 (Aluva ➔ Thripunithura)
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Stations Scroll List */}
            <div className="overflow-y-auto divide-y divide-white/5 p-2 sm:p-3 flex-1 overscroll-contain">
              {stations.map((station, idx) => {
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
                        : 'hover:bg-white/5 active:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Station sequence number */}
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

                    {/* Right Indicator / Status */}
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
              })}
            </div>

            {/* Footer */}
            <div className="p-3 bg-[#0A0F1A] border-t border-white/10 text-center font-sans text-[11px] text-slate-400">
              25 Stations • Direct Interchange Connections Available
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
