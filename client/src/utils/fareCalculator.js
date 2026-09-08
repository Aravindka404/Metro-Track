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

// Normalize ID variations (e.g., TRPN -> TPHT)
export function normalizeStationId(id) {
  if (!id) return '';
  const upper = id.toUpperCase();
  if (upper === 'TRPN') return 'TPHT';
  return upper;
}

export function getStationIndex(stationId) {
  const norm = normalizeStationId(stationId);
  return KMRL_STATION_IDS.indexOf(norm);
}

/**
 * Direction between two stations:
 * 0: Southbound (Towards Tripunithura)
 * 1: Northbound (Towards Aluva)
 * null: Same station or invalid
 */
export function getTripDirection(originId, destId) {
  const oIdx = getStationIndex(originId);
  const dIdx = getStationIndex(destId);
  if (oIdx === -1 || dIdx === -1 || oIdx === dIdx) return null;
  return dIdx > oIdx ? 0 : 1;
}

/**
 * Station count / hops between two stations
 */
export function getStationHopCount(originId, destId) {
  const oIdx = getStationIndex(originId);
  const dIdx = getStationIndex(destId);
  if (oIdx === -1 || dIdx === -1) return 0;
  return Math.abs(dIdx - oIdx);
}

/**
 * Official Kochi Metro Fare Calculation
 * Based on KMRL distance / station count slabs
 */
export function calculateKochiMetroFare(originId, destId) {
  const hops = getStationHopCount(originId, destId);
  if (hops === 0) return 0;
  if (hops <= 2) return 10;
  if (hops <= 5) return 20;
  if (hops <= 9) return 30;
  if (hops <= 14) return 40;
  if (hops <= 19) return 50;
  return 60;
}

/**
 * Estimated travel time in minutes based on ~2.2 minutes average per station
 */
export function estimateRideDurationMinutes(originId, destId) {
  const hops = getStationHopCount(originId, destId);
  if (hops === 0) return 0;
  return Math.max(2, Math.round(hops * 2.2));
}
