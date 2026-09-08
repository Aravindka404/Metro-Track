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
    const engine = getEngine();
    const data = engine.getActiveTrains();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=2, stale-while-revalidate=1');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('[API /api/trains] Error:', err);
    return res.status(500).json({
      error: 'Failed to calculate train positions',
      message: err.message,
    });
  }
}
