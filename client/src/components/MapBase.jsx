import React, { useRef, useMemo, useEffect } from 'react';
import Map, { Source, Layer, NavigationControl, Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useStationContext } from '../context/useStationContext.jsx';
import { TrainMarker } from './TrainMarker.jsx';

import { THEMES } from '../utils/themeConfig.js';

// Corridor geographic bounds: [SW, NE]
const CORRIDOR_BOUNDS = [
  [76.25, 9.90],
  [76.40, 10.15],
];

const DEFAULT_CENTER = {
  longitude: 76.315,
  latitude: 10.025,
  zoom: 11.6,
};

export function MapBase({
  viewState,
  onViewStateChange,
  children,
  selectedTrainId = null,
  recommendedTrainId = null,
  routeHighlight = null, // { originId, destinationId }
  onSelectTrain,
  onSelectStation,
  padding,
  mapRef: externalMapRef,
  theme = THEMES.dark,
}) {
  const internalMapRef = useRef(null);
  const mapRef = externalMapRef || internalMapRef;
  const { currentCity, cityConfig, trains, stations, tracksGeoJSON, activeStation, setActiveStation } = useStationContext();

  const activeTheme = theme || THEMES.dark;
  const activeBounds = cityConfig?.bounds || CORRIDOR_BOUNDS;
  const currentZoom = viewState?.zoom ?? 11.6;

  // Major transit hubs that always stay labeled to anchor the map
  const isMajorStation = useMemo(() => {
    const MAJOR_IDS = new Set([
      // Kochi major hubs & terminals
      'ALVA', 'EDAP', 'JLSD', 'MGRD', 'VYTA', 'TPHT', 'KLMT',
      // Bengaluru major hubs, terminals & interchanges
      'BLR-PUR-01', // Challaghatta
      'BLR-PUR-08', // Mysore Road
      'BLR-PUR-11', // Vijayanagar
      'BLR-MAJ-15', // Majestic Interchange
      'BLR-PUR-19', // MG Road
      'BLR-PUR-22', // Indiranagar
      'BLR-PUR-26', // KR Pura
      'BLR-PUR-37', // Whitefield (Kadugodi)
      'BLR-GRN-01', // Madavara (BIEC)
      'BLR-GRN-07', // Peenya Industry
      'BLR-GRN-10', // Yeshwantpur
      'BLR-GRN-20', // Lalbagh
      'BLR-GRN-24', // Banashankari
      'BLR-GRN-31', // Silk Institute
    ]);
    return (id) => Boolean(id && MAJOR_IDS.has(id.toUpperCase()));
  }, []);

  // Camera fly-to and bounds adjustment on city switch
  useEffect(() => {
    const map = mapRef.current?.getMap ? mapRef.current.getMap() : mapRef.current;
    if (map && cityConfig?.center) {
      try {
        if (typeof map.setMaxBounds === 'function') {
          map.setMaxBounds(null);
        }
        if (typeof map.flyTo === 'function') {
          map.flyTo({
            center: [cityConfig.center.longitude, cityConfig.center.latitude],
            zoom: cityConfig.center.zoom,
            essential: true,
            duration: 800,
          });
        }
        if (cityConfig.bounds && typeof map.setMaxBounds === 'function') {
          const timer = setTimeout(() => {
            try {
              map.setMaxBounds(cityConfig.bounds);
            } catch (e) {
              // ignore
            }
          }, 850);
          return () => clearTimeout(timer);
        }
      } catch (err) {
        console.warn('[MapBase] Error adjusting bounds/view:', err);
      }
    }
  }, [currentCity, cityConfig, mapRef]);

  // Dynamic schematic circuit style with Kochi water silhouettes adapting to theme
  const circuitStyle = useMemo(() => {
    const mapColors = activeTheme.map || THEMES.dark.map;
    return {
      version: 8,
      name: `${cityConfig?.headerTitle || 'Metro'} Schematic Circuit`,
      sources: {
        carto: {
          type: 'vector',
          url: 'https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/tiles.json',
        },
      },
      layers: [
        {
          id: 'circuit-background',
          type: 'background',
          paint: {
            'background-color': mapColors.bg,
          },
        },
        {
          id: 'water-silhouette',
          type: 'fill',
          source: 'carto',
          'source-layer': 'water',
          paint: {
            'fill-color': mapColors.waterFill,
            'fill-opacity': 0.85,
          },
        },
        {
          id: 'water-boundary',
          type: 'line',
          source: 'carto',
          'source-layer': 'water',
          paint: {
            'line-color': mapColors.waterLine,
            'line-width': 1,
            'line-opacity': 0.5,
          },
        },
        {
          id: 'waterway-silhouette',
          type: 'line',
          source: 'carto',
          'source-layer': 'waterway',
          paint: {
            'line-color': mapColors.waterLine,
            'line-width': 1.4,
            'line-opacity': 0.6,
          },
        },
      ],
    };
  }, [activeTheme, cityConfig]);

  // Schematic Track Glow (wide blurred trace)
  const trackGlowLayer = useMemo(
    () => ({
      id: `track-glow-${currentCity}`,
      type: 'line',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ['coalesce', ['get', 'color'], activeTheme.map?.trackGlow || '#00B4D8'],
        'line-width': 8,
        'line-opacity': 0.55,
        'line-blur': 4,
      },
    }),
    [activeTheme, currentCity]
  );

  // Schematic Track Core (crisp vibrant trace)
  const trackCoreLayer = useMemo(
    () => ({
      id: `track-core-${currentCity}`,
      type: 'line',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ['coalesce', ['get', 'color'], activeTheme.map?.trackCore || '#90E0EF'],
        'line-width': 3,
        'line-opacity': 0.95,
      },
    }),
    [activeTheme, currentCity]
  );

  // Precise highlight vector route between Origin and Destination (including multi-leg transfers)
  const highlightedRouteGeoJSON = useMemo(() => {
    if (!routeHighlight || !tracksGeoJSON || !stations.length) return null;
    const { originId, destinationId, isInterchange, interchangeId, leg1Line, leg2Line, routeLine } = routeHighlight;

    const normOrigin = originId?.toUpperCase() === 'TRPN' ? 'TPHT' : originId?.toUpperCase();
    const normDest = destinationId?.toUpperCase() === 'TRPN' ? 'TPHT' : destinationId?.toUpperCase();

    const originStation = stations.find(
      (s) => s.id.toUpperCase() === normOrigin || s.id.toUpperCase() === originId?.toUpperCase()
    );
    const destStation = stations.find(
      (s) => s.id.toUpperCase() === normDest || s.id.toUpperCase() === destinationId?.toUpperCase()
    );

    if (!originStation || !destStation || !tracksGeoJSON.features) {
      return null;
    }

    const segments = [];

    const sliceLeg = (fromStation, toStation, preferredLine) => {
      let bestFeat = null;
      let bestScore = Infinity;
      let bestStart = -1;
      let bestEnd = -1;

      for (const feat of tracksGeoJSON.features) {
        const coords = feat.geometry.coordinates;
        if (!coords || coords.length === 0) continue;
        const featLine = feat.properties?.line?.toLowerCase();

        // If a specific line is preferred, penalize non-matching tracks heavily
        const linePenalty = preferredLine && featLine && preferredLine !== featLine ? 1.0 : 0.0;

        const findClosest = (pt) => {
          let minD = Infinity;
          let best = -1;
          for (let i = 0; i < coords.length; i++) {
            const c = coords[i];
            const d = (c[0] - pt[0]) ** 2 + (c[1] - pt[1]) ** 2;
            if (d < minD) {
              minD = d;
              best = i;
            }
          }
          return { best, minD };
        };

        const matchA = findClosest([fromStation.lon, fromStation.lat]);
        const matchB = findClosest([toStation.lon, toStation.lat]);

        const score = matchA.minD + matchB.minD + linePenalty;

        if (matchA.minD < 0.04 && matchB.minD < 0.04 && score < bestScore) {
          bestScore = score;
          bestFeat = feat;
          bestStart = Math.min(matchA.best, matchB.best);
          bestEnd = Math.max(matchA.best, matchB.best);
        }
      }

      if (bestFeat && bestStart !== -1 && bestEnd !== -1) {
        const sliced = bestFeat.geometry.coordinates.slice(bestStart, bestEnd + 1);
        if (sliced.length >= 2) {
          segments.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: sliced,
            },
            properties: {
              line: bestFeat.properties?.line || 'default',
            },
          });
        }
      }
    };

    if (isInterchange && interchangeId) {
      const interchangeStation = stations.find(
        (s) => s.id.toUpperCase() === interchangeId.toUpperCase()
      );
      if (interchangeStation) {
        sliceLeg(originStation, interchangeStation, leg1Line);
        sliceLeg(interchangeStation, destStation, leg2Line);
      } else {
        sliceLeg(originStation, destStation, routeLine);
      }
    } else {
      sliceLeg(originStation, destStation, routeLine);
    }

    if (!segments.length) return null;

    return {
      type: 'FeatureCollection',
      features: segments,
    };
  }, [routeHighlight, tracksGeoJSON, stations]);

  const routeHighlightGlowLayer = useMemo(
    () => ({
      id: `route-highlight-glow-${currentCity}`,
      type: 'line',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': activeTheme.map?.routeHighlightGlow || '#E11D48',
        'line-width': 10,
        'line-opacity': 0.85,
        'line-blur': 4,
      },
    }),
    [activeTheme, currentCity]
  );

  const routeHighlightCoreLayer = useMemo(
    () => ({
      id: `route-highlight-core-${currentCity}`,
      type: 'line',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': activeTheme.map?.routeHighlightCore || '#FFFFFF',
        'line-width': 3.5,
        'line-opacity': 1,
      },
    }),
    [activeTheme, currentCity]
  );

  return (
    <div
      className="w-full min-h-[100dvh] h-full relative overflow-hidden transition-colors duration-300"
      style={{ backgroundColor: activeTheme.bgApp }}
    >
      {/* Blueprint Precision Grid Overlay */}
      <div className="absolute inset-0 pointer-events-none blueprint-grid-overlay z-0 opacity-80" />

      <Map
        ref={mapRef}
        {...(viewState || DEFAULT_CENTER)}
        padding={padding}
        onMove={(evt) => onViewStateChange && onViewStateChange(evt.viewState)}
        mapStyle={circuitStyle}
        pitch={0}
        bearing={0}
        dragRotate={false}
        touchPitch={false}
        maxPitch={0}
        minZoom={10.0}
        maxZoom={16}
        attributionControl={false}
      >
        <NavigationControl position="bottom-right" showCompass={false} />

        {/* Track Circuit Trace */}
        {tracksGeoJSON && tracksGeoJSON.features && (
          <Source
            key={`tracks-${currentCity}`}
            id={`tracks-source-${currentCity}`}
            type="geojson"
            data={tracksGeoJSON}
          >
            <Layer {...trackGlowLayer} />
            <Layer {...trackCoreLayer} />
          </Source>
        )}

        {/* Active Journey Route Highlight Trace */}
        {highlightedRouteGeoJSON && highlightedRouteGeoJSON.features && (
          <Source
            key={`route-${currentCity}`}
            id={`route-source-${currentCity}`}
            type="geojson"
            data={highlightedRouteGeoJSON}
          >
            <Layer {...routeHighlightGlowLayer} />
            <Layer {...routeHighlightCoreLayer} />
          </Source>
        )}

        {/* Stark White Station Nodes & Minimalist Schematic Labels */}
        {stations
          .filter((st) => typeof st?.lon === 'number' && typeof st?.lat === 'number')
          .map((st) => {
            const isActive = activeStation && activeStation.id === st.id;
            const normStId = st.id?.toUpperCase() === 'TRPN' ? 'TPHT' : st.id?.toUpperCase();
            const normOrigin = routeHighlight?.originId?.toUpperCase() === 'TRPN' ? 'TPHT' : routeHighlight?.originId?.toUpperCase();
            const normDest = routeHighlight?.destinationId?.toUpperCase() === 'TRPN' ? 'TPHT' : routeHighlight?.destinationId?.toUpperCase();

            const isOrigin = routeHighlight && (normStId === normOrigin);
            const isDest = routeHighlight && (normStId === normDest);
            const isTransferHub = Boolean(
              routeHighlight?.isInterchange &&
              routeHighlight?.interchangeId &&
              st.id.toUpperCase() === routeHighlight.interchangeId.toUpperCase()
            );

            const isBengaluru = currentCity === 'bengaluru';
            // Smart label visibility: major hubs, active/route stations are always labeled;
            // other stations reveal on tap, hover, or when zooming in close (>=13.4 in BLR)
            const showLabelByDefault =
              (isBengaluru ? currentZoom >= 13.4 : currentZoom >= 12.3) ||
              isActive ||
              isOrigin ||
              isDest ||
              isTransferHub ||
              isMajorStation(st.id);

            return (
              <Marker
                key={st.id}
                longitude={st.lon}
                latitude={st.lat}
                anchor="center"
              >
                <div
                  onClick={() => {
                    setActiveStation(st);
                    if (onSelectStation) onSelectStation(st);
                  }}
                  className="group relative cursor-pointer flex items-center justify-center select-none -m-3 p-3 min-w-[34px] min-h-[34px] touch-manipulation"
                  title={st.name}
                >
                  {/* Precision Schematic Station Node */}
                {(() => {
                  const ringOffsetClass = activeTheme.isLight ? 'ring-offset-[#F8FAFC]' : 'ring-offset-[#0B0F17]';
                  const isPurpleStation = st.line === 'purple';
                  const isGreenStation = st.line === 'green';
                  const isYellowStation = st.line === 'yellow';
                  const isInterchange = st.line === 'interchange';

                  let nodeClass = activeTheme.isLight
                    ? 'w-2.5 h-2.5 bg-slate-800 border border-slate-700/50 group-hover:scale-125'
                    : 'w-2.5 h-2.5 bg-white group-hover:scale-125';

                  if (isPurpleStation && !isActive && !isOrigin && !isDest) {
                    nodeClass = activeTheme.isLight
                      ? 'w-2.5 h-2.5 bg-[#9333EA] border border-[#7E22CE] group-hover:scale-125 shadow-xs'
                      : 'w-2.5 h-2.5 bg-[#C084FC] border border-[#A855F7] group-hover:scale-125 shadow-[0_0_6px_rgba(168,85,247,0.6)]';
                  } else if (isGreenStation && !isActive && !isOrigin && !isDest) {
                    nodeClass = activeTheme.isLight
                      ? 'w-2.5 h-2.5 bg-[#059669] border border-[#047857] group-hover:scale-125 shadow-xs'
                      : 'w-2.5 h-2.5 bg-[#34D399] border border-[#10B981] group-hover:scale-125 shadow-[0_0_6px_rgba(16,185,129,0.6)]';
                  } else if (isYellowStation && !isActive && !isOrigin && !isDest) {
                    nodeClass = activeTheme.isLight
                      ? 'w-2.5 h-2.5 bg-[#D97706] border border-[#B45309] group-hover:scale-125 shadow-xs'
                      : 'w-2.5 h-2.5 bg-[#FDE047] border border-[#FACC15] group-hover:scale-125 shadow-[0_0_6px_rgba(250,204,21,0.6)]';
                  }

                  if (isDest) {
                    nodeClass = activeTheme.isLight
                      ? `w-3.5 h-3.5 bg-[#E11D48] ring-2 ring-[#E11D48] ring-offset-2 ${ringOffsetClass} shadow-[0_0_12px_rgba(225,29,72,0.7)]`
                      : `w-3.5 h-3.5 bg-white ring-2 ring-[#E11D48] ring-offset-2 ${ringOffsetClass} shadow-[0_0_12px_rgba(225,29,72,0.9)]`;
                  } else if (isOrigin || isActive) {
                    nodeClass = activeTheme.isLight
                      ? `w-3.5 h-3.5 bg-[#0F766E] ring-2 ring-[#0F766E] ring-offset-2 ${ringOffsetClass} shadow-[0_0_12px_rgba(15,118,110,0.7)]`
                      : `w-3.5 h-3.5 bg-white ring-2 ring-[#38BDF8] ring-offset-2 ${ringOffsetClass} shadow-[0_0_12px_rgba(56,189,248,0.9)]`;
                  } else if (isTransferHub || isInterchange) {
                    nodeClass = activeTheme.isLight
                      ? `w-3.5 h-3.5 bg-amber-500 ring-2 ring-amber-500 ring-offset-2 ${ringOffsetClass} shadow-[0_0_12px_rgba(245,158,11,0.8)] animate-pulse`
                      : `w-3.5 h-3.5 bg-amber-400 ring-2 ring-amber-400 ring-offset-2 ${ringOffsetClass} shadow-[0_0_14px_rgba(251,191,36,0.9)] animate-pulse`;
                  }

                  return (
                    <div className={`rounded-full transition-transform duration-150 ${nodeClass}`} />
                  );
                })()}

                  {/* Precision Schematic Typography with De-crowding */}
                  <div
                    className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none whitespace-nowrap z-10 transition-all duration-150 ${
                      showLabelByDefault
                        ? 'opacity-100 scale-100'
                        : 'opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 group-hover:z-30'
                    }`}
                  >
                    <span
                      className={`font-sans text-[9px] sm:text-[10px] tracking-tight font-semibold transition-colors px-1.5 py-0.5 rounded-md backdrop-blur-xs ${
                        isTransferHub
                          ? activeTheme.isLight
                            ? 'text-amber-950 font-extrabold bg-amber-100 border border-amber-300 shadow-sm'
                            : 'text-amber-300 font-extrabold bg-amber-950/90 border border-amber-500/50 shadow-md'
                          : isActive || isOrigin || isDest
                          ? activeTheme.isLight
                            ? 'text-slate-900 font-extrabold bg-white/95 shadow-sm border border-slate-200'
                            : 'text-white font-extrabold bg-black/80 shadow-md border border-white/20'
                          : activeTheme.isLight
                          ? 'text-slate-700 group-hover:text-slate-950 bg-white/70 group-hover:bg-white/95 shadow-xs'
                          : 'text-slate-300 group-hover:text-white bg-[#0B0F17]/70 group-hover:bg-[#0E1626]/90 shadow-xs'
                      }`}
                    >
                      {isTransferHub ? `${st.name} 🔄 Interchange` : st.name}
                    </span>
                  </div>
                </div>
              </Marker>
            );
          })}

        {/* Schematic Train Units */}
        {trains
          .filter((t) => typeof t?.lng === 'number' && typeof t?.lat === 'number' && !isNaN(t.lng) && !isNaN(t.lat))
          .map((train) => (
            <TrainMarker
              key={train.id}
              train={train}
              isSelected={selectedTrainId === train.id}
              isRecommended={recommendedTrainId === train.id}
              onSelect={onSelectTrain}
              theme={activeTheme}
            />
          ))}

        {children}
      </Map>
    </div>
  );
}
