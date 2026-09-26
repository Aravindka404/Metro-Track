// Official KMRL Transit Stations in geographic order: North (Aluva) to South (Tripunithura)
export const KMRL_STATION_IDS = [
  'ALVA', // 0: Aluva
  'PNCU', // 1: Pulinchodu
  'CPPY', // 2: Companypady
  'ATTK', // 3: Ambattukavu
  'MUTT', // 4: Muttom
  'KLMT', // 5: Kalamassery
  'CCUV', // 6: Cochin University
  'PDPM', // 7: Pathadipalam
  'EDAP', // 8: Edapally
  'CGPP', // 9: Changampuzha Park
  'PARV', // 10: Palarivattom
  'JLSD', // 11: JLN Stadium
  'KALR', // 12: Kaloor
  'TNHL', // 13: Town Hall
  'MGRD', // 14: MG Road
  'MACE', // 15: Maharajas College
  'ERSH', // 16: Ernakulam South
  'KVTR', // 17: Kadavanthra
  'EMKM', // 18: Elamkulam
  'VYTA', // 19: Vyttila
  'THYK', // 20: Thykoodam
  'PETT', // 21: Pettah
  'VAKK', // 22: Vadakkekotta
  'SNJN', // 23: SN Junction
  'TPHT', // 24: Tripunithura
];

// Official BMRCL Transit Stations in geographic order
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

// Normalize ID variations (e.g., TRPN -> TPHT, EDPL -> EDAP)
export function normalizeStationId(id) {
  if (!id) return '';
  const upper = id.toUpperCase();
  if (upper === 'TRPN') return 'TPHT';
  if (upper === 'EDPL') return 'EDAP';
  return upper;
}

export function getStationIndex(stationId) {
  const norm = normalizeStationId(stationId);
  return KMRL_STATION_IDS.indexOf(norm);
}

export function isBengaluruStation(id) {
  return typeof id === 'string' && id.startsWith('BLR-');
}

/**
 * Direction between two stations:
 * For Kochi: 0 = Southbound (Towards Tripunithura), 1 = Northbound (Towards Aluva)
 * For Bengaluru:
 *   Purple Line: 1 = Towards Whitefield, 0 = Towards Challaghatta
 *   Green Line: 0 = Towards Silk Institute, 1 = Towards Madavara
 *   Yellow Line: 0 = Towards Bommasandra, 1 = Towards RV Road
 *   Interchange: Direction of the FIRST leg towards the transfer station
 * null = Same station or invalid / cross-city
 */
export function getTripDirection(originId, destId, city = 'kochi') {
  if (!originId || !destId || originId === destId) return null;

  const isOBlr = isBengaluruStation(originId);
  const isDBlr = isBengaluruStation(destId);

  // Strictly prevent cross-city direction calculations
  if (isOBlr !== isDBlr) return null;

  if (city === 'bengaluru' || isOBlr) {
    if (!isOBlr || !isDBlr) return null;
    const pO = BENGALURU_PURPLE_IDS.indexOf(originId);
    const pD = BENGALURU_PURPLE_IDS.indexOf(destId);
    const gO = BENGALURU_GREEN_IDS.indexOf(originId);
    const gD = BENGALURU_GREEN_IDS.indexOf(destId);
    const yO = BENGALURU_YELLOW_IDS.indexOf(originId);
    const yD = BENGALURU_YELLOW_IDS.indexOf(destId);

    // 1. Direct on Purple Line
    if (pO !== -1 && pD !== -1) {
      return pD > pO ? 1 : 0;
    }

    // 2. Direct on Green Line
    if (gO !== -1 && gD !== -1) {
      return gD > gO ? 0 : 1;
    }

    // 3. Direct on Yellow Line
    if (yO !== -1 && yD !== -1) {
      return yD > yO ? 0 : 1;
    }

    // 4. Interchange trips: direction of first leg
    if (yO !== -1 && originId !== 'BLR-GRN-23') {
      // Boarding on Yellow: must travel towards RV Road (index 0)
      return 1;
    }

    if (pO !== -1) {
      // Boarding on Purple: must travel towards Majestic
      const pMaj = BENGALURU_PURPLE_IDS.indexOf('BLR-MAJ-15');
      return pMaj > pO ? 1 : 0;
    }

    if (gO !== -1) {
      // Boarding on Green:
      if (yD !== -1) {
        // Destination is Yellow: transfer at RV Road
        const gRVR = BENGALURU_GREEN_IDS.indexOf('BLR-GRN-23');
        return gRVR > gO ? 0 : 1;
      } else {
        // Destination is Purple: transfer at Majestic
        const gMaj = BENGALURU_GREEN_IDS.indexOf('BLR-MAJ-15');
        return gMaj > gO ? 0 : 1;
      }
    }

    return null;
  }

  // Kochi Metro
  if (isOBlr || isDBlr) return null;
  const oIdx = getStationIndex(originId);
  const dIdx = getStationIndex(destId);
  if (oIdx === -1 || dIdx === -1 || oIdx === dIdx) return null;
  return dIdx > oIdx ? 0 : 1;
}

