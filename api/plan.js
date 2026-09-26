import { GTFSEngine } from '../server/gtfsEngine.js';
import { BangaloreEngine } from '../server/bangaloreEngine.js';

let cachedKochiEngine = null;
let cachedBangaloreEngine = null;

function getKochiEngine() {
  if (!cachedKochiEngine) {
    cachedKochiEngine = new GTFSEngine();
    cachedKochiEngine.load();
  }
  return cachedKochiEngine;
}

function getBangaloreEngine() {
  if (!cachedBangaloreEngine) {
    cachedBangaloreEngine = new BangaloreEngine();
    cachedBangaloreEngine.load();
  }
  return cachedBangaloreEngine;
}

export default function handler(req, res) {
  try {
    const { origin, destination, time, city } = req.query || {};
    const currentCity = (city || 'kochi').toLowerCase();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=5');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (currentCity === 'bengaluru' || currentCity === 'bangalore') {
      const engine = getBangaloreEngine();
      const departures = engine.getScheduledDepartures(origin, destination, time, 4);
      return res.status(200).json({
        origin,
        destination,
        city: 'bengaluru',
        queryTime: time || 'now',
        departures,
      });
    }

    const engine = getKochiEngine();
    const departures = engine.getScheduledDepartures(origin, destination, time, 4);
    return res.status(200).json({
      origin,
      destination,
      city: 'kochi',
      queryTime: time || 'now',
      departures,
    });
  } catch (err) {
    console.error('[API /api/plan] Error:', err);
    return res.status(500).json({
      error: 'Failed to calculate schedule plan',
      message: err.message,
    });
  }
}

