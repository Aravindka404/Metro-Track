# Production Multi-Stage Dockerfile for Kochi Metro Real-Time Tracker
FROM node:20-alpine AS builder

WORKDIR /app

# Copy client dependencies and install
COPY client/package*.json ./client/
RUN cd client && npm ci

# Copy client source and build production bundle
COPY client/ ./client/
RUN cd client && npm run build

# Runtime Stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copy server dependencies and install production only
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy server code and static transit data
COPY server/ ./server/
COPY data/ ./data/

# Copy compiled frontend from builder
COPY --from=builder /app/client/dist ./client/dist

EXPOSE 4000
ENV PORT=4000

CMD ["node", "server/index.js"]
