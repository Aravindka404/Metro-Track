import kochiStationsRaw from './kochiStations.json';
import kochiTracksRaw from './kochiTracks.json';
import bengaluruStationsRaw from './bengaluruStations.json';
import bengaluruTracksRaw from './bengaluruTracks.json';

function parseStations(geojson) {
  if (!geojson || !geojson.features) return [];
  return geojson.features.map((f) => ({
    id: f.properties.stop_id,
    name: f.properties.stop_name,
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    line: f.properties.line || 'default',
  }));
}

export const KOCHI_STATIONS = parseStations(kochiStationsRaw);
export const KOCHI_TRACKS = kochiTracksRaw;

export const BENGALURU_STATIONS = parseStations(bengaluruStationsRaw);
export const BENGALURU_TRACKS = bengaluruTracksRaw;

export function getCityStations(city) {
  return (city || '').toLowerCase() === 'bengaluru' ? BENGALURU_STATIONS : KOCHI_STATIONS;
}

export function getCityTracks(city) {
  return (city || '').toLowerCase() === 'bengaluru' ? BENGALURU_TRACKS : KOCHI_TRACKS;
}
