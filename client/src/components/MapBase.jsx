import React, { useRef, useMemo } from 'react';
import Map, { Source, Layer, NavigationControl, Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useStationContext } from '../context/useStationContext.jsx';
import { TrainMarker } from './TrainMarker.jsx';

// Corridor geographic bounds: [SW, NE]
const CORRIDOR_BOUNDS = [
  [76.25, 9.90],
  [76.40, 10.15],
];

const DEFAULT_CENTER = {
  longitude: 76.315,
  latitude: 10.025,
  zoom: 12.5,
};

// Pure schematic circuit style with Kochi water silhouettes & dark slate canvas
const CIRCUIT_STYLE = {
  version: 8,
  name: 'KMRL Schematic Circuit with Water Silhouettes',
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
        'background-color': '#0B0F19',
      },
    },
    {
      id: 'water-silhouette',
      type: 'fill',
      source: 'carto',
      'source-layer': 'water',
      paint: {
        'fill-color': '#07152B',
        'fill-opacity': 0.85,
      },
    },
    {
      id: 'water-boundary',
      type: 'line',
      source: 'carto',
      'source-layer': 'water',
      paint: {
        'line-color': '#0E284D',
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
        'line-color': '#0A1E38',
        'line-width': 1.4,
        'line-opacity': 0.6,
      },
    },
  ],
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
}) {
  const internalMapRef = useRef(null);
  const mapRef = externalMapRef || internalMapRef;
  const { trains, stations, tracksGeoJSON, activeStation, setActiveStation } = useStationContext();

  // Schematic Track Glow (wide blurred trace)
  const trackGlowLayer = useMemo(
    () => ({
      id: 'kmrl-track-glow',
      type: 'line',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#00A896',
        'line-width': 8,
        'line-opacity': 0.35,
        'line-blur': 4,
      },
    }),
    []
  );

  // Schematic Track Core (crisp vibrant trace)
  const trackCoreLayer = useMemo(
    () => ({
      id: 'kmrl-track-core',
      type: 'line',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#00A896',
        'line-width': 2.2,
        'line-opacity': 1,
      },
    }),
    []
  );

  // Active Journey Segment Slice (Origin to Destination)
  const highlightedRouteGeoJSON = useMemo(() => {
    if (
      !routeHighlight ||
      !routeHighlight.originId ||
      !routeHighlight.destinationId ||
      !tracksGeoJSON ||
      !stations ||
      stations.length === 0
    ) {
      return null;
    }

    const normOrigin = routeHighlight.originId.toUpperCase() === 'TRPN' ? 'TPHT' : routeHighlight.originId.toUpperCase();
    const normDest = routeHighlight.destinationId.toUpperCase() === 'TRPN' ? 'TPHT' : routeHighlight.destinationId.toUpperCase();

    const originStation = stations.find(
      (s) => s.id.toUpperCase() === normOrigin || s.id.toUpperCase() === routeHighlight.originId.toUpperCase()
    );
    const destStation = stations.find(
      (s) => s.id.toUpperCase() === normDest || s.id.toUpperCase() === routeHighlight.destinationId.toUpperCase()
    );

    if (!originStation || !destStation || !tracksGeoJSON.features || !tracksGeoJSON.features[0]) {
      return null;
    }

    const coords = tracksGeoJSON.features[0].geometry.coordinates;
    if (!coords || coords.length === 0) return null;

    const findClosestIdx = (pt) => {
      let minD = Infinity;
      let best = 0;
      for (let i = 0; i < coords.length; i++) {
        const c = coords[i];
        const d = (c[0] - pt[0]) ** 2 + (c[1] - pt[1]) ** 2;
        if (d < minD) {
          minD = d;
          best = i;
        }
      }
      return best;
    };

    const idxA = findClosestIdx([originStation.lon, originStation.lat]);
    const idxB = findClosestIdx([destStation.lon, destStation.lat]);
    const startIdx = Math.min(idxA, idxB);
    const endIdx = Math.max(idxA, idxB);

    const sliced = coords.slice(startIdx, endIdx + 1);
    if (sliced.length < 2) return null;

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: sliced,
          },
        },
      ],
    };
  }, [routeHighlight, tracksGeoJSON, stations]);

  const routeHighlightGlowLayer = useMemo(
    () => ({
      id: 'kmrl-route-highlight-glow',
      type: 'line',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#06B6D4',
        'line-width': 10,
        'line-opacity': 0.75,
        'line-blur': 4,
      },
    }),
    []
  );

  const routeHighlightCoreLayer = useMemo(
    () => ({
      id: 'kmrl-route-highlight-core',
      type: 'line',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#38BDF8',
        'line-width': 3.5,
        'line-opacity': 1,
      },
    }),
    []
  );

  return (
    <div className="w-full min-h-[100dvh] h-full relative overflow-hidden bg-[#0B0F19]">
      {/* Blueprint Precision Grid Overlay */}
      <div className="absolute inset-0 pointer-events-none blueprint-grid-overlay z-0 opacity-80" />

      {/* Subtle CAD Coordinate Markings */}
      <div className="absolute bottom-4 left-6 pointer-events-none z-10 hidden md:flex items-center gap-4 font-mono text-[9px] text-slate-600 tracking-widest uppercase select-none">
        <span>GRID: 32PX CAD</span>
        <span>•</span>
        <span>BOUNDS: [76.25°E, 9.90°N] — [76.40°E, 10.15°N]</span>
        <span>•</span>
        <span>DATUM: WGS84</span>
      </div>

      <Map
        ref={mapRef}
        {...(viewState || DEFAULT_CENTER)}
        padding={padding}
        onMove={(evt) => onViewStateChange && onViewStateChange(evt.viewState)}
        mapStyle={CIRCUIT_STYLE}
        pitch={0}
        bearing={0}
        dragRotate={false}
        touchPitch={false}
        maxPitch={0}
        minZoom={11}
        maxZoom={15.5}
        maxBounds={CORRIDOR_BOUNDS}
        attributionControl={false}
      >
        <NavigationControl position="bottom-right" showCompass={false} />

        {/* KMRL Track Circuit Trace */}
        {tracksGeoJSON && (
          <Source id="kmrl-tracks-source" type="geojson" data={tracksGeoJSON}>
            <Layer {...trackGlowLayer} />
            <Layer {...trackCoreLayer} />
          </Source>
        )}

        {/* Active Journey Route Highlight Trace */}
        {highlightedRouteGeoJSON && (
          <Source id="kmrl-highlighted-route-source" type="geojson" data={highlightedRouteGeoJSON}>
            <Layer {...routeHighlightGlowLayer} />
            <Layer {...routeHighlightCoreLayer} />
          </Source>
        )}

        {/* Stark White Station Nodes & Minimalist Schematic Labels */}
        {stations.map((st) => {
          const isActive = activeStation && activeStation.id === st.id;
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
                className="group relative cursor-pointer flex items-center justify-center select-none"
              >
                {/* Stark White Station Node */}
                <div
                  className={`rounded-full transition-transform duration-150 ${
                    isActive
                      ? 'w-2.5 h-2.5 bg-white ring-2 ring-[#00A896] ring-offset-2 ring-offset-[#0B0F19]'
                      : 'w-2 h-2 bg-white group-hover:scale-125'
                  }`}
                />

                {/* Precision Schematic Typography */}
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none whitespace-nowrap z-10">
                  <span
                    className={`font-mono text-[9px] tracking-wider uppercase transition-colors ${
                      isActive
                        ? 'text-white font-bold'
                        : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  >
                    {st.name}
                  </span>
                </div>
              </div>
            </Marker>
          );
        })}

        {/* Schematic Train Units */}
        {trains.map((train) => (
          <TrainMarker
            key={train.id}
            train={train}
            isSelected={selectedTrainId === train.id}
            isRecommended={recommendedTrainId === train.id}
            onSelect={onSelectTrain}
          />
        ))}

        {children}
      </Map>
    </div>
  );
}
