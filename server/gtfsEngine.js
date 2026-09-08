import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const GTFS_DIR = path.join(DATA_DIR, 'gtfs');

// Haversine / Bearing Helpers
function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

export function calculateBearing(lat1, lon1, lat2, lon2) {
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const y = Math.sin(dLon) * Math.cos(rLat2);
  const x =
    Math.cos(rLat1) * Math.sin(rLat2) -
    Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLon);

  let brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

function parseTimeToSec(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':').map(Number);
  return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
}

export class GTFSEngine {
  constructor() {
    this.stops = new Map();
    this.shapes = new Map();
    this.trips = new Map();
    this.stopTimesByTrip = new Map();
    this.isLoaded = false;
  }

  load() {
    console.log('[GTFSEngine] Loading GTFS files from:', GTFS_DIR);

    // 1. Stops
    const stopsContent = fs.readFileSync(path.join(GTFS_DIR, 'stops.txt'), 'utf8');
    const stopLines = stopsContent.split(/\r?\n/);
    for (let i = 1; i < stopLines.length; i++) {
      const line = stopLines[i].trim();
      if (!line) continue;
      const [stop_id, stop_lat, stop_lon, stop_name] = line.split(',');
      this.stops.set(stop_id, {
        id: stop_id,
        lat: parseFloat(stop_lat),
        lon: parseFloat(stop_lon),
        name: stop_name,
      });
    }
    console.log(`[GTFSEngine] Loaded ${this.stops.size} stations`);

    // 2. Shapes
    const shapesContent = fs.readFileSync(path.join(GTFS_DIR, 'shapes.txt'), 'utf8');
    const shapeLines = shapesContent.split(/\r?\n/);
    for (let i = 1; i < shapeLines.length; i++) {
      const line = shapeLines[i].trim();
      if (!line) continue;
      const [shape_id, shape_pt_sequence, shape_pt_lat, shape_pt_lon, shape_dist_traveled] = line.split(',');
      if (!this.shapes.has(shape_id)) {
        this.shapes.set(shape_id, []);
      }
      this.shapes.get(shape_id).push({
        seq: parseInt(shape_pt_sequence, 10),
        lat: parseFloat(shape_pt_lat),
        lon: parseFloat(shape_pt_lon),
        dist: parseFloat(shape_dist_traveled || 0),
      });
    }
    for (const [sid, pts] of this.shapes.entries()) {
      pts.sort((a, b) => a.seq - b.seq);
    }
    console.log(`[GTFSEngine] Loaded ${this.shapes.size} shape tracks`);

    // 3. Trips
    const tripsContent = fs.readFileSync(path.join(GTFS_DIR, 'trips.txt'), 'utf8');
    const tripLines = tripsContent.split(/\r?\n/);
    for (let i = 1; i < tripLines.length; i++) {
      const line = tripLines[i].trim();
      if (!line) continue;
      const [route_id, service_id, trip_id, direction_id, shape_id] = line.split(',');
      this.trips.set(trip_id, {
        route_id,
        service_id,
        trip_id,
        direction_id: parseInt(direction_id, 10),
        shape_id,
      });
    }
    console.log(`[GTFSEngine] Loaded ${this.trips.size} trips`);

    // 4. Stop Times
    const stContent = fs.readFileSync(path.join(GTFS_DIR, 'stop_times.txt'), 'utf8');
    const stLines = stContent.split(/\r?\n/);
    for (let i = 1; i < stLines.length; i++) {
      const line = stLines[i].trim();
      if (!line) continue;
      const [trip_id, stop_sequence, stop_id, arrival_time, departure_time, , shape_dist_traveled] = line.split(',');
      if (!this.stopTimesByTrip.has(trip_id)) {
        this.stopTimesByTrip.set(trip_id, []);
      }
      this.stopTimesByTrip.get(trip_id).push({
        seq: parseInt(stop_sequence, 10),
        stop_id,
        arr_time: arrival_time,
        dep_time: departure_time,
        arr_sec: parseTimeToSec(arrival_time),
        dep_sec: parseTimeToSec(departure_time),
        dist: parseFloat(shape_dist_traveled || 0),
      });
    }

    for (const [tid, times] of this.stopTimesByTrip.entries()) {
      times.sort((a, b) => a.seq - b.seq);
    }
    console.log(`[GTFSEngine] Loaded stop times for ${this.stopTimesByTrip.size} trips`);
    this.isLoaded = true;
  }

