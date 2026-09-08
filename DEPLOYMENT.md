# Kochi Metro Real-Time Web Tracker — Deployment Guide

This project is configured as a unified full-stack application. Express serves both the REST API, Socket.io real-time engine, and the compiled Vite React frontend from a single port with zero CORS or mixed-content issues.

---

## Option 1: Render.com (Recommended — 100% Free, Zero Credit Card Required)

Render provides free hosting for Node.js Web Services with free automatic SSL (`https://...`).

### Step 1: Push Code to GitHub
1. Create a new repository on [GitHub](https://github.com/new) (e.g. `kochi-metro-tracker`).
2. Run in your terminal:
   ```bash
   git remote add origin https://github.com/<your-username>/kochi-metro-tracker.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Deploy on Render
1. Go to [dashboard.render.com](https://dashboard.render.com) and click **New +** ➔ **Web Service**.
2. Connect your GitHub repository.
3. Configure the service:
   - **Name**: `kochi-metro-tracker`
   - **Region**: `Singapore` (closest to India for lowest latency)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: 
     ```bash
     npm install --prefix server && npm install --prefix client && npm run build --prefix client
     ```
   - **Start Command**: 
     ```bash
     node server/index.js
     ```
   - **Instance Type**: `Free`
4. Click **Deploy Web Service**.
5. Once built, your live URL will be active (e.g. `https://kochi-metro-tracker.onrender.com`).

*(Alternatively, connect the repository and Render will automatically detect the included `render.yaml` blueprint).*

---

## Option 2: Railway.app (1-Click Deployment)

1. Go to [railway.app](https://railway.app/) and click **New Project** ➔ **Deploy from GitHub repo**.
2. Select your repository.
3. Railway will automatically detect the `Dockerfile` and build both frontend and backend into a production container.
4. Click **Settings** ➔ **Networking** ➔ **Generate Domain** to get a public URL (`https://...up.railway.app`).

---

## Option 3: Fly.io (Global Edge Deployment)

1. Install the flyctl CLI:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```
2. Run in the project directory:
   ```bash
   fly launch
   fly deploy
   ```

---

## Option 4: Deploy on Any Linux VPS / Docker Host

To run with Docker on any VPS (DigitalOcean, AWS, GCP, Hetzner, Linode):

```bash
# 1. Build the Docker image
docker build -t kochi-metro-tracker .

# 2. Run the container
docker run -d -p 4000:4000 --name metro kochi-metro-tracker
```
Access at `http://your-server-ip:4000`.
