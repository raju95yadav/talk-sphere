# Talk Sphere 🌐

> Modern Real-Time Collaboration & Communication Platform with Integrated AI Assistant, WebRTC Audio/Video Calling, and Instant Media Sharing.

[![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=flat&logo=socketdotio&logoColor=white)](https://socket.io/)
[![WebRTC](https://img.shields.io/badge/WebRTC-333333?style=flat&logo=webrtc&logoColor=white)](https://webrtc.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Gemini AI](https://img.shields.io/badge/Gemini_AI-4285F4?style=flat&logo=googlegemini&logoColor=white)](https://ai.google.dev/)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-3448C5?style=flat&logo=cloudinary&logoColor=white)](https://cloudinary.com/)

---

## 📋 Table of Contents

1. [🌟 Project Overview](#1-🌟-project-overview)
2. [🏗️ Core Architecture & Technology Roles](#2-🏗️-core-architecture--technology-roles)
3. [🛠️ Environment Setup Documentation](#3-🛠️-environment-setup-documentation)
4. [🚀 Installation & Deployment Guide](#4-🚀-installation--deployment-guide)
5. [🔐 Authentication & Real-Time Communication Flow](#5-🔐-authentication--real-time-communication-flow)
6. [📡 API Reference & Testing Documentation](#6-📡-api-reference--testing-documentation)
7. [🧪 Testing & Verification](#7-🧪-testing--verification)
8. [💻 Live Demonstration Guide](#8-💻-live-demonstration-guide)
9. [🎓 Academic & Project Information](#9-🎓-academic--project-information)

---

## 1. 🌟 Project Overview

**Talk Sphere** is an all-in-one real-time workspace combining direct messaging, peer-to-peer audio/video calls, multimedia sharing, and an embedded generative AI assistant. It eliminates tab-switching by unifying collaboration and AI assistance into a single clean dashboard.

### Core Objectives
* **Instant Messaging**: Real-time 1-on-1 and group chat with status ticks (`sent`, `delivered`, `read`), typing indicators, and emoji reactions.
* **Low-Latency Calls**: Peer-to-peer WebRTC voice & video calling with STUN NAT traversal, ringing audio, and automated call history logs.
* **Smart AI Assistant**: Streaming Google Gemini 3.6 Flash / 3.1 Pro assistant with Markdown formatting, code previews, and persistent chat sessions.
* **Robust Auth**: Passwordless Email OTP (Nodemailer), Google OAuth 2.0, dual JWT tokens, and IP rate limiting.
* **Rich Media Pipeline**: Seamless Cloudinary media uploads (images, videos, voice memos, files) with byte limits.
* **Interactive Notes**: Built-in collaborative scratchpad with direct one-click sharing into chat rooms.

---

## 2. 🏗️ Core Architecture & Technology Roles

| Layer | Technology | Version | Role & Responsibility |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | `^19.2.5` | Reactive UI state, component hierarchy, and rendering. |
| **Build Tooling** | Vite | `^8.0.10` | High-speed dev server with HMR and production bundling. |
| **Styling** | Tailwind CSS & PostCSS | `^4.2.4` | Dark mode styling, responsive layouts, and glassmorphism. |
| **UI Motion** | Framer Motion | `^12.38.0` | Modal springs, call sheet overlays, and drawer transitions. |
| **Icons** | Lucide React | `^1.14.0` | Unified vector icons across dashboard and media controls. |
| **Real-Time Client** | Socket.io-client | `^4.8.3` | Manages live WebSocket channels and room events. |
| **P2P Audio/Video** | Simple-Peer | `^9.11.1` | WebRTC peer connections, STUN handling, and media streams. |
| **Audio Waveforms** | Wavesurfer.js | `^7.12.7` | Interactive waveform rendering for voice recordings. |
| **Application Server** | Node.js / Express | `v20.x` / `^5.2.1` | REST endpoints, auth middleware, and static asset delivery. |
| **Signaling Engine** | Socket.io Server | `^4.8.3` | User mapping, room multiplexing, and WebRTC SDP/ICE relay. |
| **Database & ODM** | MongoDB / Mongoose | `^9.6.1` | Document storage for Users, Messages, Groups, Notes, and AI Chats. |
| **Generative AI** | `@google/generative-ai` | `^0.24.1` | Google Gemini 3.6 Flash streaming chat integration. |
| **Media Cloud CDN** | Cloudinary & Multer | `^1.41.3` | Secure storage and global delivery of chat attachments. |
| **Auth & Tokens** | JWT & Google Auth | `^9.0.3` / `^11.0.2` | Access/refresh token lifecycle and Google ID token validation. |
| **Rate Limiting** | Express Rate Limit | `^8.5.2` | Protects auth endpoints against brute-force attacks. |
| **Mail Dispatch** | Nodemailer | `^8.0.7` | Delivers 6-digit email OTP codes for passwordless sign-in. |

---

## 3. 🛠️ Environment Setup Documentation

### System Requirements
* **OS**: Windows 10/11, macOS 12+, or Ubuntu 20.04+.
* **Hardware**: Dual-Core CPU, 4 GB RAM (8 GB recommended), mic & webcam for WebRTC.
* **Network**: Broadband internet with open UDP ports for STUN (`19302`).

### Version Verification Table

| Tool | Min Version | Recommended | Verification Command | Sample Output |
| :--- | :--- | :--- | :--- | :--- |
| **Node.js** | `v18.18.0` | `v20.x (LTS)` | `node -v` | `v20.18.0` |
| **npm** | `v9.0.0` | `v10.x` | `npm -v` | `10.8.2` |
| **Git** | `v2.30.0` | `v2.40+` | `git --version` | `git version 2.44.0` |
| **MongoDB** | `v6.0.0` | MongoDB Atlas | `mongod --version` | `db version v7.0.5` |
| **Chrome / Edge** | `v115+` | Latest Stable | `google-chrome --version` | `Google Chrome 128.0` |

---

## 4. 🚀 Installation & Deployment Guide

### 1. Clone the Project
```bash
git clone https://github.com/raju95yadav/talk-sphere.git
cd talk-sphere
```

### 2. Backend Setup (`server/`)
```bash
cd server
npm install
```

Create `server/.env`:
```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/talksphere
JWT_SECRET=your_jwt_secret_key_min_32_chars
CLIENT_URL=http://localhost:5173
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

### 3. Frontend Setup (`client/`)
```bash
cd ../client
npm install
```

Create `client/.env`:
```env
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

### 4. Run Development Servers
* **Terminal 1 (Backend)**:
  ```bash
  cd server && npm run dev
  ```
* **Terminal 2 (Frontend)**:
  ```bash
  cd client && npm run dev
  ```
Access client at `http://localhost:5173` and server at `http://localhost:5000`.

---

## 5. 🔐 Authentication & Real-Time Communication Flow

### Architecture Diagram

```
+-----------------------------------------------------------------------------------------+
|                               TALK SPHERE COMMUNICATION FLOW                            |
+-----------------------------------------------------------------------------------------+

    [ Client A ]                                                           [ Client B ]
  (React 19 / Peer)                                                      (React 19 / Peer)
        |                                                                      |
        |--- (1) REST Auth / OTP / Google OAuth -----------------------------> |
        |                                                                      |
        +---------------------------> [ Express 5 Server ] <-------------------+
        |                               (Socket.io Engine)                     |
        |                               - User Online Registry                 |
        |                               - Room Routing                         |
        |                               - Active Calls (35s timer)             |
        |                                      |                               |
        | <--- (2) WebRTC Signaling Relay ----+---- (2) WebRTC Signaling Relay |
        |      - call_user (SDP Offer)              - incoming_call            |
        |      - call_accepted (SDP Answer)         - answer_call              |
        |      - ice_candidate                      - ice_candidate            |
        |                                                                      |
        | <============ (3) Direct P2P Media Stream (STUN Traversal) ========> |
        |                                                                      |
        +--- (4) POST /api/ai/stream ---> [ Google Gemini API ] (SSE Chunks) --+
```

### Flow Highlights
1. **Auth & Tokens**: User requests 6-digit OTP $\rightarrow$ Nodemailer sends email $\rightarrow$ User submits OTP $\rightarrow$ Server issues Access & Refresh JWTs.
2. **Socket Session**: Socket connects with JWT header $\rightarrow$ joins personal user room & group channels $\rightarrow$ pending messages auto-delivered.
3. **WebRTC Calling**: Caller emits `call_user` with SDP offer $\rightarrow$ Server checks busy state & starts 35s timer $\rightarrow$ Callee plays synthetic chime $\rightarrow$ Callee clicks accept $\rightarrow$ SDP answer returned $\rightarrow$ direct encrypted P2P media stream binds.
4. **AI Streaming**: Client posts prompt to `/api/ai/stream` $\rightarrow$ Gemini yields tokens over Server-Sent Events (SSE) $\rightarrow$ React streams Markdown and code live.

---

## 6. 📡 API Reference & Testing Documentation

Headers for protected endpoints:
```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

### 1. Authentication
* `POST /api/auth/request-otp` — Send 6-digit login code.
* `POST /api/auth/verify-otp` — Verify code & return `{ token, refreshToken, user }`.
* `POST /api/auth/refresh-token` — Exchange refresh token for fresh access token.
* `POST /api/auth/google` — Sign in via Google OAuth credential token.

```bash
# Request OTP
curl -X POST http://localhost:5000/api/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "alex@example.com"}'

# Verify OTP
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "alex@example.com", "otp": "123456", "name": "Alex"}'
```

---

### 2. Chat & Media
* `POST /api/chat/upload` — Upload image, video, audio, or document to Cloudinary (Max 10MB).
* `GET /api/chat/conversations` — Fetch active conversation summaries with unread counts.
* `GET /api/chat/history/:receiverId` — Fetch message log with reactions and call records.
* `POST /api/chat/contacts` — Add user to contact list.
* `GET /api/chat/call-logs` — Retrieve call history and durations.

```bash
# Upload attachment
curl -X POST http://localhost:5000/api/chat/upload \
  -H "Authorization: Bearer <TOKEN>" \
  -F "file=@demo.png"
```

---

### 3. AI Assistant
* `GET /api/ai/ping` — Check AI service status & supported models.
* `POST /api/ai/stream` — Stream generative responses via Server-Sent Events (SSE).
* `GET /api/ai/sessions` — List user's saved AI chats.
* `POST /api/ai/sessions` — Save or create a new AI conversation session.

```bash
# Stream AI response
curl -N -X POST http://localhost:5000/api/ai/stream \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"message": "What is WebRTC?", "model": "gemini-3.6-flash"}'
```

---

### 4. Groups & Notes
* `POST /api/groups` — Create a new group (`name`, `members[]`).
* `GET /api/groups/:groupId/messages` — Fetch group conversation history.
* `GET /api/notes` — Fetch personal notes.
* `POST /api/notes/share/:id` — Share a note directly into a chat room.

---

## 7. 🧪 Testing & Verification

### Quick Health Checks
```bash
# Lint frontend
cd client && npm run lint

# Build frontend bundle
npm run build

# Check backend health
curl -I http://localhost:5000/

# Verify Gemini AI key
curl -X GET http://localhost:5000/api/ai/ping -H "Authorization: Bearer <TOKEN>"
```

### Verification Checklist
* [x] **Auth**: OTP arrives in inbox within 5s; invalid OTP returns 400 error.
* [x] **Chat**: Real-time tick lifecycle (`sent` $\rightarrow$ `delivered` $\rightarrow$ `read`).
* [x] **Typing**: Instant `"typing..."` indicators with auto-debounce.
* [x] **Calls**: 35-second unanswered call timeout; busy status for occupied users.
* [x] **Audio/Video**: Seamless mic mute, camera toggle, and direct P2P streaming.
* [x] **AI**: Progressive token streaming with one-click code copying.
* [x] **Uploads**: Cloudinary rejects files exceeding 10 MB limit.

---

## 8. 💻 Live Demonstration Guide

Test full functionality with two browser windows (Standard & Incognito):

1. **Sign In**: Log into Client A (Alex) and Client B (Sarah) at `http://localhost:5173`.
2. **Online Status**: Add Sarah as a contact $\rightarrow$ verify real-time green online dot.
3. **Messaging**: Send `"Hi Sarah"` $\rightarrow$ verify instantaneous delivery and read ticks.
4. **Attachments**: Send an image via paperclip $\rightarrow$ verify live Cloudinary preview.
5. **Video Call**: Click the video icon $\rightarrow$ verify Client B rings with audio $\rightarrow$ click Accept $\rightarrow$ verify two-way video stream $\rightarrow$ click End Call to see call log.
6. **AI Chat**: Open AI Assistant $\rightarrow$ ask `"Generate a quick React hook"` $\rightarrow$ watch code stream live $\rightarrow$ click Copy Code.
7. **Notes**: Open Notes $\rightarrow$ write `"Sprint Checklist"` $\rightarrow$ click Share Note to send into chat.

---

## 9. 🎓 Academic & Project Information

* **Developer**: **Raju Yadav** ([@raju95yadav](https://github.com/raju95yadav))
* **Repository**: [raju95yadav/talk-sphere](https://github.com/raju95yadav/talk-sphere)
* **Contact**: [rajuggvsky@gmail.com](mailto:rajuggvsky@gmail.com)
* **Project Scope**: Capstone engineering project demonstrating full-stack real-time architecture, WebRTC P2P media streaming, and applied generative AI.
* **Acknowledgments**: Thanks to mentors, reviewers, and the open-source communities behind React, Socket.io, WebRTC, and Google Gemini.

---

<p align="center">
  <sub>Built with ❤️ by Raju Yadav for real-time collaboration.</sub>
</p>
