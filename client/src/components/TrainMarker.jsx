import React, { useEffect, useState } from 'react';
import { Marker } from 'react-map-gl/maplibre';
import { motion, useSpring } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export function TrainMarker({ train, isSelected = false, isRecommended = false, onSelect, theme }) {
  const navigate = useNavigate();

  // Mathematical spring interpolation for coordinates
  const springLon = useSpring(train.lng, { stiffness: 45, damping: 20 });
  const springLat = useSpring(train.lat, { stiffness: 45, damping: 20 });

  const [displayCoord, setDisplayCoord] = useState({
    lng: train.lng,
    lat: train.lat,
  });

  useEffect(() => {
    springLon.set(train.lng);
    springLat.set(train.lat);
  }, [train.lng, train.lat, springLon, springLat]);

  useEffect(() => {
    const unsubLon = springLon.on('change', (latestLon) => {
      setDisplayCoord((prev) => ({ ...prev, lng: latestLon }));
    });
    const unsubLat = springLat.on('change', (latestLat) => {
      setDisplayCoord((prev) => ({ ...prev, lat: latestLat }));
    });
    return () => {
      unsubLon();
      unsubLat();
    };
  }, [springLon, springLat]);

  const handleClick = (e) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(train);
    } else {
      navigate(`/train/${train.id}`);
    }
  };

  const trainShortId = train.id.replace('KMRL-', '');

  let capsuleClass = 'bg-[#0284C7] border border-white/25 text-white hover:border-white/60';
  let pingClass = 'bg-rose-500/40';

  if (isRecommended) {
    // Swiss Signal Red for the recommended train on the selected route
    capsuleClass = 'bg-[#E11D48] ring-2 ring-white shadow-[0_0_14px_rgba(225,29,72,0.9)] text-white font-extrabold';
    pingClass = 'bg-rose-500/40';
  } else if (isSelected) {
    capsuleClass = 'bg-[#38BDF8] ring-2 ring-white text-[#0B0F17] font-extrabold shadow-[0_0_10px_rgba(56,189,248,0.8)]';
  } else {
    capsuleClass = 'bg-[#0369A1] border border-white/20 text-white hover:border-white/50';
  }

  return (
    <Marker
      longitude={displayCoord.lng}
      latitude={displayCoord.lat}
      anchor="center"
    >
      <div
        onClick={handleClick}
        className="group relative flex items-center justify-center cursor-pointer select-none"
      >
        {/* Recommended Train Target Indicator */}
        {isRecommended && (
          <div className={`absolute -inset-1.5 rounded-full animate-ping pointer-events-none ${pingClass}`} />
        )}

        {/* Schematic Circuit Unit Marker */}
        <motion.div
          animate={{
            rotate: train.bearing || 0,
            scale: isSelected || isRecommended ? 1.25 : 1.0,
          }}
          transition={{ type: 'spring', stiffness: 120, damping: 15 }}
          className="relative flex items-center justify-center"
        >
          <div
            className={`w-8 h-3.5 rounded-full flex items-center justify-between px-1 transition-all ${capsuleClass}`}
          >
            <div className="w-1 h-1 rounded-full bg-white" />
            <span className="font-mono text-[7px] font-bold tracking-tighter">
              {trainShortId}
            </span>
            <div className="w-0.5 h-0.5 rounded-full bg-black/40" />
          </div>
        </motion.div>

        {/* Minimalist Schematic Hover Tooltip */}
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-30">
          <div className="px-2 py-1 rounded bg-[#0E1524] border border-white/10 text-[9px] font-mono text-white tracking-wider whitespace-nowrap flex items-center gap-1.5">
            <span>TRAIN {trainShortId}</span>
            <span className="text-slate-500">•</span>
            <span className={train.isDwelling ? 'text-slate-400' : 'text-[#00A896]'}>
              {train.isDwelling ? 'AT STATION' : `${train.speed} KM/H`}
            </span>
          </div>
        </div>
      </div>
    </Marker>
  );
}