/**
 * Station count / hops between two stations
 */
export function getStationHopCount(originId, destId, city = 'kochi') {
  if (!originId || !destId || originId === destId) return 0;

  const isOBlr = isBengaluruStation(originId);
  const isDBlr = isBengaluruStation(destId);

  // Strictly prevent cross-city hop count calculations
  if (isOBlr !== isDBlr) return 0;

  if (city === 'bengaluru' || isOBlr) {
    if (!isOBlr || !isDBlr) return 0;
    const pO = BENGALURU_PURPLE_IDS.indexOf(originId);
    const pD = BENGALURU_PURPLE_IDS.indexOf(destId);
    const gO = BENGALURU_GREEN_IDS.indexOf(originId);
    const gD = BENGALURU_GREEN_IDS.indexOf(destId);
    const yO = BENGALURU_YELLOW_IDS.indexOf(originId);
    const yD = BENGALURU_YELLOW_IDS.indexOf(destId);

    // Both on Purple Line
    if (pO !== -1 && pD !== -1) return Math.abs(pD - pO);
    // Both on Green Line
    if (gO !== -1 && gD !== -1) return Math.abs(gD - gO);
    // Both on Yellow Line
    if (yO !== -1 && yD !== -1) return Math.abs(yD - yO);

    const pMaj = BENGALURU_PURPLE_IDS.indexOf('BLR-MAJ-15'); // 14
    const gMaj = BENGALURU_GREEN_IDS.indexOf('BLR-MAJ-15'); // 16
    const gRVR = BENGALURU_GREEN_IDS.indexOf('BLR-GRN-23'); // 23
    const yRVR = 0;

    // Interchange: Purple <-> Green via Majestic
    if (pO !== -1 && gD !== -1) {
      return Math.abs(pMaj - pO) + Math.abs(gD - gMaj);
    }
    if (gO !== -1 && pD !== -1) {
      return Math.abs(gMaj - gO) + Math.abs(pD - pMaj);
    }

    // Interchange: Green <-> Yellow via RV Road
    if (gO !== -1 && yD !== -1) {
      return Math.abs(gRVR - gO) + Math.abs(yD - yRVR);
    }
    if (yO !== -1 && gD !== -1) {
      return Math.abs(yO - yRVR) + Math.abs(gD - gRVR);
    }

    // Interchange: Purple <-> Yellow via Majestic AND RV Road
    if (pO !== -1 && yD !== -1) {
      return Math.abs(pMaj - pO) + Math.abs(gRVR - gMaj) + Math.abs(yD - yRVR);
    }
    if (yO !== -1 && pD !== -1) {
      return Math.abs(yO - yRVR) + Math.abs(gMaj - gRVR) + Math.abs(pD - pMaj);
    }

    return 0;
  }

  // Kochi Metro
  if (isOBlr || isDBlr) return 0;
  const oIdx = getStationIndex(originId);
  const dIdx = getStationIndex(destId);
  if (oIdx === -1 || dIdx === -1) return 0;
  return Math.abs(dIdx - oIdx);
}

/**
 * Official Metro Fare Calculation (Kochi KMRL & Bengaluru BMRCL)
 */
export function calculateFare(originId, destId, city = 'kochi') {
  const hops = getStationHopCount(originId, destId, city);
  if (hops === 0) return 0;

  if (city === 'bengaluru' || originId?.startsWith('BLR-')) {
    // Official BMRCL Fare slabs
    if (hops <= 2) return 10;
    if (hops <= 4) return 20;
    if (hops <= 7) return 30;
    if (hops <= 10) return 40;
    if (hops <= 15) return 50;
    return 60;
  }

  // Official KMRL Fare slabs
  if (hops <= 2) return 10;
  if (hops <= 5) return 20;
  if (hops <= 9) return 30;
  if (hops <= 14) return 40;
  if (hops <= 19) return 50;
  return 60;
}

