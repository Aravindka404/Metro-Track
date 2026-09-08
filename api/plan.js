import { GTFSEngine } from '../server/gtfsEngine.js';

let cachedEngine = null;

function getEngine() {
  if (!cachedEngine) {
    cachedEngine = new GTFSEngine();
    cachedEngine.load();
  }
  return cachedEngine;
}

export default function handler(req, res) {
  try {
    const { origin, destination, time } = req.query || {};
    const engine = getEngine();
    const departures = engine.getScheduledDepartures(origin, destination, time, 4);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=5');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    return res.status(200).json({
      origin,
      destination,
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
