# Talk Sphere — Frontend Client 💻

> Modern React 19 + Vite single-page application for the **Talk Sphere** unified real-time collaboration platform.

For full system architecture, backend deployment, API documentation, and testing guides, refer to the [Root README.md](../README.md).

---

## 🛠️ Client Tech Stack

* **UI Framework**: [React 19](https://react.dev/) (`^19.2.5`)
* **Build Tool**: [Vite 8](https://vitejs.dev/) (`^8.0.10`)
* **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) (`^4.2.4`) + PostCSS
* **Icons**: [Lucide React](https://lucide.dev/) (`^1.14.0`)
* **Animations**: [Framer Motion](https://www.framer.com/motion/) (`^12.38.0`)
* **Real-Time Client**: [Socket.io Client](https://socket.io/) (`^4.8.3`)
* **WebRTC**: [Simple-Peer](https://github.com/feross/simple-peer) (`^9.11.1`)
* **Audio Waveforms**: [Wavesurfer.js](https://wavesurfer.xyz/) (`^7.12.7`)
* **Markdown Rendering**: [React Markdown](https://github.com/remarkjs/react-markdown) (`^10.1.0`)
* **Authentication**: [@react-oauth/google](https://www.npmjs.com/package/@react-oauth/google) (`^0.13.5`)

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (`.env`)
Create a `.env` file in this directory:
```env
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
```

### 3. Start Development Server
```bash
npm run dev
```
The client will be running at `http://localhost:5173`.

### 4. Build for Production
```bash
npm run build
npm run preview
```