  interpolatePositionAlongShape(shapeId, targetDist) {
    const points = this.shapes.get(shapeId);
    if (!points || points.length === 0) return null;

    if (targetDist <= points[0].dist) {
      const p1 = points[0];
      const p2 = points[1] || points[0];
      return {
        lat: p1.lat,
        lon: p1.lon,
        bearing: calculateBearing(p1.lat, p1.lon, p2.lat, p2.lon),
      };
    }

    const last = points[points.length - 1];
    if (targetDist >= last.dist) {
      const p1 = points[points.length - 2] || points[points.length - 1];
      const p2 = points[points.length - 1];
      return {
        lat: p2.lat,
        lon: p2.lon,
        bearing: calculateBearing(p1.lat, p1.lon, p2.lat, p2.lon),
      };
    }

    // Find the bounding segment
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      if (targetDist >= p1.dist && targetDist <= p2.dist) {
        const segLen = p2.dist - p1.dist;
        const ratio = segLen > 0 ? (targetDist - p1.dist) / segLen : 0;
        const lat = p1.lat + ratio * (p2.lat - p1.lat);
        const lon = p1.lon + ratio * (p2.lon - p1.lon);
        const bearing = calculateBearing(p1.lat, p1.lon, p2.lat, p2.lon);
        return { lat, lon, bearing };
      }
    }

