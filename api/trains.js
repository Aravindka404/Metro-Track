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
    const city = (req.query?.city || 'kochi').toLowerCase();
    let data;

    if (city === 'bengaluru' || city === 'bangalore') {
      const engine = getBangaloreEngine();
      data = engine.getActiveTrains();
    } else {
      const engine = getKochiEngine();
      data = engine.getActiveTrains();
    }

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

