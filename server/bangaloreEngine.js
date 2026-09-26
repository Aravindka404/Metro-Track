import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data/bengaluru');

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

      this.isLoaded = true;
      console.log(
        `[BangaloreEngine] Loaded ${this.stations.length} stations: ` +
        `${this.purpleStations.length} Purple, ${this.greenStations.length} Green, ${this.yellowStations.length} Yellow`
      );
    } catch (err) {
      console.error('[BangaloreEngine] Error loading GeoJSON:', err);
    }
  }

  getActiveTrains() {
    if (!this.isLoaded) this.load();

    const now = new Date();
    const istTimeStr = now.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour12: true,
    });
    const [hh, mm, ss] = now.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
    }).split(':').map(Number);
    const timeSec = hh * 3600 + mm * 60 + ss;

    const trains = [];

    // Helper: simulate a fleet of trains along a corridor with continuous physics-based ETAs
    const simulateFleet = ({
      lineKey,
      lineName,
      lineColor,
      stationList,
      trackCoords,
      cycleSec,
      totalLengthMeters,
      trainDefs,
    }) => {
      const totalStops = stationList.length;
      if (totalStops < 2 || !trackCoords.length) return;

      for (const def of trainDefs) {
        // Determine motion relative to line coordinates (index 0 -> index totalStops-1)
        // Purple: dir 1 is Eastbound (0 -> totalStops-1)
        // Green & Yellow: dir 0 is Southbound (0 -> totalStops-1)
        const isForward = lineKey === 'purple' ? (def.dir === 1) : (def.dir === 0);

        // Continuous progress from 0.0 to 1.0 along the line
        const rawProgress = ((timeSec + def.offset) % cycleSec) / cycleSec;
        const effectiveProgress = isForward ? rawProgress : (1 - rawProgress);
        const isReversed = !isForward;

        const pos = this.interpolateCoords(trackCoords, effectiveProgress, isReversed);
        if (!pos) continue;

        // Determine current position relative to station stops
        const exactStop = effectiveProgress * (totalStops - 1);
        let currStationIdx = 0;
        let isDwelling = false;

        if (isForward) {
          // Forward: starts near 0 and moves to totalStops - 1
          currStationIdx = Math.min(totalStops - 1, Math.floor(exactStop));
          const subProgress = exactStop - currStationIdx;
          // Dwell at station for first ~18% of inter-station slice (approx 22-25 seconds)
          isDwelling = subProgress < 0.18;
        } else {
          // Reverse: starts near totalStops - 1 and moves to 0
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
            : Math.max(15, Math.round(progressDelta * cycleSec));

          const distMeters = Math.max(0, Math.round(progressDelta * totalLengthMeters));

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

        const originName = isForward
          ? stationList[0].name
          : stationList[totalStops - 1].name;

        trains.push({
          id: def.id,
          displayId: def.id.replace('BMRCL-', ''),
          line: lineKey,
          lineName,
          lineColor,
          direction: def.dir,
          directionId: def.dir,
          origin: originName,
          destination: def.dest,
          lat: pos.lat,
          lng: pos.lon,
          bearing: pos.bearing,
          speed: isDwelling ? 0 : 38,
          isDwelling,
          currentStation: isDwelling ? currStation.name : currStation.name,
          nextStation: isDwelling ? currStation.name : nextStop.name,
          nextStationId: isDwelling ? currStation.id : nextStop.id,
          etaSeconds: remainingStops[0]?.etaSeconds || 0,
          remainingStops,
          status: isDwelling ? `At ${currStation.name} Platform` : `Approaching ${nextStop.name}`,
        });
      }
    };

    // 1. Purple Line Fleet: 12 trains (6 Eastbound to Whitefield, 6 Westbound to Challaghatta)
    // 4500s cycle time (~75 min one-way, ~12.5 min headway per direction)
    const purpleCycleSec = 4500;
    const purpleTrainDefs = [
      { id: 'BMRCL-P01', offset: 0, dir: 1, dest: 'Whitefield (Kadugodi)' },
      { id: 'BMRCL-P02', offset: 750, dir: 1, dest: 'Whitefield (Kadugodi)' },
      { id: 'BMRCL-P03', offset: 1500, dir: 1, dest: 'Whitefield (Kadugodi)' },
      { id: 'BMRCL-P04', offset: 2250, dir: 1, dest: 'Whitefield (Kadugodi)' },
      { id: 'BMRCL-P05', offset: 3000, dir: 1, dest: 'Whitefield (Kadugodi)' },
      { id: 'BMRCL-P06', offset: 3750, dir: 1, dest: 'Whitefield (Kadugodi)' },
      { id: 'BMRCL-P07', offset: 375, dir: 0, dest: 'Challaghatta' },
      { id: 'BMRCL-P08', offset: 1125, dir: 0, dest: 'Challaghatta' },
      { id: 'BMRCL-P09', offset: 1875, dir: 0, dest: 'Challaghatta' },
      { id: 'BMRCL-P10', offset: 2625, dir: 0, dest: 'Challaghatta' },
      { id: 'BMRCL-P11', offset: 3375, dir: 0, dest: 'Challaghatta' },
      { id: 'BMRCL-P12', offset: 4125, dir: 0, dest: 'Challaghatta' },
    ];

    simulateFleet({
      lineKey: 'purple',
      lineName: 'Purple Line',
      lineColor: '#A855F7',
      stationList: this.purpleStations,
      trackCoords: this.purpleTrackCoords,
      cycleSec: purpleCycleSec,
      totalLengthMeters: 43490,
      trainDefs: purpleTrainDefs,
    });

    // 2. Green Line Fleet: 10 trains (5 Northbound to Madavara, 5 Southbound to Silk Institute)
    // 3900s cycle time (~65 min one-way, ~13 min headway per direction)
    const greenCycleSec = 3900;
    const greenTrainDefs = [
      { id: 'BMRCL-G01', offset: 0, dir: 1, dest: 'Madavara (BIEC)' },
      { id: 'BMRCL-G02', offset: 780, dir: 1, dest: 'Madavara (BIEC)' },
      { id: 'BMRCL-G03', offset: 1560, dir: 1, dest: 'Madavara (BIEC)' },
      { id: 'BMRCL-G04', offset: 2340, dir: 1, dest: 'Madavara (BIEC)' },
      { id: 'BMRCL-G05', offset: 3120, dir: 1, dest: 'Madavara (BIEC)' },
      { id: 'BMRCL-G06', offset: 390, dir: 0, dest: 'Silk Institute' },
      { id: 'BMRCL-G07', offset: 1170, dir: 0, dest: 'Silk Institute' },
      { id: 'BMRCL-G08', offset: 1950, dir: 0, dest: 'Silk Institute' },
      { id: 'BMRCL-G09', offset: 2730, dir: 0, dest: 'Silk Institute' },
      { id: 'BMRCL-G10', offset: 3510, dir: 0, dest: 'Silk Institute' },
    ];

    simulateFleet({
      lineKey: 'green',
      lineName: 'Green Line',
      lineColor: '#10B981',
      stationList: this.greenStations,
      trackCoords: this.greenTrackCoords,
      cycleSec: greenCycleSec,
      totalLengthMeters: 33460,
      trainDefs: greenTrainDefs,
    });

    // 3. Yellow Line Fleet: 8 trains (4 Northbound to RV Road, 4 Southbound to Bommasandra)
    // 1920s cycle time (~32 min one-way, ~8 min headway per direction)
    const yellowCycleSec = 1920;
    const yellowTrainDefs = [
      { id: 'BMRCL-Y01', offset: 0, dir: 1, dest: 'Rashtreeya Vidyalaya Road (RV Road)' },
      { id: 'BMRCL-Y02', offset: 480, dir: 1, dest: 'Rashtreeya Vidyalaya Road (RV Road)' },
      { id: 'BMRCL-Y03', offset: 960, dir: 1, dest: 'Rashtreeya Vidyalaya Road (RV Road)' },
      { id: 'BMRCL-Y04', offset: 1440, dir: 1, dest: 'Rashtreeya Vidyalaya Road (RV Road)' },
      { id: 'BMRCL-Y05', offset: 240, dir: 0, dest: 'Delta Electronics Bommasandra' },
      { id: 'BMRCL-Y06', offset: 720, dir: 0, dest: 'Delta Electronics Bommasandra' },
      { id: 'BMRCL-Y07', offset: 1200, dir: 0, dest: 'Delta Electronics Bommasandra' },
      { id: 'BMRCL-Y08', offset: 1680, dir: 0, dest: 'Delta Electronics Bommasandra' },
    ];

    simulateFleet({
      lineKey: 'yellow',
      lineName: 'Yellow Line',
      lineColor: '#EAB308',
      stationList: this.yellowStations,
      trackCoords: this.yellowTrackCoords,
      cycleSec: yellowCycleSec,
      totalLengthMeters: 19150,
      trainDefs: yellowTrainDefs,
    });

    return {
      istTime: istTimeStr,
      isSimulatedClock: false,
      isOpen: true,
      serviceStatus: 'open',
      opensAt: '05:00 AM',
      activeTrainsCount: trains.length,
      trains,
    };
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

      let deltaSec = targetSec - curSec;
      if (deltaSec < -120) {
        // Target time has already passed today by more than 2 minutes -> schedule for next day
        deltaSec += 86400;
      }
      baseTimeMs = now.getTime() + deltaSec * 1000;
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