    return { lat: last.lat, lon: last.lon, bearing: 0 };
  }

  /**
   * Get all active trains at current time.
   * If current time is outside operating hours (23:00 - 06:00 IST),
   * provides a smooth loop of midday schedules so trains are always visible.
   */
  getActiveTrains(simulatedSeconds = null) {
    if (!this.isLoaded) return [];

    let currentSec;
    if (simulatedSeconds !== null) {
      currentSec = simulatedSeconds;
    } else {
      // Calculate IST time in seconds from midnight
      const now = new Date();
      const istTimeStr = now.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
      });
      const [hh, mm, ss] = istTimeStr.split(':').map(Number);
      currentSec = hh * 3600 + mm * 60 + ss;
    }

    // Operational hours check: Kochi Metro runs ~06:00 to 22:30 IST.
    // If outside operating window, wrap to a peak hour (e.g. 10:00 to 14:00) so client can test and view trains
    let effectiveSec = currentSec;
    let isSimulatedClock = false;
    if (currentSec < 6 * 3600 || currentSec > 22.5 * 3600) {
      isSimulatedClock = true;
      // Map night time into a lively 4-hour window from 09:30 AM to 13:30 PM
      effectiveSec = 9.5 * 3600 + (currentSec % (4 * 3600));
    }

    const activeTrains = [];

    for (const [tripId, stList] of this.stopTimesByTrip.entries()) {
      if (!stList || stList.length < 2) continue;

      const trip = this.trips.get(tripId);
      if (!trip) continue;

      // Filter by current day of week (WK = Mon-Sat, WE = Sun)
      const now = new Date();
      const istDay = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        weekday: 'short',
      }).format(now);
      const isSunday = istDay === 'Sun';
      const expectedService = isSunday ? 'WE' : 'WK';
      if (trip.service_id !== expectedService) continue;

      const tripStart = stList[0].dep_sec;
      const tripEnd = stList[stList.length - 1].arr_sec;

      // Check if trip is currently active
      if (effectiveSec >= tripStart && effectiveSec <= tripEnd) {
        // Find which stop segment the train is currently on
        let curStop = null;
        let nextStop = null;
        let currentDist = 0;
        let speedKmH = 0;
        let isDwelling = false;

        let curStopIdx = 0;
        for (let i = 0; i < stList.length; i++) {
          const s = stList[i];

          // Check if train is currently stopped at station i
          if (effectiveSec >= s.arr_sec && effectiveSec <= s.dep_sec) {
            isDwelling = true;
            curStop = s;
            nextStop = stList[i + 1] || s;
            curStopIdx = i + 1;
            currentDist = s.dist;
            speedKmH = 0;
            break;
          }

          // Check if train is running between station i and i+1
          if (i < stList.length - 1) {
            const nextS = stList[i + 1];
            if (effectiveSec > s.dep_sec && effectiveSec < nextS.arr_sec) {
              curStop = s;
              nextStop = nextS;
              curStopIdx = i + 1;
              const durationSec = nextS.arr_sec - s.dep_sec;
              const elapsedSec = effectiveSec - s.dep_sec;
              const ratio = durationSec > 0 ? elapsedSec / durationSec : 0;
              const segDist = nextS.dist - s.dist;
              currentDist = s.dist + ratio * segDist;

              // Speed in km/h
              if (durationSec > 0) {
                speedKmH = (segDist / (durationSec / 3600));
                // Add realistic micro-variation: smooth acceleration/deceleration
                const bellCurve = Math.sin(ratio * Math.PI);
                speedKmH = Math.min(75, Math.max(25, speedKmH * 0.8 + 15 * bellCurve));
              }
              break;
            }
          }
        }

        if (curStop && nextStop) {
          const pos = this.interpolatePositionAlongShape(trip.shape_id, currentDist);
          if (pos) {
            const originStop = this.stops.get(stList[0].stop_id);
            const destStop = this.stops.get(stList[stList.length - 1].stop_id);
            const targetStopInfo = this.stops.get(nextStop.stop_id);

            const distRemainingKm = Math.max(0, nextStop.dist - currentDist);
            const distRemainingMeters = Math.round(distRemainingKm * 1000);
            const etaSeconds = Math.max(0, nextStop.arr_sec - effectiveSec);

            const trainNumber = tripId.replace(/^(WK_|WE_)/, '');
            const trainCode = `KMRL-${trip.direction_id === 0 ? 'S' : 'N'}${trainNumber.padStart(2, '0')}`;

            const remainingStops = stList.slice(curStopIdx).map((s) => ({
              stopId: s.stop_id,
              stopName: this.stops.get(s.stop_id)?.name || s.stop_id,
              etaSeconds: Math.max(0, s.arr_sec - effectiveSec),
              distanceMeters: Math.max(0, Math.round((s.dist - currentDist) * 1000)),
            }));

            activeTrains.push({
              id: trainCode,
              tripId: trip.trip_id,
              directionId: trip.direction_id,
              origin: originStop ? originStop.name : 'Aluva',
              destination: destStop ? destStop.name : 'Tripunithura',
              lat: parseFloat(pos.lat.toFixed(6)),
              lng: parseFloat(pos.lon.toFixed(6)),
              altitude: 14.5, // Viaduct height above ground
              bearing: Math.round(pos.bearing),
              speed: Math.round(speedKmH),
              isDwelling,
              nextStation: targetStopInfo ? targetStopInfo.name : nextStop.stop_id,
              nextStationId: nextStop.stop_id,
              distanceToNextMeters: distRemainingMeters,
              etaSeconds,
              remainingStops,
              status: 'On Time',
              progress: parseFloat(((currentDist / stList[stList.length - 1].dist) * 100).toFixed(1)),
            });
          }
        }
      }
    }

    return {
      timestamp: new Date().toISOString(),
      istTime: new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false }),
      isSimulatedClock,
      activeTrainsCount: activeTrains.length,
      trains: activeTrains,
    };
  }

  getScheduledDepartures(originId, destId = null, timeStr = null, limit = 4) {
    if (!this.isLoaded || !originId) return [];

    const normOrigin = originId.toUpperCase() === 'TRPN' ? 'TPHT' : originId.toUpperCase();
    const normDest = destId ? (destId.toUpperCase() === 'TRPN' ? 'TPHT' : destId.toUpperCase()) : null;

    let targetSec;
    if (timeStr && timeStr.includes(':')) {
      const [hh, mm] = timeStr.split(':').map(Number);
      targetSec = hh * 3600 + mm * 60;
    } else {
      const now = new Date();
      const istTimeStr = now.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
      });
      const [hh, mm, ss] = istTimeStr.split(':').map(Number);
      targetSec = hh * 3600 + mm * 60 + ss;
    }

    if (targetSec < 6 * 3600 || targetSec > 22.5 * 3600) {
      targetSec = 9.5 * 3600 + (targetSec % (4 * 3600));
    }

    const now = new Date();
    const istDay = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
    }).format(now);
    const expectedService = istDay === 'Sun' ? 'WE' : 'WK';

    const matches = [];

    for (const [tripId, stList] of this.stopTimesByTrip.entries()) {
      const trip = this.trips.get(tripId);
      if (!trip || trip.service_id !== expectedService) continue;

      const oIdx = stList.findIndex((s) => s.stop_id === normOrigin);
      if (oIdx === -1) continue;
      const oStop = stList[oIdx];

      let dStop = null;
      if (normDest) {
        const dIdx = stList.findIndex((s) => s.stop_id === normDest);
        if (dIdx <= oIdx) continue;
        dStop = stList[dIdx];
      }

      if (oStop.dep_sec >= targetSec) {
        const trainNumber = tripId.replace(/^(WK_|WE_)/, '');
        const trainCode = `KMRL-${trip.direction_id === 0 ? 'S' : 'N'}${trainNumber.padStart(2, '0')}`;
        const rideMinutes = dStop ? Math.round((dStop.arr_sec - oStop.dep_sec) / 60) : null;
        const etaFromTarget = oStop.dep_sec - targetSec;

        const format12h = (sec) => {
          const h = Math.floor(sec / 3600) % 24;
          const m = Math.floor((sec % 3600) / 60);
          const ampm = h >= 12 ? 'PM' : 'AM';
          const h12 = h % 12 || 12;
          return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
        };

        matches.push({
          trainId: trainCode,
          tripId,
          directionId: trip.direction_id,
          depSec: oStop.dep_sec,
          depTime: format12h(oStop.dep_sec),
          arrTime: dStop ? format12h(dStop.arr_sec) : null,
          rideMinutes,
          etaSeconds: etaFromTarget,
          originName: this.stops.get(normOrigin)?.name || normOrigin,
          destName: normDest ? (this.stops.get(normDest)?.name || normDest) : null,
        });
      }
    }

    matches.sort((a, b) => a.depSec - b.depSec);
    return matches.slice(0, limit);
  }

  getStationsGeoJSON() {
    const features = Array.from(this.stops.values()).map((s) => ({
      type: 'Feature',
      properties: {
        stop_id: s.id,
        stop_name: s.name,
      },
      geometry: {
        type: 'Point',
        coordinates: [s.lon, s.lat],
      },
    }));

    return {
      type: 'FeatureCollection',
      features,
    };
  }
}
