# Talk Sphere 🌐

> Modern Real-Time Collaboration & Communication Platform with Integrated AI Assistant, WebRTC Audio/Video Calling, and Instant Media Sharing.

[![Node.js](https://img.shields.io/badge/Node.js-v20.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-v5.2.1-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-v19.2.5-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-v8.0.10-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Socket.io](https://img.shields.io/badge/Socket.io-v4.8.3-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)
[![WebRTC](https://img.shields.io/badge/WebRTC-P2P_Mesh-333333?style=for-the-badge&logo=webrtc&logoColor=white)](https://webrtc.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose_v9.6-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-3.6_Flash-4285F4?style=for-the-badge&logo=googlegemini&logoColor=white)](https://ai.google.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.2.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-Media_CDN-3448C5?style=for-the-badge&logo=cloudinary&logoColor=white)](https://cloudinary.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

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

**Talk Sphere** is a unified real-time collaboration and unified communications workspace engineered to bridge synchronous interpersonal interaction and cognitive generative computing. In traditional workflows, users constantly context-switch across disconnected platforms: video conferencing utilities, instant messaging apps, scratchpad editors, and separate browser windows for Large Language Models. 

Talk Sphere resolves this fragmentation by embedding ultra-low-latency peer-to-peer WebRTC audio/video communications, bi-directional reactive socket chat pipelines, persistent multimedia scratchpads, and a native Google Gemini generative AI assistant into a single cohesive interface. Engineered with a clean separation of concerns between an Express 5 REST/Socket gateway and an optimized React 19 single-page application, Talk Sphere delivers sub-50ms message propagation, browser-native audio synthesize signaling cues, and high-throughput server-sent event (SSE) AI streaming.

### Core Objectives
* **Sub-Second Bi-Directional Messaging**: Provide resilient one-on-one and multi-participant group messaging with real-time delivery lifecycle states (`sent`, `delivered`, `read`), typing indicators, emoji reactions, message editing, and soft/hard deletions.
* **Peer-to-Peer Low-Latency Audio & Video Conferencing**: Facilitate browser-native WebRTC mesh connections utilizing STUN NAT traversal with automated SDP offer/answer exchanges, incoming call ringing synthesizers, busy-state detection, and automated persistent call logs.
* **Embedded Multimodal AI Engine**: Integrate Google Gemini (with fallbacks to Groq LPU Llama-3.3) over Server-Sent Events (SSE) to deliver real-time token streaming, contextual coding assistance, chat history persistence, and multi-session AI organization.
* **Multi-Factor & OAuth Security Standards**: Protect user identity and resource isolation via passwordless Email OTP verification (Nodemailer), Google OAuth 2.0 Identity tokens, dual JWT tokens (short-lived access + persistent refresh tokens), and IP-based rate limiting.
* **Cloud-Native Media Pipeline**: Ingest and serve images, video clips, voice memos, and document attachments through Multer and Cloudinary CDN storage with automated MIME type classification and byte-quota enforcement.
* **Productive Collaborative Scratchpads**: Enable users to draft, organize, and directly share persistent notes into active chat rooms with live markdown rendering and audio waveform previews via Wavesurfer.js.

---

## 2. 🏗️ Core Architecture & Technology Roles

The Talk Sphere platform is architected around an asynchronous event-driven model that unifies RESTful request-response patterns with continuous bi-directional WebSocket channels and direct peer-to-peer media topologies.

| Architectural Layer | Component / Technology | Exact Version | Architectural Responsibility & Integration Role |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | `^19.2.5` | Core UI engine managing component lifecycles, virtual DOM reconciliation, and interactive view states. |
| **Build & Tooling** | Vite | `^8.0.10` | Fast development server with Hot Module Replacement (HMR) and optimized Rollup production bundling. |
| **Styling & Design System** | Tailwind CSS & PostCSS | `^4.2.4` | Modern utility-first CSS styling engine providing dark-mode color tokens, responsive breakpoints, and glassmorphism styling. |
| **Motion & Micro-interactions** | Framer Motion | `^12.38.0` | Fluid layout transitions, spring physics for modals, active call overlays, and drawer animations. |
| **Icons & Visual Semantics** | Lucide React | `^1.14.0` | Clean, standardized vector icons across navigation bars, media controls, and status badges. |
| **Real-Time Client Driver** | Socket.io-client | `^4.8.3` | Manages persistent WebSocket/Polling connections, connection retries, event listeners, and room dispatching. |
| **P2P Audio/Video Engine** | Simple-Peer | `^9.11.1` | WebRTC wrapper managing `RTCPeerConnection`, local media streams, STUN configuration, and SDP/ICE payloads. |
| **Audio Waveform Visualizer**| Wavesurfer.js | `^7.12.7` | Client-side audio waveform decoding, scrubbing, and rendering for voice memos and sound clips. |
| **Application Server** | Node.js / Express | `v20.x` / `^5.2.1` | REST API gateway, authentication middleware, error propagation, file ingestion routes, and static handlers. |
| **Signaling & Message Broker**| Socket.io Server | `^4.8.3` | Coordinates online user registries, multi-tab routing, message dispatch, typing signals, and WebRTC SDP/ICE relay. |
| **Primary Database & ODM** | MongoDB / Mongoose | `^9.6.1` | Document persistence engine storing User profiles, Messages, Groups, Notes, AI Chat Sessions, and Refresh Tokens. |
| **Artificial Intelligence Engine**| `@google/generative-ai` | `^0.24.1` | Official Google SDK orchestrating Gemini 3.6 Flash / 3.1 Pro streaming chat, system instructions, and token handling. |
| **Media Cloud Storage** | Cloudinary & Multer Cloudinary | `^1.41.3` / `^4.0.0` | Ingestion, compression, transformations, and global CDN delivery of avatars, photos, videos, and shared documents. |
| **Authentication & Tokens** | JWT & Google Auth Library | `^9.0.3` / `^11.0.2` | Cryptographic access token signing/validation, refresh token revocation, and Google ID token verification. |
| **Security & Rate Limiting**| Express Rate Limit & BCrypt | `^8.5.2` / `^3.0.3` | IP-level request throttling for authentication routes and high-entropy hashing for cryptographic digests. |
| **Transactional Email Engine**| Nodemailer | `^8.0.7` | Secure SMTP transport delivering 6-digit one-time password (OTP) codes with automated expiration. |

---

## 3. 🛠️ Environment Setup Documentation

Before running Talk Sphere locally or deploying to target infrastructure, verify that your environment satisfies the minimum operating system, hardware, and runtime constraints.

### Hardware Prerequisites
* **Processor**: Dual-Core CPU (x86-64 or ARM64) minimum; Quad-Core or higher recommended for running local concurrent builds and WebRTC AV transcoding.
* **System Memory (RAM)**: Minimum 4 GB RAM (8 GB+ recommended when running browser, client Vite server, backend Node instance, and local MongoDB simultaneously).
* **Network & Peripheral Devices**:
  * Broadband internet access (for external STUN servers, Cloudinary uploads, and Google Gemini API).
  * Web camera and integrated/external microphone for WebRTC audio/video validation.
  * Supported open outbound ports: `80`, `443`, `19302` (STUN UDP).

### Operating System Compatibility
* **Windows**: Windows 10 or Windows 11 (PowerShell or Git Bash recommended).
* **macOS**: macOS Monterey (12.x) or higher (Apple Silicon & Intel).
* **Linux**: Ubuntu 20.04 LTS / 22.04 LTS, Debian 11+, or Arch Linux.

### Runtime Verification Table

Execute the following commands in your terminal to confirm your local development toolchain versions:

| Software Component | Minimum Version | Recommended Version | Verification Command | Sample Expected Output |
| :--- | :--- | :--- | :--- | :--- |
| **Node.js** | `v18.18.0` | `v20.x (LTS)` | `node -v` | `v20.18.0` |
| **npm** | `v9.0.0` | `v10.x` | `npm -v` | `10.8.2` |
| **Git** | `v2.30.0` | `v2.40+` | `git --version` | `git version 2.44.0` |
| **MongoDB** | `v6.0.0` | MongoDB Atlas (Cloud) | `mongod --version` (if local) | `db version v7.0.5` |
| **Google Chrome / Chromium** | `v115+` | Latest Stable | `google-chrome --version` | `Google Chrome 128.0.x` |

---

## 4. 🚀 Installation & Deployment Guide

Follow this sequential procedure to clone the repository, configure backend and frontend environments, install package dependencies, and run Talk Sphere.

### Step 1: Clone Repository & Directory Navigation
```bash
# Clone the Talk Sphere repository
git clone https://github.com/raju95yadav/talk-sphere.git

# Navigate into the project root directory
cd talk-sphere
```

### Step 2: Backend Configuration & Environment Setup
Navigate to the `server/` directory and install runtime dependencies:
```bash
cd server
npm install
```

Create a production `.env` file in `server/` with your credentials:
```bash
# Create and edit server/.env
cp .env.example .env 2>/dev/null || touch .env
```

Populate `server/.env` with the following environment variables:
```env
# Server Network Port
PORT=5000

# MongoDB Database Connection String (Local or MongoDB Atlas)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/talksphere?retryWrites=true&w=majority

# JWT Cryptographic Secret Key
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters_long

# CORS Client Base URL
CLIENT_URL=http://localhost:5173

# Nodemailer SMTP Configuration for OTP Delivery
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_16_character_app_password

# Cloudinary CDN Configuration
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Google Gemini Generative AI API Key
GEMINI_API_KEY=your_google_gemini_api_key

# Google OAuth 2.0 Client ID
GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com

# Optional: Groq API Key (for high-speed Llama-3.3 fallback)
GROQ_API_KEY=your_groq_api_key_optional
```

### Step 3: Frontend Configuration & Environment Setup
Open a new terminal window, navigate to the `client/` directory, and install client-side packages:
```bash
cd client
npm install
```

Create `client/.env` to point the frontend to the backend server and Google OAuth service:
```bash
# Create and edit client/.env
touch .env
```

Populate `client/.env` with:
```env
# Backend REST & WebSocket Gateway Endpoint
VITE_API_URL=http://localhost:5000

# Google OAuth 2.0 Web Client ID (Must match backend GOOGLE_CLIENT_ID)
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
```

### Step 4: Launching Concurrent Development Services

#### Option A: Running in Two Terminal Windows (Recommended)
**Terminal 1 (Backend Server):**
```bash
cd server
npm run dev
# Server initializes on http://localhost:5000 with nodemon live reload
```

**Terminal 2 (Frontend Client):**
```bash
cd client
npm run dev
# Vite client initializes on http://localhost:5173
```

#### Option B: Building for Production Deployment
When preparing Talk Sphere for production hosting (e.g., Render, Railway, AWS EC2, VPS):
```bash
# 1. Build optimized static assets in client/
cd client
npm run build

# 2. Start the Express production server
cd ../server
npm start
```

---

## 5. 🔐 Authentication & Real-Time Communication Flow

### End-to-End System Architecture & Signaling Diagram

```
+----------------------------------------------------------------------------------------------------+
|                                      TALK SPHERE SYSTEM ARCHITECTURE                               |
+----------------------------------------------------------------------------------------------------+

     [ Client A Browser ]                                                   [ Client B Browser ]
   (React 19 / Simple-Peer)                                               (React 19 / Simple-Peer)
         |            |                                                         |            |
         |            |                                                         |            |
   (1) HTTPS/REST     |                                                   (1) HTTPS/REST     |
     Auth & OTP       |                                                     Auth & OTP       |
         |            |                                                         |            |
         v            v                                                         v            v
+-----------------------------+                                           +-----------------------------+
|    Express 5 API Gateway    |                                           |    Express 5 API Gateway    |
|   - Rate Limiting           |                                           |   - Rate Limiting           |
|   - JWT Issue & Verify      |                                           |   - JWT Issue & Verify      |
|   - Multer / Cloudinary     |                                           |   - Multer / Cloudinary     |
+-----------------------------+                                           +-----------------------------+
         |            |                                                         |            |
         |      (2) WebSocket Handshake                                         |      (2) WebSocket Handshake
         |       (auth.token verified)                                          |       (auth.token verified)
         |            |                                                         |            |
         |            +--------------------> [ Socket.io Engine ] <-------------+            |
         |                                   - User Socket Maps                              |
         |                                   - Room Dispatches                               |
         |                                   - Active Call Registry                          |
         |                                              |                                    |
         |               (3) WebRTC Signaling Relay     |                                    |
         |        +-------------------------------------+----------------------------------+ |
         |        |  a. call_user -> incoming_call {signal: SDP Offer, callType}           | |
         |        |  b. answer_call -> call_accepted {signal: SDP Answer}                  | |
         |        |  c. ice_candidate -> ice_candidate {candidate}                         | |
         |        |  d. end_call / reject_call / call_timeout (35s timer)                  | |
         |        +------------------------------------------------------------------------+ |
         |                                                                                   |
         | (4) AI Query / Stream                                                             |
         v                                                                                   |
+--------------------------+                                                                 |
|   Google Gemini AI       |                                                                 |
|   (3.6 Flash / 3.1 Pro)  |                                                                 |
|   Server-Sent Events     |                                                                 |
+--------------------------+                                                                 |
         |                                                                                   |
         v                                                                                   v
+----------------------------------------------------------------------------------------------------+
|                               (5) Direct Peer-to-Peer WebRTC Media Stream                          |
|                     [ Client A ] <=================================> [ Client B ]                  |
|                                    STUN (stun.l.google.com:19302)                                  |
|                                    Direct Encrypted Audio / Video Flow                             |
+----------------------------------------------------------------------------------------------------+
```

### Detailed Flow Breakdown

#### 1. Authentication Handshake & OTP Verification Flow
1. **Request Phase**: The user submits their email address to `POST /api/auth/request-otp`. The backend rate-limiter verifies that the IP has not exceeded 5 requests in 15 minutes.
2. **OTP Dispatch**: A cryptographically random 6-digit code is generated with a 5-minute time-to-live (TTL) and transmitted to the user's inbox via Nodemailer SMTP.
3. **Verification Phase**: The user submits the code to `POST /api/auth/verify-otp`. Upon validation, the server signs:
   - A short-lived **JWT Access Token** containing the user ID and email.
   - A long-lived **Refresh Token** persisted in MongoDB (`RefreshToken` model).
4. **Google OAuth 2.0 Alternative**: Users can authenticate via Google Sign-In button; the client exchanges the Google Credential JWT with `POST /api/auth/google`, which validates token integrity via `google-auth-library` and auto-provisions user records.

#### 2. Socket.io Connection & Room Multiplexing
1. **Handshake Verification**: When establishing a WebSocket connection, `io.use()` extracts the JWT from `socket.handshake.auth.token` or authorization headers, rejecting untrusted origins.
2. **Multi-Tab Session Registry**: The server records `onlineUsers.set(userId, Set<socketId>)`. When the set count transitions from 0 to 1, the user is marked `isOnline: true`, broadcasting `user_status_change` to all connected clients.
3. **Group Room Aggregation**: The server automatically queries all group memberships for the user and assigns the socket to corresponding room channels (`socket.join('group_' + groupId)`).
4. **Auto-Delivery Relay**: Any pending messages with status `sent` addressed to the user are automatically updated to `delivered`, notifying the original sender in real-time.

#### 3. WebRTC Peer-to-Peer Audio/Video Signaling Pipeline
1. **Call Initiation**: Client A requests media devices (`navigator.mediaDevices.getUserMedia`) and instantiates a `Simple-Peer` initiator instance configured with Google STUN servers (`stun:stun.l.google.com:19302`).
2. **SDP Offer Generation**: Simple-Peer outputs an SDP offer payload. Client A emits `call_user` over Socket.io, including target user ID, SDP payload, caller name, caller avatar, and `callType` (`'audio'` or `'video'`).
3. **Busy Check & Ringing Timer**: The server checks its in-memory `activeCalls` map. If the target is busy, it returns `user_busy`. Otherwise, it provisions a **35-second ringing timeout** and emits `incoming_call` to Client B.
4. **Synthesizer Cue**: Client B receives `incoming_call` and immediately triggers the `RingtoneSynth` Web Audio API class, playing a synthetic repeating chime.
5. **Answer & SDP Exchange**: When Client B clicks "Accept", their client initializes a non-initiator `Simple-Peer` instance with the incoming signal, generating an SDP answer emitted via `answer_call`.
6. **Connection Established & Timeout Cleared**: The server clears the 35-second timeout, logs call status, and relays `call_accepted` to Client A. The direct P2P mesh channel binds, streaming encrypted audio/video directly between browsers without routing media through the backend server.
7. **Automated Call Duration Logging**: When either peer triggers `end_call`, the server calculates the elapsed time, generates a persistent `callDetails` record in MongoDB, and broadcasts the formatted log to both participants' chat threads.

#### 4. AI Assistant Contextual Inquiry & Server-Sent Events (SSE)
1. **User Prompt Dispatch**: The client sends a POST request with current prompt, selected model (`gemini-3.6-flash`, `gemini-3.1-pro-preview`, or `groq-llama3`), and prior conversation context to `/api/ai/stream`.
2. **Streaming Pipeline**: The backend sets `Content-Type: text/event-stream` and initializes `@google/generative-ai` `startChat()` with system instructions instructing clean Markdown and code formatting.
3. **Token Yield**: The server calls `sendMessageStream(message)` and pipes each generated text chunk over SSE (`data: {"chunk": "..."}\n\n`).
4. **Client-Side Progressive Rendering**: The frontend reader consumes chunks progressively, rendering Markdown and code syntax highlights via `react-markdown` in real-time.
5. **Session Synchronization**: Complete message exchanges are synchronized with the MongoDB `AISession` model for cross-device retrieval.

---

## 6. 📡 API Reference & Testing Documentation

All authenticated endpoints require an `Authorization` header formatted as:
```http
Authorization: Bearer <YOUR_JWT_ACCESS_TOKEN>
```

### 1. Authentication Endpoints

#### Request Login / Registration OTP
* **Endpoint**: `POST /api/auth/request-otp`
* **Rate Limit**: Max 5 requests per 15 minutes per IP
* **Description**: Dispatches a 6-digit one-time code to the specified email address.

```bash
curl -X POST http://localhost:5000/api/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "alex.engineer@example.com"}'
```

**Response (`200 OK`)**:
```json
{
  "message": "OTP sent successfully to your email"
}
```

---

#### Verify OTP & Obtain Session Tokens
* **Endpoint**: `POST /api/auth/verify-otp`
* **Rate Limit**: Max 10 attempts per 15 minutes per IP
* **Description**: Validates the 6-digit OTP and generates access and refresh tokens.

```bash
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alex.engineer@example.com",
    "otp": "849201",
    "name": "Alex Engineer"
  }'
```

**Response (`200 OK`)**:
```json
{
  "_id": "65f2a1b9c8e1a2001e4a1001",
  "name": "Alex Engineer",
  "email": "alex.engineer@example.com",
  "avatar": "https://res.cloudinary.com/denockmbz/image/upload/v1/avatar.png",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "d290f1ee-6c54-4b01-90e6-d701748f0851"
}
```

---

#### Refresh Expired Access Token
* **Endpoint**: `POST /api/auth/refresh-token`
* **Description**: Exchanges a valid refresh token for a newly signed access token.

```bash
curl -X POST http://localhost:5000/api/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "d290f1ee-6c54-4b01-90e6-d701748f0851"}'
```

**Response (`200 OK`)**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new_token_payload..."
}
```

---

### 2. Chat & Media Transmission Endpoints

#### Upload Media File to Cloudinary
* **Endpoint**: `POST /api/chat/upload`
* **Content-Type**: `multipart/form-data`
* **Size Limit**: 10 MB maximum

```bash
curl -X POST http://localhost:5000/api/chat/upload \
  -H "Authorization: Bearer <TOKEN>" \
  -F "file=@/path/to/diagram.png"
```

**Response (`200 OK`)**:
```json
{
  "url": "https://res.cloudinary.com/denockmbz/image/upload/v1710102030/chat_media/diagram.png",
  "type": "image",
  "name": "diagram.png",
  "size": "1.42 MB"
}
```

---

#### Retrieve Chat Conversation List
* **Endpoint**: `GET /api/chat/conversations`
* **Description**: Returns all users with whom the authenticated user has exchanged messages, alongside latest message snapshots and unread counts.

```bash
curl -X GET http://localhost:5000/api/chat/conversations \
  -H "Authorization: Bearer <TOKEN>"
```

**Response (`200 OK`)**:
```json
[
  {
    "_id": "65f2a1b9c8e1a2001e4a1002",
    "name": "Sarah Connor",
    "username": "sarah_c",
    "avatar": "https://res.cloudinary.com/denockmbz/avatar2.jpg",
    "isOnline": true,
    "lastMessage": {
      "content": "The architecture diagram looks great!",
      "createdAt": "2026-09-10T14:32:00.000Z",
      "status": "read"
    },
    "unreadCount": 0
  }
]
```

---

#### Fetch Direct Chat Message History
* **Endpoint**: `GET /api/chat/history/:receiverId`
* **Description**: Returns chronological direct messages between the current user and `:receiverId`.

```bash
curl -X GET http://localhost:5000/api/chat/history/65f2a1b9c8e1a2001e4a1002 \
  -H "Authorization: Bearer <TOKEN>"
```

**Response (`200 OK`)**:
```json
[
  {
    "_id": "65f2a2f0c8e1a2001e4a1010",
    "sender": "65f2a1b9c8e1a2001e4a1001",
    "receiver": "65f2a1b9c8e1a2001e4a1002",
    "content": "Hey Sarah, have you checked the new WebRTC signaling flow?",
    "type": "text",
    "status": "read",
    "reactions": [
      {
        "user": "65f2a1b9c8e1a2001e4a1002",
        "emoji": "👍"
      }
    ],
    "createdAt": "2026-09-10T14:30:15.000Z"
  }
]
```

---

### 3. Artificial Intelligence Assistant Endpoints

#### AI Service Health & Model Discovery
* **Endpoint**: `GET /api/ai/ping`
* **Description**: Tests AI controller connectivity, validates API keys, and returns available models.

```bash
curl -X GET http://localhost:5000/api/ai/ping \
  -H "Authorization: Bearer <TOKEN>"
```

**Response (`200 OK`)**:
```json
{
  "status": "online",
  "timestamp": "2026-09-10T14:35:00.000Z",
  "apiKeyConfigured": true,
  "groqConfigured": false,
  "availableModels": [
    {
      "id": "gemini-3.6-flash",
      "name": "Gemini 3.6 Flash",
      "provider": "Google",
      "default": true
    },
    {
      "id": "gemini-3.1-pro-preview",
      "name": "Gemini 3.1 Pro",
      "provider": "Google"
    },
    {
      "id": "gemini-3.5-flash",
      "name": "Gemini 3.5 Flash",
      "provider": "Google"
    }
  ]
}
```

---

#### Stream Generative AI Response (Server-Sent Events)
* **Endpoint**: `POST /api/ai/stream`
* **Accept**: `text/event-stream`
* **Description**: Streams token-by-token generative output from Google Gemini.

```bash
curl -N -X POST http://localhost:5000/api/ai/stream \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Explain WebRTC ICE candidates in two concise sentences.",
    "model": "gemini-3.6-flash",
    "history": []
  }'
```

**SSE Stream Output (`200 OK`)**:
```http
data: {"chunk":"ICE (Interactive Connectivity "}

data: {"chunk":"Establishment) candidates represent potential IP "}

data: {"chunk":"addresses and port pairs that two peers can use to "}

data: {"chunk":"connect directly across firewalls and NATs.\n\n"}

data: {"chunk":"They are discovered using STUN or TURN servers and "}

data: {"chunk":"exchanged via signaling to find the most direct transmission path."}

data: [DONE]
```

---

#### Manage AI Chat Sessions (MongoDB CRUD)
* **List Sessions**: `GET /api/ai/sessions`
* **Create Session**: `POST /api/ai/sessions`
* **Update Session**: `PUT /api/ai/sessions/:id`
* **Delete Session**: `DELETE /api/ai/sessions/:id`

```bash
# Create new AI session
curl -X POST http://localhost:5000/api/ai/sessions \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "WebRTC Architecture Notes",
    "modelPreference": "gemini-3.6-flash",
    "messages": [
      {"role": "user", "content": "How do STUN servers work?"},
      {"role": "assistant", "content": "STUN servers discover public IP:Port bindings."}
    ]
  }'
```

---

### 4. Group Collaboration Endpoints

* **Create Group**: `POST /api/groups` (JSON payload with `name`, `description`, `members[]`)
* **Get My Groups**: `GET /api/groups`
* **Fetch Group Messages**: `GET /api/groups/:groupId/messages`
* **Add Group Members**: `POST /api/groups/:groupId/members`
* **Update Member Role**: `PATCH /api/groups/:groupId/members/:memberId/role` (`'admin'` or `'member'`)

---

### 5. Notes Scratchpad Endpoints

* **List User Notes**: `GET /api/notes`
* **Create Note**: `POST /api/notes` (`title`, `content`, `tags`, `color`)
* **Update Note**: `PUT /api/notes/:id`
* **Delete Note**: `DELETE /api/notes/:id`
* **Share Note to Chat**: `POST /api/notes/share/:id` (`receiverId` or `groupId`)

---

## 7. 🧪 Testing & Verification

A robust validation routine ensures seamless operation across WebSockets, WebRTC mesh topologies, and generative AI streams.

### Testing Commands

```bash
# 1. Lint the frontend codebase for syntax and hook rule conformity
cd client
npm run lint

# 2. Verify frontend production compilation
npm run build

# 3. Test backend REST API connectivity
curl -I http://localhost:5000/
# Expected: HTTP/1.1 200 OK ("Talk Sphere API is running")

# 4. Verify AI controller connectivity and Gemini API key
curl -X GET http://localhost:5000/api/ai/ping \
  -H "Authorization: Bearer <VALID_ACCESS_TOKEN>"
# Expected: "apiKeyConfigured": true
```

### Comprehensive Quality Checklist

* [x] **Authentication & Session Lifecycle**:
  * [x] Email OTP request triggers email delivery within < 5 seconds.
  * [x] OTP verification successfully provisions JWT access and refresh tokens.
  * [x] Invalid or expired OTPs return standard error message with HTTP `400`.
  * [x] Google OAuth login parses token, syncs profile picture, and generates authenticated session.
  * [x] Expired access tokens automatically refresh via `/api/auth/refresh-token` interceptor in Axios.
* [x] **Real-Time Direct & Group Chat**:
  * [x] Socket connection executes handshake with JWT authorization parameter.
  * [x] Status progression transitions smoothly: `sent` (single tick) $\rightarrow$ `delivered` (double tick) $\rightarrow$ `read` (blue double tick).
  * [x] Typing indicators broadcast to receiver with debounce termination.
  * [x] Direct messages support emoji reactions, editing, and deletion ("delete for me" vs "delete for everyone").
  * [x] Multi-participant groups properly route messages to all active room subscribers.
* [x] **WebRTC Audio & Video Calling**:
  * [x] User initiates call $\rightarrow$ socket emits `call_user` with SDP payload.
  * [x] Receiver device rings with synthetic Web Audio API chime.
  * [x] Target user receives "Busy" notification if already engaged in an active call.
  * [x] Unanswered calls terminate automatically after 35 seconds and log a "Missed Call" in the message log.
  * [x] Accepted calls establish direct P2P audio/video stream through STUN server.
  * [x] Mute audio and disable video controls dynamically disable local MediaStream tracks without severing connection.
  * [x] Call teardown records duration (e.g., `Video Call • 4m 12s`) in persistent database records.
* [x] **Artificial Intelligence Assistant**:
  * [x] SSE streaming outputs tokens progressively without buffering blocks.
  * [x] Code blocks render with syntax styling and one-click copy functionality.
  * [x] AI sessions persist across browser page reloads in MongoDB.
  * [x] Model switching between Gemini 3.6 Flash, 3.1 Pro, and Groq preserves session continuity.
* [x] **Media & Notes Pipelines**:
  * [x] Cloudinary uploads enforce 10 MB limit and reject oversized files.
  * [x] Audio voice memos render dynamic interactive waveforms via Wavesurfer.js.
  * [x] Notes created in the scratchpad can be shared directly into any active chat room.

---

## 8. 💻 Live Demonstration Guide

Follow this guided testing script using two browser windows (or one standard and one incognito window) to verify all Talk Sphere features.

### Phase 1: Dual-User Onboarding & Session Setup
1. Open Google Chrome at `http://localhost:5173` (**Client A - Alex**).
2. Open Chrome Incognito or Microsoft Edge at `http://localhost:5173` (**Client B - Sarah**).
3. Log in to **Client A** using your primary email address and complete OTP verification.
4. Log in to **Client B** using a second test email address or Google Sign-In.
5. In **Client A**, search for Client B's email or username in the contact search bar and click **Add Contact**.
6. Verify that both users display green **Online** status indicators in real-time.

### Phase 2: Instant Messaging, Typing & Media Transmission
1. In Client A, select Sarah's conversation thread and type `"Hello Sarah, testing Talk Sphere!"`.
2. Notice the instant `sent` status indicator.
3. Switch to Client B's screen: the message is received instantaneously, triggering a `delivered` status update on Client A's screen.
4. Click on the input box in Client B and begin typing. Verify that Client A displays `"Sarah is typing..."`.
5. Attach an image or PDF using the paperclip attachment icon. Verify that the file uploads to Cloudinary and renders in both chat views with file size tags.
6. Hover over a message and click the 😀 reaction button to add a reaction (e.g., ❤️ or 👍). Confirm real-time synchronization.

### Phase 3: WebRTC Audio/Video Call Demonstration
1. In Client A's chat window, click the **Video Call** icon in the top header.
2. Grant camera and microphone permissions when prompted by your browser.
3. Observe Client B's screen: an animated incoming call modal appears accompanied by an audio ringtone.
4. On Client B, click **Accept**.
5. Observe the WebRTC connection establish: both local and remote video streams render in real-time.
6. Test toggling the **Mute Microphone** and **Disable Camera** buttons; confirm that media track states update smoothly on the peer's screen.
7. Click **End Call**. Verify that both windows return to the chat view and an automated call log message (e.g., `Video Call • 18s`) is added to the chat history.

### Phase 4: Generative AI Assistant Interaction
1. Click the **AI Assistant** tab in the sidebar navigation.
2. Ensure the model dropdown is set to **Gemini 3.6 Flash**.
3. Submit a prompt: `"Write an Express 5 middleware function that logs HTTP request execution times in milliseconds."`
4. Observe the response stream in real-time with syntax-highlighted JavaScript code blocks.
5. Click the **Copy Code** button and verify that the snippet is saved to your clipboard.
6. Create a new AI session titled `"Backend Optimization"` and confirm that past sessions remain accessible in the session drawer.

### Phase 5: Scratchpad Notes & Broadcast Sharing
1. Navigate to the **Notes** section in the navigation menu.
2. Click **New Note**, enter the title `"Sprint Goals"`, add bullet points, and select a color theme (e.g., Indigo).
3. Click **Share Note**, choose your chat thread with Sarah, and click **Send**.
4. Switch to the Chat view: the note is embedded directly into the conversation as a rich collaborative card.

---

## 9. 🎓 Academic & Project Information

### Developer & Author Information
* **Lead Engineer & Architect**: **Raju Yadav**
* **GitHub**: [@raju95yadav](https://github.com/raju95yadav)
* **Project Repository**: [talk-sphere](https://github.com/raju95yadav/talk-sphere)
* **Contact Email**: [rajuggvsky@gmail.com](mailto:rajuggvsky@gmail.com)

### Institutional Scope & Academic Purpose
Talk Sphere was developed as a capstone engineering project demonstrating modern full-stack web engineering, distributed real-time messaging, WebRTC peer-to-peer audio/video streaming, and applied generative artificial intelligence. 

The project showcases production-level patterns including:
* Event-driven WebSocket architectures with multi-tab connection deduplication.
* Resilient WebRTC peer negotiation handling network address translation (NAT) and STUN fallback.
* Asynchronous Server-Sent Events (SSE) streaming with Google Gemini AI.
* Multi-tier defense-in-depth security incorporating rate limiting, email OTP verification, and JWT lifecycle revocation.

### Acknowledgments & Mentorship
* Special thanks to academic mentors, advisors, and peer code reviewers for guidance on real-time systems design and distributed state synchronization.
* Gratitude to the open-source maintainers of WebRTC, Socket.io, React, and Google Generative AI for providing robust foundational tools.

### License
This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for complete details. You are free to modify, distribute, and build upon this software with appropriate attribution.

---

<p align="center">
  <sub>Built with ❤️ by Raju Yadav for real-time collaboration.</sub>
</p>
