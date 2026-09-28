import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function findBangaloreDir() {
  const candidates = [
    path.resolve(__dirname, '../data/bengaluru'),
    path.resolve(process.cwd(), 'data/bengaluru'),
    path.resolve(process.cwd(), '../data/bengaluru'),
    path.resolve(__dirname, '../../data/bengaluru'),
    path.resolve(__dirname, 'data/bengaluru'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'stations.geojson'))) {
      return candidate;
    }
  }
  return path.resolve(__dirname, '../data/bengaluru');
}

let DATA_DIR = findBangaloreDir();

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

function calculateBearing(lat1, lon1, lat2, lon2) {
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

export const BENGALURU_PURPLE_IDS = [
  'BLR-PUR-01', 'BLR-PUR-02', 'BLR-PUR-03', 'BLR-PUR-04', 'BLR-PUR-05',
  'BLR-PUR-06', 'BLR-PUR-07', 'BLR-PUR-08', 'BLR-PUR-09', 'BLR-PUR-10',
  'BLR-PUR-11', 'BLR-PUR-12', 'BLR-PUR-13', 'BLR-PUR-14', 'BLR-MAJ-15',
  'BLR-PUR-16', 'BLR-PUR-17', 'BLR-PUR-18', 'BLR-PUR-19', 'BLR-PUR-20',
  'BLR-PUR-21', 'BLR-PUR-22', 'BLR-PUR-23', 'BLR-PUR-24', 'BLR-PUR-25',
  'BLR-PUR-26', 'BLR-PUR-27', 'BLR-PUR-28', 'BLR-PUR-29', 'BLR-PUR-30',
  'BLR-PUR-31', 'BLR-PUR-32', 'BLR-PUR-33', 'BLR-PUR-34', 'BLR-PUR-35',
  'BLR-PUR-36', 'BLR-PUR-37',
];

export const BENGALURU_GREEN_IDS = [
  'BLR-GRN-01', 'BLR-GRN-02', 'BLR-GRN-03', 'BLR-GRN-04', 'BLR-GRN-05',
  'BLR-GRN-06', 'BLR-GRN-07', 'BLR-GRN-08', 'BLR-GRN-09', 'BLR-GRN-10',
  'BLR-GRN-11', 'BLR-GRN-12', 'BLR-GRN-13', 'BLR-GRN-14', 'BLR-GRN-15',
  'BLR-GRN-16', 'BLR-MAJ-15', 'BLR-GRN-17', 'BLR-GRN-18', 'BLR-GRN-19',
  'BLR-GRN-20', 'BLR-GRN-21', 'BLR-GRN-22', 'BLR-GRN-23', 'BLR-GRN-24',
  'BLR-GRN-25', 'BLR-GRN-26', 'BLR-GRN-27', 'BLR-GRN-28', 'BLR-GRN-29',
  'BLR-GRN-30', 'BLR-GRN-31',
];

export const BENGALURU_YELLOW_IDS = [
  'BLR-GRN-23', // Rashtreeya Vidyalaya Road (RV Road) Interchange
  'BLR-YEL-02', 'BLR-YEL-03', 'BLR-YEL-04', 'BLR-YEL-05',
  'BLR-YEL-06', 'BLR-YEL-07', 'BLR-YEL-08', 'BLR-YEL-09',
  'BLR-YEL-10', 'BLR-YEL-11', 'BLR-YEL-12', 'BLR-YEL-13',
  'BLR-YEL-14', 'BLR-YEL-15', 'BLR-YEL-16',
];

export class BangaloreEngine {
  constructor() {
    this.stations = [];
    this.tracks = [];
    this.purpleStations = [];
    this.greenStations = [];
    this.yellowStations = [];
    this.purpleTrackCoords = [];
    this.greenTrackCoords = [];
    this.yellowTrackCoords = [];
    this.weekdayTrips = [];
    this.sundayTrips = [];
    this.isLoaded = false;
  }

  load() {
    if (this.isLoaded) return;
    try {
      const stationsData = JSON.parse(
        fs.readFileSync(path.join(DATA_DIR, 'stations.geojson'), 'utf8')
      );
      const tracksData = JSON.parse(
        fs.readFileSync(path.join(DATA_DIR, 'tracks.geojson'), 'utf8')
      );

      this.stations = stationsData.features.map((f) => ({
        id: f.properties.stop_id,
        name: f.properties.stop_name,
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        line: f.properties.line,
      }));

      const purpleTrack = tracksData.features.find((f) => f.properties.line === 'purple');
      const greenTrack = tracksData.features.find((f) => f.properties.line === 'green');
      const yellowTrack = tracksData.features.find((f) => f.properties.line === 'yellow');

      this.purpleTrackCoords = purpleTrack ? purpleTrack.geometry.coordinates : [];
      this.greenTrackCoords = greenTrack ? greenTrack.geometry.coordinates : [];
      this.yellowTrackCoords = yellowTrack ? yellowTrack.geometry.coordinates : [];

      // Sort stations strictly in geographic line order
      this.purpleStations = this.stations
        .filter((s) => s.line === 'purple' || s.id === 'BLR-MAJ-15')
        .sort((a, b) => BENGALURU_PURPLE_IDS.indexOf(a.id) - BENGALURU_PURPLE_IDS.indexOf(b.id));

      this.greenStations = this.stations
        .filter((s) => s.line === 'green' || s.id === 'BLR-MAJ-15' || s.id === 'BLR-GRN-23')
        .sort((a, b) => BENGALURU_GREEN_IDS.indexOf(a.id) - BENGALURU_GREEN_IDS.indexOf(b.id));

      this.yellowStations = this.stations
        .filter((s) => s.line === 'yellow' || s.id === 'BLR-GRN-23')
        .sort((a, b) => BENGALURU_YELLOW_IDS.indexOf(a.id) - BENGALURU_YELLOW_IDS.indexOf(b.id));

      this.buildDailySchedules();
      this.isLoaded = true;
      console.log(
        `[BangaloreEngine] Loaded ${this.stations.length} stations: ` +
        `${this.purpleStations.length} Purple, ${this.greenStations.length} Green, ${this.yellowStations.length} Yellow | ` +
        `${this.weekdayTrips.length} Weekday trips, ${this.sundayTrips.length} Sunday trips`
      );
    } catch (err) {
      console.error('[BangaloreEngine] Error loading GeoJSON:', err);
    }
  }

  getActiveTrains(simulatedSeconds = null, simulatedDay = null) {
    if (!this.isLoaded) this.load();

    const now = new Date();
    let currentSec;
    let istTimeStr;

    if (simulatedSeconds !== null) {
      currentSec = simulatedSeconds;
      const sh = Math.floor(currentSec / 3600);
      const sm = Math.floor((currentSec % 3600) / 60);
      const ss = currentSec % 60;
      const d = new Date();
      d.setHours(sh, sm, ss);
      istTimeStr = d.toLocaleTimeString('en-US', {
        hour12: true,
      });
    } else {
      istTimeStr = now.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour12: true,
      });
      const [hh, mm, ss] = now.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
      }).split(':').map(Number);
      currentSec = hh * 3600 + mm * 60 + ss;
    }

    // Determine current and tomorrow's day of week in Asia/Kolkata
    let istDay;
    if (simulatedDay !== null && simulatedDay !== undefined) {
      if (typeof simulatedDay === 'number' || !isNaN(Number(simulatedDay))) {
        const dayIdx = Number(simulatedDay) % 7;
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        istDay = days[dayIdx];
      } else {
        const s = String(simulatedDay).trim();
        istDay = s.charAt(0).toUpperCase() + s.slice(1, 3).toLowerCase();
      }
    } else {
      istDay = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        weekday: 'short',
      }).format(now);
    }
    const isSunday = istDay === 'Sun';

    const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
    const isTomorrowSunday = simulatedDay !== null && simulatedDay !== undefined
      ? istDay === 'Sat'
      : new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kolkata',
          weekday: 'short',
        }).format(tomorrow) === 'Sun';

    // Official BMRCL Bangalore Metro Timetable bounds
    const todayOpenSec = isSunday ? 7 * 3600 : 5 * 3600;
    const isEarlyMorning = currentSec < todayOpenSec;

    const opensAt = isEarlyMorning
      ? (isSunday ? '07:00 AM' : '05:00 AM')
      : (isTomorrowSunday ? '07:00 AM' : '05:00 AM');

    const nextServiceText = isEarlyMorning
      ? `Opens today at ${opensAt} IST`
      : `Opens tomorrow at ${opensAt} IST`;

    // Retrieve today's scheduled timetable
    const tripSchedule = isSunday ? this.sundayTrips : this.weekdayTrips;

    // Filter trains that are physically in transit right now (depSec <= currentSec < arrSec)
    // If it's before the first departure of the day or after the final train has arrived at its terminal, activeTrips is []
    const activeTrips = isEarlyMorning
      ? []
      : tripSchedule.filter((t) => currentSec >= t.depSec && currentSec < t.arrSec);

    const isOpen = activeTrips.length > 0;

    // Off-Hours Policy: Do NOT mock or simulate fleet movements when closed
    if (!isOpen) {
      return {
        timestamp: now.toISOString(),
        istTime: istTimeStr,
        isSimulatedClock: simulatedSeconds !== null,
        isOpen: false,
        serviceStatus: 'closed',
        opensAt,
        nextServiceText,
        activeTrainsCount: 0,
        trains: [],
      };
    }

    const trains = this.resolveActiveTrips(activeTrips, currentSec);

    return {
      timestamp: now.toISOString(),
      istTime: istTimeStr,
      isSimulatedClock: simulatedSeconds !== null,
      isOpen: true,
      serviceStatus: 'open',
      opensAt,
      nextServiceText: 'Normal Service',
      activeTrainsCount: trains.length,
      trains,
    };
  }

  buildDailySchedules() {
    const pad = (n) => String(n).padStart(2, '0');
    const formatHHMM = (sec) => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      return `${pad(h)}${pad(m)}`;
    };

    const makeSchedule = (isSunday) => {
      const trips = [];
      const lines = [
        {
          key: 'purple',
          name: 'Purple Line',
          color: '#A855F7',
          stations: this.purpleStations,
          trackCoords: this.purpleTrackCoords,
          durationSec: 4500, // 75 mins
          totalLengthMeters: 43490,
          headways: isSunday
            ? [{ start: 7, end: 23, headwayMin: 12 }]
            : [
                { start: 5, end: 7.5, headwayMin: 15 },
                { start: 7.5, end: 11.5, headwayMin: 7.5 },
                { start: 11.5, end: 16.5, headwayMin: 11 },
                { start: 16.5, end: 20.5, headwayMin: 7.5 },
                { start: 20.5, end: 23, headwayMin: 15 },
              ],
          dest1: this.purpleStations[this.purpleStations.length - 1]?.name || 'Whitefield (Kadugodi)',
          dest0: this.purpleStations[0]?.name || 'Challaghatta',
          origin1: this.purpleStations[0]?.name || 'Challaghatta',
          origin0: this.purpleStations[this.purpleStations.length - 1]?.name || 'Whitefield (Kadugodi)',
        },
        {
          key: 'green',
          name: 'Green Line',
          color: '#10B981',
          stations: this.greenStations,
          trackCoords: this.greenTrackCoords,
          durationSec: 3900, // 65 mins
          totalLengthMeters: 33460,
          headways: isSunday
            ? [{ start: 7, end: 23, headwayMin: 12 }]
            : [
                { start: 5, end: 7.5, headwayMin: 15 },
                { start: 7.5, end: 11.5, headwayMin: 8.5 },
                { start: 11.5, end: 16.5, headwayMin: 12 },
                { start: 16.5, end: 20.5, headwayMin: 8.5 },
                { start: 20.5, end: 23, headwayMin: 15 },
              ],
          dest1: this.greenStations[0]?.name || 'Madavara (BIEC)',
          dest0: this.greenStations[this.greenStations.length - 1]?.name || 'Silk Institute',
          origin1: this.greenStations[this.greenStations.length - 1]?.name || 'Silk Institute',
          origin0: this.greenStations[0]?.name || 'Madavara (BIEC)',
        },
        {
          key: 'yellow',
          name: 'Yellow Line',
          color: '#EAB308',
          stations: this.yellowStations,
          trackCoords: this.yellowTrackCoords,
          durationSec: 1980, // 33 mins
          totalLengthMeters: 19150,
          headways: isSunday
            ? [{ start: 7, end: 23, headwayMin: 15 }]
            : [
                { start: 5, end: 7.5, headwayMin: 15 },
                { start: 7.5, end: 11.5, headwayMin: 10 },
                { start: 11.5, end: 16.5, headwayMin: 14 },
                { start: 16.5, end: 20.5, headwayMin: 10 },
                { start: 20.5, end: 23, headwayMin: 15 },
              ],
          dest1: this.yellowStations[0]?.name || 'Rashtreeya Vidyalaya Road (RV Road)',
          dest0: this.yellowStations[this.yellowStations.length - 1]?.name || 'Delta Electronics Bommasandra',
          origin1: this.yellowStations[this.yellowStations.length - 1]?.name || 'Delta Electronics Bommasandra',
          origin0: this.yellowStations[0]?.name || 'Rashtreeya Vidyalaya Road (RV Road)',
        },
      ];

      for (const line of lines) {
        for (const hw of line.headways) {
          const stepSec = Math.round(hw.headwayMin * 60);
          const startSec = Math.round(hw.start * 3600);
          const endSec = Math.round(hw.end * 3600);

          for (let dep = startSec; dep <= endSec; dep += stepSec) {
            const timeTag = formatHHMM(dep);
            const prefix = line.key.charAt(0).toUpperCase();

            // Direction 1
            trips.push({
              id: `BMRCL-${prefix}1-${timeTag}`,
              displayId: `${prefix}1-${timeTag.slice(0, 2)}:${timeTag.slice(2)}`,
              lineKey: line.key,
              lineName: line.name,
              lineColor: line.color,
              dir: 1,
              depSec: dep,
              arrSec: dep + line.durationSec,
              durationSec: line.durationSec,
              totalLengthMeters: line.totalLengthMeters,
              stationList: line.stations,
              trackCoords: line.trackCoords,
              origin: line.origin1,
              destination: line.dest1,
            });

            // Direction 0
            trips.push({
              id: `BMRCL-${prefix}0-${timeTag}`,
              displayId: `${prefix}0-${timeTag.slice(0, 2)}:${timeTag.slice(2)}`,
              lineKey: line.key,
              lineName: line.name,
              lineColor: line.color,
              dir: 0,
              depSec: dep,
              arrSec: dep + line.durationSec,
              durationSec: line.durationSec,
              totalLengthMeters: line.totalLengthMeters,
              stationList: line.stations,
              trackCoords: line.trackCoords,
              origin: line.origin0,
              destination: line.dest0,
            });
          }
        }
      }
      return trips;
    };

    this.weekdayTrips = makeSchedule(false);
    this.sundayTrips = makeSchedule(true);
  }

  resolveActiveTrips(activeTrips, currentSec) {
    const trains = [];

    for (const trip of activeTrips) {
      const stationList = trip.stationList;
      const trackCoords = trip.trackCoords;
      const totalStops = stationList.length;
      if (totalStops < 2 || !trackCoords || !trackCoords.length) continue;

      // Determine motion relative to line coordinates (index 0 -> index totalStops-1)
      // Purple: dir 1 is Eastbound (0 -> totalStops-1)
      // Green & Yellow: dir 0 is Southbound (0 -> totalStops-1)
      const isForward = trip.lineKey === 'purple' ? (trip.dir === 1) : (trip.dir === 0);

      // Continuous progress from 0.0 to 1.0 along the line based on elapsed time since departure
      const elapsedSec = currentSec - trip.depSec;
      const rawProgress = Math.max(0, Math.min(1, elapsedSec / trip.durationSec));
      const effectiveProgress = isForward ? rawProgress : (1 - rawProgress);
      const isReversed = !isForward;

      const pos = this.interpolateCoords(trackCoords, effectiveProgress, isReversed);
      if (!pos) continue;

      // Determine current position relative to station stops
      const exactStop = effectiveProgress * (totalStops - 1);
      let currStationIdx = 0;
      let isDwelling = false;

      if (isForward) {
        currStationIdx = Math.min(totalStops - 1, Math.floor(exactStop));
        const subProgress = exactStop - currStationIdx;
        isDwelling = subProgress < 0.18;
      } else {
        currStationIdx = Math.max(0, Math.ceil(exactStop));
        const subProgress = currStationIdx - exactStop;
        isDwelling = subProgress < 0.18;
      }

      const currStation = stationList[currStationIdx] || stationList[0];

      // Build remaining upcoming stops with continuous distance and ETA countdown
      let remainingStationIndices = [];
      if (isForward) {
        const startIdx = isDwelling ? currStationIdx : currStationIdx + 1;
        for (let k = startIdx; k < totalStops; k++) {
          remainingStationIndices.push(k);
        }
      } else {
        const startIdx = isDwelling ? currStationIdx : currStationIdx - 1;
        for (let k = startIdx; k >= 0; k--) {
          remainingStationIndices.push(k);
        }
      }

      const remainingStops = remainingStationIndices.map((k, offsetIdx) => {
        const st = stationList[k];
        const stNominalProgress = k / (totalStops - 1);
        const progressDelta = isForward
          ? Math.max(0, stNominalProgress - effectiveProgress)
          : Math.max(0, effectiveProgress - stNominalProgress);

        const etaSec = isDwelling && offsetIdx === 0
          ? 0
          : Math.max(15, Math.round(progressDelta * trip.durationSec));

        const distMeters = Math.max(0, Math.round(progressDelta * trip.totalLengthMeters));

        return {
          stopId: st.id,
          stopName: st.name,
          etaSeconds: etaSec,
          distanceMeters: distMeters,
        };
      });

      const nextStop = remainingStops[0]
        ? stationList.find((s) => s.id === remainingStops[0].stopId) || currStation
        : currStation;

      trains.push({
        id: trip.id,
        displayId: trip.displayId,
        line: trip.lineKey,
        lineName: trip.lineName,
        lineColor: trip.lineColor,
        direction: trip.dir,
        directionId: trip.dir,
        origin: trip.origin,
        destination: trip.destination,
        lat: pos.lat,
        lng: pos.lon,
        bearing: pos.bearing,
        speed: isDwelling ? 0 : 38,
        isDwelling,
        currentStation: currStation.name,
        nextStation: isDwelling ? currStation.name : nextStop.name,
        nextStationId: isDwelling ? currStation.id : nextStop.id,
        etaSeconds: remainingStops[0]?.etaSeconds || 0,
        remainingStops,
        status: isDwelling ? `At ${currStation.name} Platform` : `Approaching ${nextStop.name}`,
      });
    }

    return trains;
  }

  interpolateCoords(coords, ratio, isReversed = false) {
    if (!coords || coords.length === 0) return null;
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    const totalSegments = coords.length - 1;
    const exactIdx = clampedRatio * totalSegments;
    const idx = Math.min(Math.floor(exactIdx), totalSegments - 1);
    const subRatio = exactIdx - idx;

    let p1 = coords[idx];
    let p2 = coords[idx + 1] || p1;

    const lon = p1[0] + subRatio * (p2[0] - p1[0]);
    const lat = p1[1] + subRatio * (p2[1] - p1[1]);

    // Calculate heading vector: from p1->p2 for forward, or p2->p1 for reversed
    let bFrom = isReversed ? p2 : p1;
    let bTo = isReversed ? p1 : p2;

    // Guard against identical coordinate vertices
    if (bFrom[0] === bTo[0] && bFrom[1] === bTo[1]) {
      if (idx > 0) {
        bFrom = isReversed ? coords[idx] : coords[idx - 1];
        bTo = isReversed ? coords[idx - 1] : coords[idx];
      } else if (idx + 2 < coords.length) {
        bFrom = isReversed ? coords[idx + 2] : coords[idx + 1];
        bTo = isReversed ? coords[idx + 1] : coords[idx + 2];
      }
    }

    const bearing = calculateBearing(bFrom[1], bFrom[0], bTo[1], bTo[0]);

    return { lon, lat, bearing };
  }

  getScheduledDepartures(originId, destId, queryTime, count = 4) {
    if (!this.isLoaded) this.load();
    const now = new Date();
    const departures = [];

    const pO = BENGALURU_PURPLE_IDS.indexOf(originId);
    const pD = BENGALURU_PURPLE_IDS.indexOf(destId);
    const gO = BENGALURU_GREEN_IDS.indexOf(originId);
    const gD = BENGALURU_GREEN_IDS.indexOf(destId);
    const yO = BENGALURU_YELLOW_IDS.indexOf(originId);
    const yD = BENGALURU_YELLOW_IDS.indexOf(destId);

    let lineKey = 'purple';
    let directionId = 1;
    let hops = 4;
    let prefix = 'BMRCL-SCH-P';

    if (yO !== -1 && yD !== -1) {
      lineKey = 'yellow';
      prefix = 'BMRCL-SCH-Y';
      directionId = yD > yO ? 0 : 1; // 0 = Towards Bommasandra, 1 = Towards RV Road
      hops = Math.abs(yD - yO);
    } else if (gO !== -1 && gD !== -1) {
      lineKey = 'green';
      prefix = 'BMRCL-SCH-G';
      directionId = gD > gO ? 0 : 1; // 0 = Towards Silk Institute, 1 = Towards Madavara
      hops = Math.abs(gD - gO);
    } else if (pO !== -1 && pD !== -1) {
      lineKey = 'purple';
      prefix = 'BMRCL-SCH-P';
      directionId = pD > pO ? 1 : 0; // 1 = Towards Whitefield, 0 = Towards Challaghatta
      hops = Math.abs(pD - pO);
    } else if (yO !== -1 && originId !== 'BLR-GRN-23') {
      // Transfer starting on Yellow towards RV Road
      lineKey = 'yellow';
      prefix = 'BMRCL-SCH-Y';
      const yRVR = 0; // RV Road is index 0 in Yellow list
      directionId = 1; // Towards RV Road
      hops = Math.abs(yO - yRVR);
    } else if (gO !== -1) {
      // Transfer starting on Green
      lineKey = 'green';
      prefix = 'BMRCL-SCH-G';
      // If destination is on Yellow, head towards RV Road (index 23)
      if (yD !== -1) {
        const gRVR = BENGALURU_GREEN_IDS.indexOf('BLR-GRN-23');
        directionId = gRVR > gO ? 0 : 1;
        hops = Math.abs(gRVR - gO);
      } else {
        // Head towards Majestic (index 16)
        const gMaj = BENGALURU_GREEN_IDS.indexOf('BLR-MAJ-15');
        directionId = gMaj > gO ? 0 : 1;
        hops = Math.abs(gMaj - gO);
      }
    } else if (pO !== -1) {
      // Transfer starting on Purple towards Majestic
      lineKey = 'purple';
      prefix = 'BMRCL-SCH-P';
      const pMaj = BENGALURU_PURPLE_IDS.indexOf('BLR-MAJ-15');
      directionId = pMaj > pO ? 1 : 0;
      hops = Math.abs(pMaj - pO);
    }

    const rideMinutes = Math.max(2, Math.round(hops * 2.1));

    // Official operating timetable bounds
    const istDay = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
    }).format(now);
    const isSunday = istDay === 'Sun';
    const todayOpenSec = isSunday ? 7 * 3600 : 5 * 3600;
    const todayCloseSec = 23 * 3600;

    // Calculate base time from queryTime (HH:MM or HH:MM:SS) in Asia/Kolkata context
    let baseTimeMs = now.getTime();
    if (queryTime && typeof queryTime === 'string' && queryTime.includes(':')) {
      const parts = queryTime.split(':').map(Number);
      const targetH = parts[0] || 0;
      const targetM = parts[1] || 0;

      // Current hours, minutes, seconds in IST
      const istTimeStr = now.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
      });
      const [curH, curM, curS] = istTimeStr.split(':').map(Number);
      const curSec = curH * 3600 + curM * 60 + (curS || 0);
      const targetSec = targetH * 3600 + targetM * 60;

      let effectiveTargetSec = targetSec;
      if (targetSec < todayOpenSec) {
        // Query time is during early morning off-hours -> snap to opening time
        effectiveTargetSec = todayOpenSec;
      } else if (targetSec >= todayCloseSec) {
        // Query time is after night closure -> snap to tomorrow opening time
        const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
        const isTomorrowSunday = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kolkata',
          weekday: 'short',
        }).format(tomorrow) === 'Sun';
        const tomorrowOpenSec = isTomorrowSunday ? 7 * 3600 : 5 * 3600;
        effectiveTargetSec = 86400 + tomorrowOpenSec;
      }

      let deltaSec = effectiveTargetSec - curSec;
      if (deltaSec < -120) {
        // Target time has already passed today by more than 2 minutes -> schedule for next day
        deltaSec += 86400;
      }
      baseTimeMs = now.getTime() + deltaSec * 1000;
    } else {
      // If no custom query time and metro is currently closed, schedule from next resumption time
      const [curH, curM, curS] = now.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
      }).split(':').map(Number);
      const curSec = curH * 3600 + curM * 60 + (curS || 0);

      if (curSec < todayOpenSec) {
        // Early morning before opening: base departures start at today's opening time
        const waitSec = todayOpenSec - curSec;
        baseTimeMs = now.getTime() + waitSec * 1000;
      } else if (curSec >= todayCloseSec) {
        // Night after 11:00 PM: base departures start at tomorrow's opening time
        const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
        const isTomorrowSunday = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kolkata',
          weekday: 'short',
        }).format(tomorrow) === 'Sun';
        const tomorrowOpenSec = isTomorrowSunday ? 7 * 3600 : 5 * 3600;
        const waitSec = (86400 - curSec) + tomorrowOpenSec;
        baseTimeMs = now.getTime() + waitSec * 1000;
      }
    }

    for (let i = 0; i < count; i++) {
      const waitFromBaseSec = (i * 360) + 120; // departures every 6 mins after target time
      const depDate = new Date(baseTimeMs + waitFromBaseSec * 1000);
      const arrDate = new Date(depDate.getTime() + rideMinutes * 60 * 1000);

      const depTime = depDate.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      const arrTime = arrDate.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      const waitFromNowSec = Math.max(0, Math.round((depDate.getTime() - now.getTime()) / 1000));

      departures.push({
        trainId: `${prefix}${String(i + 1).padStart(2, '0')}`,
        directionId,
        line: lineKey,
        depTime,
        arrTime,
        etaSeconds: waitFromNowSec,
        rideMinutes,
      });
    }

    return departures;
  }
}
