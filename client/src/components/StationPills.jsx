import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpDown, X } from 'lucide-react';

export function StationPills({
  originStation,
  destinationStation,
  onOpenPicker, // (mode: 'origin' | 'destination') => void
  onSwap,
  onClearDestination,
  theme,
}) {
  const [spinDeg, setSpinDeg] = useState(0);

  const handleSwapClick = (e) => {
    e.stopPropagation();
    setSpinDeg((prev) => prev + 180);
    if (onSwap) onSwap();
  };

  return (
    <div className="flex items-center gap-2 sm:gap-2.5 w-full">
      {/* Origin Pill */}
      <button
        type="button"
        onClick={() => onOpenPicker('origin')}
        className="flex-1 min-w-0 flex items-center gap-2.5 px-3.5 py-2.5 sm:py-3 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-white/10 hover:border-sky-400/50 shadow-sm transition-all text-left group"
      >
        <div className="w-2.5 h-2.5 rounded-full bg-sky-400 shrink-0 shadow-[0_0_8px_rgba(56,189,248,0.7)] group-hover:scale-110 transition-transform" />
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-slate-400">
            BOARDING
          </span>
          <span className="font-sans text-xs sm:text-sm font-bold text-white tracking-tight truncate">
            {originStation?.name || 'Select Origin'}
          </span>
        </div>
      </button>

      {/* Tactile 180° Invert / Swap Button */}
      <motion.button
        type="button"
        onClick={handleSwapClick}
        animate={{ rotate: spinDeg }}
        transition={{ type: 'spring', stiffness: 350, damping: 20 }}
        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-white/15 hover:border-white/30 flex items-center justify-center text-slate-300 hover:text-white shrink-0 shadow-md active:scale-95 transition-colors"
        title="Swap Origin and Destination"
      >
        <ArrowUpDown size={16} strokeWidth={2.2} />
      </motion.button>

      {/* Destination Pill */}
      <div className="flex-1 min-w-0 relative">
        <button
          type="button"
          onClick={() => onOpenPicker('destination')}
          className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 sm:py-3 rounded-2xl border shadow-sm transition-all text-left group ${
            destinationStation
              ? 'bg-rose-950/25 hover:bg-rose-950/40 border-rose-500/30 hover:border-rose-500/50'
              : 'bg-slate-800/80 hover:bg-slate-800 border-white/10 hover:border-white/20'
          }`}
        >
          <div
            className={`w-2.5 h-2.5 rounded-full shrink-0 transition-transform group-hover:scale-110 ${
              destinationStation
                ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]'
                : 'bg-slate-500'
            }`}
          />
          <div className="flex flex-col min-w-0 flex-1 pr-4">
            <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-slate-400">
              DESTINATION
            </span>
            <span
              className={`font-sans text-xs sm:text-sm font-bold tracking-tight truncate ${
                destinationStation ? 'text-rose-200' : 'text-slate-400'
              }`}
            >
              {destinationStation?.name || 'Choose Destination'}
            </span>
          </div>
        </button>

        {/* Clear destination mini button */}
        {destinationStation && onClearDestination && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClearDestination();
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            title="Clear Destination"
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
