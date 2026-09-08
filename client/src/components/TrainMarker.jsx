import React, { useEffect, useState, useMemo } from 'react';
import { Marker } from 'react-map-gl/maplibre';
import { motion, useSpring } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export function TrainMarker({
  train,
  isSelected = false,
  isRecommended = false,
  onSelect,
  theme,
}) {
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

  // Direction classification:
  // directionId === 1 or '-N' => Towards Aluva (Northbound)
  // directionId === 0 or '-S' => Towards Thripunithura (Southbound)
  const isNorthbound =
    train.directionId === 1 ||
    train.id.includes('-N') ||
    (train.destination && train.destination.toLowerCase().includes('aluva'));

  const directionLabel = isNorthbound ? 'ALUVA' : 'THRIPUNITHURA';
  const directionGlyph = isNorthbound ? '▲' : '▼';

  // Visual style definitions based on state and direction
  const visualConfig = useMemo(() => {
    if (isRecommended) {
      // High-priority Swiss Signal Red for recommended journey train
      return {
        id: 'recommended',
        bodyGrad: ['#FF2E5B', '#BE123C'],
        strokeColor: '#FFFFFF',
        strokeWidth: 1.6,
        glowFilter: 'drop-shadow(0 0 10px rgba(225, 29, 72, 0.95))',
        beamGradient: 'linear-gradient(to top, rgba(225, 29, 72, 0.6), rgba(225, 29, 72, 0))',
        badgeColor: '#FB7185',
        pingClass: 'bg-rose-500/40',
      };
    }

    if (isSelected) {
      return {
        id: 'selected',
        bodyGrad: ['#38BDF8', '#0284C7'],
        strokeColor: '#FFFFFF',
        strokeWidth: 2,
        glowFilter: 'drop-shadow(0 0 12px rgba(56, 189, 248, 0.9))',
        beamGradient: 'linear-gradient(to top, rgba(56, 189, 248, 0.6), rgba(56, 189, 248, 0))',
        badgeColor: '#38BDF8',
        pingClass: null,
      };
    }

    if (isNorthbound) {
      // Northbound (Towards Aluva): Ice Aurora Sky Blue
      return {
        id: 'northbound',
        bodyGrad: ['#38BDF8', '#0284C7'],
        strokeColor: '#7DD3FC',
        strokeWidth: 1.1,
        glowFilter: 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.6))',
        beamGradient: 'linear-gradient(to top, rgba(56, 189, 248, 0.45), rgba(56, 189, 248, 0))',
        badgeColor: '#38BDF8',
        pingClass: null,
      };
    }

    // Southbound (Towards Thripunithura): Solar Amber / Electric Gold
    return {
      id: 'southbound',
      bodyGrad: ['#F59E0B', '#D97706'],
      strokeColor: '#FDE68A',
      strokeWidth: 1.1,
      glowFilter: 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.6))',
      beamGradient: 'linear-gradient(to top, rgba(245, 158, 11, 0.45), rgba(245, 158, 11, 0))',
      badgeColor: '#FBBF24',
      pingClass: null,
    };
  }, [isRecommended, isSelected, isNorthbound]);

  const gradientId = `train-grad-${train.id}`;

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
        {/* Recommended Train Pulsing Target Halo */}
        {isRecommended && visualConfig.pingClass && (
          <div
            className={`absolute -inset-3 rounded-full animate-ping pointer-events-none ${visualConfig.pingClass}`}
          />
        )}

        {/* Outer Rotated Coordinate Frame: Aligned to Track Heading */}
        <motion.div
          animate={{
            rotate: train.bearing || 0,
            scale: isSelected || isRecommended ? 1.25 : 1.0,
          }}
          transition={{ type: 'spring', stiffness: 120, damping: 15 }}
          className="relative flex items-center justify-center"
          style={{ transformOrigin: 'center center' }}
        >
          {/* 
            Dual-Track Parallel Lateral Offset (Option 2):
            In standard Indian Railways left-hand running, trains run on the left track.
            In the rotated local space where Forward is Up (-Y), Local Left is -X (-4.5px).
            - Northbound train (bearing 0°): local -4.5px X shifts 4.5px West.
            - Southbound train (bearing 180°): local -4.5px X in 180° rotation shifts 4.5px East.
            Result: Opposing trains run on separate parallel lines with 9px separation and zero collision!
          */}
          <div
            className="relative flex items-center justify-center"
            style={{ transform: 'translateX(-4.5px)' }}
          >
            {/* Luminous Forward Headlight Beam Cone (Option 1) */}
            <div
              className="absolute bottom-[calc(100%-6px)] left-1/2 -translate-x-1/2 pointer-events-none transition-opacity duration-300"
              style={{
                width: '24px',
                height: '28px',
                clipPath: 'polygon(32% 100%, 68% 100%, 100% 0%, 0% 0%)',
                background: visualConfig.beamGradient,
                opacity: train.isDwelling ? 0.25 : 0.85,
                filter: 'blur(1.2px)',
              }}
            />

            {/* Aero-Chevron Metro Silhouette Body */}
            <svg
              width="14"
              height="36"
              viewBox="0 0 14 36"
              className="overflow-visible transition-all duration-200"
              style={{ filter: visualConfig.glowFilter }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={visualConfig.bodyGrad[0]} />
                  <stop offset="100%" stopColor={visualConfig.bodyGrad[1]} />
                </linearGradient>
              </defs>

              {/* Aerodynamic Tapered Carriage Hull */}
              <path
                d="M 7 1 
                   L 12.5 7 
                   L 12.5 32 
                   Q 12.5 34.5 10 34.5 
                   L 4 34.5 
                   Q 1.5 34.5 1.5 32 
                   L 1.5 7 
                   Z"
                fill={`url(#${gradientId})`}
                stroke={visualConfig.strokeColor}
                strokeWidth={visualConfig.strokeWidth}
                strokeLinejoin="round"
              />

              {/* Tinted Driver Windshield Visor */}
              <path
                d="M 3.5 7 
                   L 7 3.5 
                   L 10.5 7 
                   L 10.5 10 
                   L 3.5 10 
                   Z"
                fill="#070C15"
                opacity="0.9"
              />

              {/* Glass Specular Glare Line */}
              <line
                x1="4.5"
                y1="8"
                x2="9.5"
                y2="8"
                stroke="#FFFFFF"
                strokeWidth="0.6"
                opacity="0.55"
              />

              {/* Twin High-Intensity LED Headlights */}
              <circle
                cx="3.5"
                cy="6"
                r="1.1"
                fill="#FFFFFF"
                style={{ filter: 'drop-shadow(0 0 2px #FFFFFF)' }}
              />
              <circle
                cx="10.5"
                cy="6"
                r="1.1"
                fill="#FFFFFF"
                style={{ filter: 'drop-shadow(0 0 2px #FFFFFF)' }}
              />

              {/* Station Dwelling Status Pulse on Visor */}
              {train.isDwelling && (
                <circle
                  cx="7"
                  cy="7.5"
                  r="1.2"
                  fill="#F59E0B"
                  className="animate-pulse"
                />
              )}

              {/* Monospace Direction Glyph & Train Number */}
              <text
                x="7"
                y="19"
                textAnchor="middle"
                fontSize="6"
                fontWeight="900"
                fontFamily="monospace"
                fill="#FFFFFF"
                letterSpacing="-0.5px"
              >
                {directionGlyph}
              </text>
              <text
                x="7"
                y="27"
                textAnchor="middle"
                fontSize="6.2"
                fontWeight="900"
                fontFamily="monospace"
                fill="#FFFFFF"
                letterSpacing="-0.6px"
              >
                {trainShortId}
              </text>

              {/* Dual Ruby Rear Marker Tail-Lights */}
              <circle cx="3.8" cy="32.5" r="0.9" fill="#EF4444" />
              <circle cx="10.2" cy="32.5" r="0.9" fill="#EF4444" />
            </svg>
          </div>
        </motion.div>

        {/* Minimalist High-Precision Telemetry Hover Tooltip */}
        <div className="absolute -top-11 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-40">
          <div className="px-2.5 py-1.5 rounded-xl bg-[#090F1B]/95 border border-white/15 backdrop-blur-md text-[10px] font-mono shadow-2xl flex flex-col gap-0.5 whitespace-nowrap min-w-[130px]">
            {/* Header: Direction and Train ID */}
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1">
              <span
                className="font-bold flex items-center gap-1"
                style={{ color: visualConfig.badgeColor }}
              >
                <span>{directionGlyph}</span>
                <span>TRAIN {trainShortId}</span>
              </span>
              <span className="text-white font-medium text-[9px] px-1 py-0.2 rounded bg-white/10">
                ➔ {directionLabel}
              </span>
            </div>

            {/* Telemetry Status Line */}
            <div className="flex items-center gap-1.5 pt-0.5 text-[9px]">
              <span
                className={`font-semibold ${
                  train.isDwelling ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {train.isDwelling ? 'AT STATION (DWELLING)' : `${train.speed} KM/H`}
              </span>
              {train.nextStation && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-300 truncate max-w-[90px]">
                    Next: {train.nextStation}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Marker>
  );
}
