import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GTFSEngine } from './gtfsEngine.js';

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

// Initialize GTFS Engine
const engine = new GTFSEngine();
engine.load();

// Load cached GeoJSON files
const tracksGeoJSON = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, 'tracks.geojson'), 'utf8')
);
const stationsGeoJSON = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, 'stations.geojson'), 'utf8')
);

// REST Endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'Kochi Metro 3D Real-Time Backend',
    time: new Date().toISOString(),
  });
});

app.get('/api/trains', (req, res) => {
  const data = engine.getActiveTrains();
  res.json(data);
});

app.get('/api/tracks', (req, res) => {
  res.json(tracksGeoJSON);
});

app.get('/api/stations', (req, res) => {
  res.json(stationsGeoJSON);
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

io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);
  // Immediately send the latest state to newly connected client
  socket.emit('trains:update', lastPayload);

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Process transit data every 5 seconds (Phase 2 Requirement 4)
const BROADCAST_INTERVAL_MS = 5000;
setInterval(() => {
  try {
    const payload = engine.getActiveTrains();
    lastPayload = payload;
    io.emit('trains:update', payload);
  } catch (err) {
    console.error('[Engine Broadcast Error]:', err);
  }
}, BROADCAST_INTERVAL_MS);

server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(` Kochi Metro 3D Real-Time Backend Server Running `);
  console.log(` Port: ${PORT}`);
  console.log(` REST API: http://localhost:${PORT}/api/health`);
  console.log(` WebSocket: ws://localhost:${PORT}`);
  console.log(` Broadcast Frequency: Every 5 seconds`);
  console.log(`===================================================`);
});
