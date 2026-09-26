import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GTFSEngine } from './gtfsEngine.js';
import { BangaloreEngine } from './bangaloreEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');

const PORT = process.env.PORT || 4000;
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Initialize Kochi GTFS Engine
const engine = new GTFSEngine();
engine.load();

// Initialize Bengaluru Metro Engine
const bangaloreEngine = new BangaloreEngine();
bangaloreEngine.load();

// Load cached GeoJSON files for Kochi
const tracksGeoJSON = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, 'tracks.geojson'), 'utf8')
);
const stationsGeoJSON = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, 'stations.geojson'), 'utf8')
);

// Load cached GeoJSON files for Bengaluru
const bangaloreTracksGeoJSON = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, 'bengaluru/tracks.geojson'), 'utf8')
);
const bangaloreStationsGeoJSON = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, 'bengaluru/stations.geojson'), 'utf8')
);

// REST Endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'Project Metro Radar Backend (Kochi & Bengaluru)',
    time: new Date().toISOString(),
  });
});

app.get('/api/trains', (req, res) => {
  const city = (req.query.city || 'kochi').toLowerCase();
  if (city === 'bengaluru' || city === 'bangalore') {
    return res.json(bangaloreEngine.getActiveTrains());
  }
  const data = engine.getActiveTrains();
  res.json(data);
});

app.get('/api/tracks', (req, res) => {
  const city = (req.query.city || 'kochi').toLowerCase();
  if (city === 'bengaluru' || city === 'bangalore') {
    return res.json(bangaloreTracksGeoJSON);
  }
  res.json(tracksGeoJSON);
});

app.get('/api/stations', (req, res) => {
  const city = (req.query.city || 'kochi').toLowerCase();
  if (city === 'bengaluru' || city === 'bangalore') {
    return res.json(bangaloreStationsGeoJSON);
  }
  res.json(stationsGeoJSON);
});

app.get('/api/plan', (req, res) => {
  const { origin, destination, time, city } = req.query;
  const currentCity = (city || 'kochi').toLowerCase();
  if (currentCity === 'bengaluru' || currentCity === 'bangalore') {
    const departures = bangaloreEngine.getScheduledDepartures(origin, destination, time, 4);
    return res.json({
      origin,
      destination,
      city: 'bengaluru',
      queryTime: time || 'now',
      departures,
    });
  }
  const departures = engine.getScheduledDepartures(origin, destination, time, 4);
  res.json({
    origin,
    destination,
    city: 'kochi',
    queryTime: time || 'now',
    departures,
  });
});

// Serve static client production build if available
const CLIENT_DIST = path.resolve(__dirname, '../client/dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    }
    next();
  });
}

// Socket.io real-time connection
let lastPayload = engine.getActiveTrains();
let lastBangalorePayload = bangaloreEngine.getActiveTrains();

io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);
  // Immediately send the latest state for both cities
  socket.emit('trains:update', lastPayload);
  socket.emit('trains:update:kochi', lastPayload);
  socket.emit('trains:update:bengaluru', lastBangalorePayload);

  socket.on('city:select', (cityName) => {
    const c = (cityName || 'kochi').toLowerCase();
    if (c === 'bengaluru' || c === 'bangalore') {
      const blr = bangaloreEngine.getActiveTrains();
      socket.emit('trains:update:bengaluru', blr);
    } else {
      const kch = engine.getActiveTrains();
      socket.emit('trains:update:kochi', kch);
      socket.emit('trains:update', kch);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Process transit data every 5 seconds
const BROADCAST_INTERVAL_MS = 5000;
setInterval(() => {
  try {
    const payload = engine.getActiveTrains();
    lastPayload = payload;
    io.emit('trains:update', payload);
    io.emit('trains:update:kochi', payload);

    const blrPayload = bangaloreEngine.getActiveTrains();
    lastBangalorePayload = blrPayload;
    io.emit('trains:update:bengaluru', blrPayload);
  } catch (err) {
    console.error('[Engine Broadcast Error]:', err);
  }
}, BROADCAST_INTERVAL_MS);

server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`     Kochi Metro Radar Server Running            `);
  console.log(` Port: ${PORT}`);
  console.log(` REST API: http://localhost:${PORT}/api/health`);
  console.log(` WebSocket: ws://localhost:${PORT}`);
  console.log(` Broadcast Frequency: Every 5 seconds`);
  console.log(`===================================================`);
});