export const calculateKochiMetroFare = (originId, destId) => calculateFare(originId, destId, 'kochi');

/**
 * Estimated travel time in minutes based on ~2.1 minutes average per station
 */
export function estimateRideDurationMinutes(originId, destId, city = 'kochi') {
  const hops = getStationHopCount(originId, destId, city);
  if (hops === 0) return 0;
  return Math.max(2, Math.round(hops * 2.1));
}

/**
 * Multi-line interchange trip analyzer
 * Supports:
 *  - Purple <-> Green via Majestic
 *  - Green <-> Yellow via RV Road
 *  - Purple <-> Yellow via Majestic and RV Road (Double transfer)
 */
export function getInterchangeDetails(originId, destId, city = 'kochi') {
  if (!originId || !destId || originId === destId) {
    return { isInterchange: false };
  }

  const isOBlr = isBengaluruStation(originId);
  const isDBlr = isBengaluruStation(destId);

  if (city !== 'bengaluru' && !isOBlr) {
    return { isInterchange: false };
  }

  if (isOBlr !== isDBlr) {
    return { isInterchange: false };
  }

  const pO = BENGALURU_PURPLE_IDS.indexOf(originId);
  const pD = BENGALURU_PURPLE_IDS.indexOf(destId);
  const gO = BENGALURU_GREEN_IDS.indexOf(originId);
  const gD = BENGALURU_GREEN_IDS.indexOf(destId);
  const yO = BENGALURU_YELLOW_IDS.indexOf(originId);
  const yD = BENGALURU_YELLOW_IDS.indexOf(destId);

  // Direct trips (no transfer needed)
  if (
    (pO !== -1 && pD !== -1) ||
    (gO !== -1 && gD !== -1) ||
    (yO !== -1 && yD !== -1)
  ) {
    return { isInterchange: false };
  }

  const pMaj = BENGALURU_PURPLE_IDS.indexOf('BLR-MAJ-15');
  const gMaj = BENGALURU_GREEN_IDS.indexOf('BLR-MAJ-15');
  const gRVR = BENGALURU_GREEN_IDS.indexOf('BLR-GRN-23');
  const yRVR = 0;

  // ================= 1. Green <-> Yellow Interchange via RV Road =================
  if (gO !== -1 && yD !== -1) {
    const leg1Hops = Math.abs(gRVR - gO);
    const leg1Dir = gO < gRVR ? 0 : 1;
    const leg1DirName = leg1Dir === 0 ? 'Silk Institute' : 'Madavara (BIEC)';

    const leg2Hops = Math.abs(yD - yRVR);
    const leg2Dir = 0; // Towards Bommasandra
    const leg2DirName = 'Delta Electronics Bommasandra';

    const leg1RideMinutes = Math.max(2, Math.round(leg1Hops * 2.1));
    const leg2RideMinutes = Math.max(2, Math.round(leg2Hops * 2.1));
    const totalHops = leg1Hops + leg2Hops;
    const totalFare = calculateFare(originId, destId, 'bengaluru');

    return {
      isInterchange: true,
      interchangeStationId: 'BLR-GRN-23',
      interchangeStationName: 'Rashtreeya Vidyalaya Road (RV Road)',
      leg1: {
        line: 'green',
        lineName: 'Green Line',
        lineColor: '#10B981',
        originId,
        destId: 'BLR-GRN-23',
        direction: leg1Dir,
        directionName: leg1DirName,
        hops: leg1Hops,
        rideMinutes: leg1RideMinutes,
      },
      transfer: {
        stationId: 'BLR-GRN-23',
        stationName: 'Rashtreeya Vidyalaya Road (RV Road)',
        fromLine: 'green',
        toLine: 'yellow',
        fromLevel: 'Level 1 (Green Line)',
        toLevel: 'Level 2 (Yellow Line)',
        walkMinutes: 3,
        instructions: 'Alight at RV Road. Change from Green Line platform to Yellow Line platform via concourse.',
        notice: 'Stay inside paid area • No new ticket or tap-out needed',
      },
      leg2: {
        line: 'yellow',
        lineName: 'Yellow Line',
        lineColor: '#EAB308',
        originId: 'BLR-GRN-23',
        destId,
        direction: leg2Dir,
        directionName: leg2DirName,
        hops: leg2Hops,
        rideMinutes: leg2RideMinutes,
      },
      totalHops,
      totalRideMinutes: leg1RideMinutes + 3 + leg2RideMinutes,
      totalFare,
    };
  }

  if (yO !== -1 && gD !== -1) {
    const leg1Hops = Math.abs(yO - yRVR);
    const leg1Dir = 1; // Towards RV Road
    const leg1DirName = 'Rashtreeya Vidyalaya Road (RV Road)';

    const leg2Hops = Math.abs(gD - gRVR);
    const leg2Dir = gD > gRVR ? 0 : 1;
    const leg2DirName = leg2Dir === 0 ? 'Silk Institute' : 'Madavara (BIEC)';

    const leg1RideMinutes = Math.max(2, Math.round(leg1Hops * 2.1));
    const leg2RideMinutes = Math.max(2, Math.round(leg2Hops * 2.1));
    const totalHops = leg1Hops + leg2Hops;
    const totalFare = calculateFare(originId, destId, 'bengaluru');

    return {
      isInterchange: true,
      interchangeStationId: 'BLR-GRN-23',
      interchangeStationName: 'Rashtreeya Vidyalaya Road (RV Road)',
      leg1: {
        line: 'yellow',
        lineName: 'Yellow Line',
        lineColor: '#EAB308',
        originId,
        destId: 'BLR-GRN-23',
        direction: leg1Dir,
        directionName: leg1DirName,
        hops: leg1Hops,
        rideMinutes: leg1RideMinutes,
      },
      transfer: {
        stationId: 'BLR-GRN-23',
        stationName: 'Rashtreeya Vidyalaya Road (RV Road)',
        fromLine: 'yellow',
        toLine: 'green',
        fromLevel: 'Level 2 (Yellow Line)',
        toLevel: 'Level 1 (Green Line)',
        walkMinutes: 3,
        instructions: 'Alight at RV Road. Change from Yellow Line platform to Green Line platform via concourse.',
        notice: 'Stay inside paid area • No new ticket or tap-out needed',
      },
      leg2: {
        line: 'green',
        lineName: 'Green Line',
        lineColor: '#10B981',
        originId: 'BLR-GRN-23',
        destId,
        direction: leg2Dir,
        directionName: leg2DirName,
        hops: leg2Hops,
        rideMinutes: leg2RideMinutes,
      },
      totalHops,
      totalRideMinutes: leg1RideMinutes + 3 + leg2RideMinutes,
      totalFare,
    };
  }

  // ================= 2. Purple <-> Green Interchange via Majestic =================
  if (pO !== -1 && gD !== -1) {
    const leg1Hops = Math.abs(pMaj - pO);
    const leg1Dir = pO < pMaj ? 1 : 0;
    const leg1DirName = leg1Dir === 1 ? 'Whitefield (Kadugodi)' : 'Challaghatta';

    const leg2Hops = Math.abs(gD - gMaj);
    const leg2Dir = gD > gMaj ? 0 : 1;
    const leg2DirName = leg2Dir === 0 ? 'Silk Institute' : 'Madavara (BIEC)';

    const leg1RideMinutes = Math.max(2, Math.round(leg1Hops * 2.1));
    const leg2RideMinutes = Math.max(2, Math.round(leg2Hops * 2.1));
    const totalHops = leg1Hops + leg2Hops;
    const totalFare = calculateFare(originId, destId, 'bengaluru');

    return {
      isInterchange: true,
      interchangeStationId: 'BLR-MAJ-15',
      interchangeStationName: 'Nadaprabhu Kempegowda (Majestic)',
      leg1: {
        line: 'purple',
        lineName: 'Purple Line',
        lineColor: '#A855F7',
        originId,
        destId: 'BLR-MAJ-15',
        direction: leg1Dir,
        directionName: leg1DirName,
        hops: leg1Hops,
        rideMinutes: leg1RideMinutes,
      },
      transfer: {
        stationId: 'BLR-MAJ-15',
        stationName: 'Nadaprabhu Kempegowda (Majestic)',
        fromLine: 'purple',
        toLine: 'green',
        fromLevel: 'Level 2 (Purple Line)',
        toLevel: 'Level 3 (Green Line)',
        walkMinutes: 4,
        instructions: 'Alight at Majestic. Change from Purple Line (Level 2) to Green Line (Level 3) via concourse.',
        notice: 'Stay inside paid area • No new ticket or tap-out needed',
      },
      leg2: {
        line: 'green',
        lineName: 'Green Line',
        lineColor: '#10B981',
        originId: 'BLR-MAJ-15',
        destId,
        direction: leg2Dir,
        directionName: leg2DirName,
        hops: leg2Hops,
        rideMinutes: leg2RideMinutes,
      },
      totalHops,
      totalRideMinutes: leg1RideMinutes + 4 + leg2RideMinutes,
      totalFare,
    };
  }

  if (gO !== -1 && pD !== -1) {
    const leg1Hops = Math.abs(gMaj - gO);
    const leg1Dir = gO < gMaj ? 0 : 1;
    const leg1DirName = leg1Dir === 0 ? 'Silk Institute' : 'Madavara (BIEC)';

    const leg2Hops = Math.abs(pD - pMaj);
    const leg2Dir = pD > pMaj ? 1 : 0;
    const leg2DirName = leg2Dir === 1 ? 'Whitefield (Kadugodi)' : 'Challaghatta';

    const leg1RideMinutes = Math.max(2, Math.round(leg1Hops * 2.1));
    const leg2RideMinutes = Math.max(2, Math.round(leg2Hops * 2.1));
    const totalHops = leg1Hops + leg2Hops;
    const totalFare = calculateFare(originId, destId, 'bengaluru');

    return {
      isInterchange: true,
      interchangeStationId: 'BLR-MAJ-15',
      interchangeStationName: 'Nadaprabhu Kempegowda (Majestic)',
      leg1: {
        line: 'green',
        lineName: 'Green Line',
        lineColor: '#10B981',
        originId,
        destId: 'BLR-MAJ-15',
        direction: leg1Dir,
        directionName: leg1DirName,
        hops: leg1Hops,
        rideMinutes: leg1RideMinutes,
      },
      transfer: {
        stationId: 'BLR-MAJ-15',
        stationName: 'Nadaprabhu Kempegowda (Majestic)',
        fromLine: 'green',
        toLine: 'purple',
        fromLevel: 'Level 3 (Green Line)',
        toLevel: 'Level 2 (Purple Line)',
        walkMinutes: 4,
        instructions: 'Alight at Majestic. Change from Green Line (Level 3) to Purple Line (Level 2) via concourse.',
        notice: 'Stay inside paid area • No new ticket or tap-out needed',
      },
      leg2: {
        line: 'purple',
        lineName: 'Purple Line',
        lineColor: '#A855F7',
        originId: 'BLR-MAJ-15',
        destId,
        direction: leg2Dir,
        directionName: leg2DirName,
        hops: leg2Hops,
        rideMinutes: leg2RideMinutes,
      },
      totalHops,
      totalRideMinutes: leg1RideMinutes + 4 + leg2RideMinutes,
      totalFare,
    };
  }

  // ================= 3. Purple <-> Yellow (2 Transfers: Majestic & RV Road) =================
  if (pO !== -1 && yD !== -1) {
    const leg1Hops = Math.abs(pMaj - pO);
    const leg1Dir = pO < pMaj ? 1 : 0;
    const leg1DirName = leg1Dir === 1 ? 'Whitefield (Kadugodi)' : 'Challaghatta';

    const middleHops = Math.abs(gRVR - gMaj); // 7 hops between Majestic & RV Road
    const leg3Hops = Math.abs(yD - yRVR);

    const leg1RideMinutes = Math.max(2, Math.round(leg1Hops * 2.1));
    const middleRideMinutes = Math.round(middleHops * 2.1);
    const leg3RideMinutes = Math.max(2, Math.round(leg3Hops * 2.1));
    const totalHops = leg1Hops + middleHops + leg3Hops;
    const totalFare = calculateFare(originId, destId, 'bengaluru');

    return {
      isInterchange: true,
      isDoubleTransfer: true,
      interchangeStationId: 'BLR-MAJ-15',
      interchangeStationName: 'Majestic & RV Road',
      leg1: {
        line: 'purple',
        lineName: 'Purple Line',
        lineColor: '#A855F7',
        originId,
        destId: 'BLR-MAJ-15',
        direction: leg1Dir,
        directionName: leg1DirName,
        hops: leg1Hops,
        rideMinutes: leg1RideMinutes,
      },
      transfer: {
        stationId: 'BLR-MAJ-15',
        stationName: 'Majestic (Transfer 1) & RV Road (Transfer 2)',
        fromLine: 'purple',
        toLine: 'yellow',
        fromLevel: 'Platform 3/4',
        toLevel: 'Platform 1/2',
        walkMinutes: 7,
        instructions: 'Alight at Majestic for Green Line to RV Road, then switch to Yellow Line.',
        notice: 'Stay inside paid area • Single continuous fare',
      },
      middleLeg: {
        line: 'green',
        lineName: 'Green Line',
        lineColor: '#10B981',
        originId: 'BLR-MAJ-15',
        destId: 'BLR-GRN-23',
        direction: 0,
        directionName: 'Silk Institute (via RV Road)',
        hops: middleHops,
        rideMinutes: middleRideMinutes,
      },
      transfer1: {
        stationId: 'BLR-MAJ-15',
        stationName: 'Majestic',
        walkMinutes: 4,
        toLine: 'green',
        toLineName: 'Green Line',
      },
      transfer2: {
        stationId: 'BLR-GRN-23',
        stationName: 'RV Road',
        walkMinutes: 3,
        toLine: 'yellow',
        toLineName: 'Yellow Line',
      },
      leg2: {
        line: 'yellow',
        lineName: 'Yellow Line',
        lineColor: '#EAB308',
        originId: 'BLR-GRN-23',
        destId,
        direction: 0,
        directionName: 'Delta Electronics Bommasandra',
        hops: leg3Hops,
        rideMinutes: leg3RideMinutes,
      },
      totalHops,
      totalRideMinutes: leg1RideMinutes + 4 + middleRideMinutes + 3 + leg3RideMinutes,
      totalFare,
    };
  }

  if (yO !== -1 && pD !== -1) {
    const leg1Hops = Math.abs(yO - yRVR);
    const leg1Dir = 1; // Towards RV Road
    const leg1DirName = 'Rashtreeya Vidyalaya Road (RV Road)';

    const middleHops = Math.abs(gMaj - gRVR);
    const leg3Hops = Math.abs(pD - pMaj);

    const leg1RideMinutes = Math.max(2, Math.round(leg1Hops * 2.1));
    const middleRideMinutes = Math.round(middleHops * 2.1);
    const leg3RideMinutes = Math.max(2, Math.round(leg3Hops * 2.1));
    const totalHops = leg1Hops + middleHops + leg3Hops;
    const totalFare = calculateFare(originId, destId, 'bengaluru');

    return {
      isInterchange: true,
      isDoubleTransfer: true,
      interchangeStationId: 'BLR-GRN-23',
      interchangeStationName: 'RV Road & Majestic',
      leg1: {
        line: 'yellow',
        lineName: 'Yellow Line',
        lineColor: '#EAB308',
        originId,
        destId: 'BLR-GRN-23',
        direction: leg1Dir,
        directionName: leg1DirName,
        hops: leg1Hops,
        rideMinutes: leg1RideMinutes,
      },
      transfer: {
        stationId: 'BLR-GRN-23',
        stationName: 'RV Road (Transfer 1) & Majestic (Transfer 2)',
        fromLine: 'yellow',
        toLine: 'purple',
        fromLevel: 'Level 2 (Yellow)',
        toLevel: 'Level 1 (Green)',
        walkMinutes: 7,
        instructions: 'Alight at RV Road for Green Line to Majestic, then switch to Purple Line.',
        notice: 'Stay inside paid area • Single continuous fare',
      },
      middleLeg: {
        line: 'green',
        lineName: 'Green Line',
        lineColor: '#10B981',
        originId: 'BLR-GRN-23',
        destId: 'BLR-MAJ-15',
        direction: 1,
        directionName: 'Madavara (via Majestic)',
        hops: middleHops,
        rideMinutes: middleRideMinutes,
      },
      transfer1: {
        stationId: 'BLR-GRN-23',
        stationName: 'RV Road',
        walkMinutes: 3,
        toLine: 'green',
        toLineName: 'Green Line',
      },
      transfer2: {
        stationId: 'BLR-MAJ-15',
        stationName: 'Majestic',
        walkMinutes: 4,
        toLine: 'purple',
        toLineName: 'Purple Line',
      },
      leg2: {
        line: 'purple',
        lineName: 'Purple Line',
        lineColor: '#A855F7',
        originId: 'BLR-MAJ-15',
        destId,
        direction: pD > pMaj ? 1 : 0,
        directionName: pD > pMaj ? 'Whitefield (Kadugodi)' : 'Challaghatta',
        hops: leg3Hops,
        rideMinutes: leg3RideMinutes,
      },
      totalHops,
      totalRideMinutes: leg1RideMinutes + 3 + middleRideMinutes + 4 + leg3RideMinutes,
      totalFare,
    };
  }

  return { isInterchange: false };
}
