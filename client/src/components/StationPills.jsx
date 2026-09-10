import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpDown, ChevronDown } from 'lucide-react';

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

  const isLight = theme?.isLight;

  return (
    <div className="flex items-center gap-2 sm:gap-2.5 w-full">
      {/* Origin Pill */}
      <button
        type="button"
        onClick={() => onOpenPicker('origin')}
        className={`flex-1 min-w-0 flex items-center justify-between px-3.5 py-2 sm:py-2.5 rounded-2xl border shadow-sm transition-all text-left group ${
          isLight
            ? 'bg-slate-50 hover:bg-slate-100/90 border-slate-200/90 hover:border-emerald-500/50'
            : 'bg-slate-800/80 hover:bg-slate-800 border-white/10 hover:border-emerald-400/50'
        }`}
      >
        <div className="flex flex-col items-start min-w-0 flex-1 pr-1.5">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full shrink-0 group-hover:scale-110 transition-transform ${
                isLight
                  ? 'bg-emerald-600 shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                  : 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
              }`}
            />
            <span
              className={`font-sans text-[10px] font-bold uppercase tracking-wider ${
                isLight ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              BOARDING
            </span>
          </div>
          <span
            className={`font-sans text-xs sm:text-sm font-bold tracking-tight truncate w-full mt-0.5 ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}
          >
            {originStation?.name || 'Select Origin'}
          </span>
        </div>

        <ChevronDown
          size={15}
          strokeWidth={2.2}
          className={`shrink-0 transition-transform duration-200 group-hover:translate-y-0.5 ${
            isLight ? 'text-slate-400 group-hover:text-slate-600' : 'text-slate-500 group-hover:text-slate-300'
          }`}
        />
      </button>

      {/* Tactile 180° Invert / Swap Button */}
      <motion.button
        type="button"
        onClick={handleSwapClick}
        animate={{ rotate: spinDeg }}
        transition={{ type: 'spring', stiffness: 350, damping: 20 }}
        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border flex items-center justify-center shrink-0 shadow-sm active:scale-95 transition-colors ${
          isLight
            ? 'bg-white hover:bg-slate-100 border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 shadow-slate-200'
            : 'bg-slate-800/90 hover:bg-slate-700 border-white/15 hover:border-white/30 text-slate-300 hover:text-white'
        }`}
        title="Swap Origin and Destination"
      >
        <ArrowUpDown size={16} strokeWidth={2.2} />
      </motion.button>

      {/* Destination Pill */}
      <button
        type="button"
        onClick={() => onOpenPicker('destination')}
        className={`flex-1 min-w-0 flex items-center justify-between px-3.5 py-2 sm:py-2.5 rounded-2xl border shadow-sm transition-all text-left group ${
          destinationStation
            ? isLight
              ? 'bg-rose-50/90 hover:bg-rose-100/90 border-rose-200 hover:border-rose-300'
              : 'bg-rose-950/25 hover:bg-rose-950/40 border-rose-500/30 hover:border-rose-500/50'
            : isLight
            ? 'bg-slate-50 hover:bg-slate-100/90 border-slate-200/90 hover:border-slate-300'
            : 'bg-slate-800/80 hover:bg-slate-800 border-white/10 hover:border-white/20'
        }`}
      >
        <div className="flex flex-col items-start min-w-0 flex-1 pr-1.5">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full shrink-0 transition-transform group-hover:scale-110 ${
                destinationStation
                  ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]'
                  : isLight
                  ? 'bg-slate-300'
                  : 'bg-slate-500'
              }`}
            />
            <span
              className={`font-sans text-[10px] font-bold uppercase tracking-wider ${
                isLight ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              DESTINATION
            </span>
          </div>
          <span
            className={`font-sans text-xs sm:text-sm font-bold tracking-tight truncate w-full mt-0.5 ${
              destinationStation
                ? isLight
                  ? 'text-rose-700'
                  : 'text-rose-200'
                : isLight
                ? 'text-slate-500'
                : 'text-slate-400'
            }`}
          >
            {destinationStation?.name || 'Choose Destination'}
          </span>
        </div>

        <ChevronDown
          size={15}
          strokeWidth={2.2}
          className={`shrink-0 transition-transform duration-200 group-hover:translate-y-0.5 ${
            destinationStation
              ? isLight
                ? 'text-rose-400 group-hover:text-rose-600'
                : 'text-rose-400/80 group-hover:text-rose-300'
              : isLight
              ? 'text-slate-400 group-hover:text-slate-600'
              : 'text-slate-500 group-hover:text-slate-300'
          }`}
        />
      </button>
    </div>
  );
}
