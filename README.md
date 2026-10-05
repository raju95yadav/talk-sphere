# Talk Sphere
> A unified real-time collaboration workspace featuring peer-to-peer WebRTC audio/video calling, instant messaging with media sharing, and streaming generative AI assistance.

---

## 📋 Table of Contents
1. [Project Overview](#-project-overview)
2. [Core Architecture & Technology Roles](#-core-architecture--technology-roles)
3. [Environment Setup Documentation](#-environment-setup-documentation)
4. [Installation & Deployment Guide](#-installation--deployment-guide)
5. [Key Feature & Real-Time Flows](#-key-feature--real-time-flows)
6. [API Reference](#-api-reference)
7. [Testing & Verification](#-testing--verification)
8. [Live Demonstration Guide](#-live-demonstration-guide)
9. [Project Information](#-project-information)

---

## 🌐 Project Overview
Talk Sphere is a full-stack, real-time collaboration application that merges private and group messaging, low-latency audio/video calling, and an AI assistant into a single cohesive interface. Built to eliminate context switching, the platform allows users to chat, initiate direct encrypted WebRTC calls, share rich multimedia, and consult generative AI without leaving the active session.

* **Instant Messaging & Presence**: Real-time 1-on-1 and group chats with typing indicators, delivery ticks (`sent`, `delivered`, `read`), and emoji reactions.
* **Native WebRTC Calling**: Low-latency peer-to-peer voice and video calls powered by Google STUN servers, complete with call timers, device switching, and persistent call logs.
* **Streaming AI Assistant**: Multi-turn conversational intelligence powered by Google Gemini with Server-Sent Events (SSE) token streaming, markdown formatting, and session persistence.
* **Multi-Device & Hybrid Auth**: Passwordless email OTP via Nodemailer, Google OAuth 2.0, dual-token JWT lifecycle, and WhatsApp-style QR code device linking.

---

## 🏗️ Core Architecture & Technology Roles

| Category | Technology | Role in Talk Sphere |
| :--- | :--- | :--- |
| **Frontend UI** | React 19 (`^19.2.5`) | Reactive single-page interface, real-time state hooks, and audio/video stream rendering |
| **Build System** | Vite 8 (`^8.0.10`) | Ultra-fast development server, HMR, and production asset bundling |
| **Styling** | Tailwind CSS 4 (`^4.2.4`) | High-performance modern utility styling, dark/light theme tokens, and glassmorphism |
| **UI Motion** | Framer Motion (`^12.38.0`) | Smooth layout transitions, spring animations, floating call PiP overlays, and modals |
| **Icons** | Lucide React (`^1.14.0`) | Clean, accessible vector iconography across all dashboard panels |
| **Backend Server** | Node.js & Express 5 (`^5.2.1`) | RESTful API routing, JWT authentication middleware, rate limiting, and business logic |
| **Real-Time Engine** | Socket.io (`^4.8.3`) | Bidirectional WebSocket channels for presence, message dispatch, typing, and signaling |
| **P2P Audio/Video** | WebRTC & Simple-Peer (`^9.11.1`) | Direct peer-to-peer media streaming, ICE candidate negotiation, and STUN NAT traversal |
| **Database** | MongoDB & Mongoose (`^9.6.1`) | Document persistence for Users, Messages, Conversations, Groups, Call Logs, and Notes |
| **Generative AI** | Google Gemini (`@google/generative-ai` `^0.24.1`) | Streaming AI chat responses via Server-Sent Events (SSE) with chat history retention |
| **Cloud Storage** | Cloudinary & Multer | File, image, audio note, and video attachment processing with secure CDN delivery |
| **Authentication** | JWT & Google Auth Library (`^11.0.2`) | Access/Refresh token security, Google ID token verification, and QR device pairing |
| **Email Dispatch** | Nodemailer (`^8.0.7`) | SMTP email delivery for one-time verification passwords (OTP) |

---

## ⚙️ Environment Setup Documentation

### Prerequisites & Requirements

| Component | Minimum Version | Recommended | Default Port / Service |
| :--- | :--- | :--- | :--- |
| **Node.js** | `v18.18.0` | `v20.x (LTS)` | Runtime Environment |
| **npm** | `v9.0.0` | `v10.x` | Package Manager |
| **MongoDB** | `v6.0.0` | MongoDB Atlas | Port `27017` or Cloud URI |
| **Backend API** | Node.js / Express | Port `5000` | `http://localhost:5000` |
| **Frontend Client** | Vite Dev Server | Port `5173` | `http://localhost:5173` |
| **Web Browser** | Chrome 115+, Edge 115+, Firefox 115+, Safari 16+ | Camera & Mic permissions enabled for WebRTC |

---

## 🚀 Installation & Deployment Guide

### 1. Clone the Repository
```bash
git clone https://github.com/raju95yadav/talk-sphere.git
cd talk-sphere
```

### 2. Configure Environment Variables

Create `server/.env`:
```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/talksphere
JWT_SECRET=your_jwt_secret_min_32_characters_long
CLIENT_URL=http://localhost:5173
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

Create `client/.env`:
```env
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

### 3. Install Dependencies & Launch

```bash
# Terminal 1: Backend
cd server
npm install
npm run dev

# Terminal 2: Frontend
cd client
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 🔄 Key Feature & Real-Time Flows

```
+---------------------------------------------------------------------------------------+
|                               TALK SPHERE REAL-TIME FLOWS                             |
+---------------------------------------------------------------------------------------+

  [ Client A (Sender) ]               [ Express & Socket.io ]          [ Client B (Receiver) ]
           |                                     |                                |
  (1) AUTH & SESSION                             |                                |
           |----- POST /api/auth/verify-otp ---->| (Issues JWT Access/Refresh)    |
           |----- Socket Connect with Token ---->| (Joined to personal Room ID)   |
           |                                     |                                |
  (2) INSTANT MESSAGING                          |                                |
           |----- send_message (payload) ------->|                                |
           |                                     |------ receive_message -------->|
           |<---- message_sent (tick) -----------|<----- message_delivered -------|
           |                                     |                                |
  (3) WEBRTC P2P AUDIO/VIDEO CALL                |                                |
           |----- call_user (SDP Offer) -------->|                                |
           |                                     |------ incoming_call ---------->|
           |                                     |<----- answer_call (SDP Ans) ---|
           |<---- call_accepted -----------------|                                |
           |                                                                      |
           |<================ [ Direct P2P Media Stream (STUN) ] ================>|
           |                                                                      |
  (4) STREAMING AI ASSISTANT                     |                                |
           |----- POST /api/ai/stream ---------->|                                |
           |                                     |---> [ Google Gemini API ]      |
           |<==== SSE Stream Chunks (Markdown) ==|                                |
```

---

## 📡 API Reference

All protected endpoints require the header:
```http
Authorization: Bearer <ACCESS_TOKEN>
```

### Authentication
* `POST /api/auth/request-otp` — Request 6-digit email sign-in code
* `POST /api/auth/verify-otp` — Verify code & receive token pair
* `POST /api/auth/google` — Sign in with Google OAuth ID token

```bash
# Request OTP
curl -X POST http://localhost:5000/api/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'

# Verify OTP
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "otp": "123456", "name": "User"}'
```

### Messaging & Media
* `POST /api/chat/upload` — Upload media/files to Cloudinary (Max: 10MB)
* `GET /api/chat/conversations` — Fetch active conversation summaries with unread counters
* `GET /api/chat/history/:receiverId` — Retrieve chat history between users
* `GET /api/chat/call-logs` — Retrieve real-time voice and video call logs

```bash
# Upload media attachment
curl -X POST http://localhost:5000/api/chat/upload \
  -H "Authorization: Bearer <TOKEN>" \
  -F "file=@screenshot.png"

# Fetch call logs
curl -X GET http://localhost:5000/api/chat/call-logs \
  -H "Authorization: Bearer <TOKEN>"
```

### AI Assistant
* `POST /api/ai/stream` — Stream generative responses via Server-Sent Events (SSE)
* `GET /api/ai/sessions` — Fetch saved AI conversation threads

```bash
# Stream AI completion
curl -N -X POST http://localhost:5000/api/ai/stream \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"message": "Explain WebRTC ICE candidates in 2 lines.", "model": "gemini-2.5-flash"}'
```

### Groups
* `POST /api/groups` — Create a new group room
* `GET /api/groups/:groupId/messages` — Fetch group message thread

```bash
# Create group
curl -X POST http://localhost:5000/api/groups \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Engineering Team", "members": ["USER_ID_1", "USER_ID_2"]}'
```

---

## 🧪 Testing & Verification

### Build & Code Quality Commands
```bash
# Lint frontend codebase
cd client && npm run lint

# Compile production bundle
npm run build

# Verify backend health status
curl -I http://localhost:5000/

# Test Gemini AI connection
curl -X GET http://localhost:5000/api/ai/ping -H "Authorization: Bearer <TOKEN>"
```

### Quick Verification Checklist
* [x] **Signaling & Calls**: Direct WebRTC call connects with audio/video and registers in real-time call logs without refresh.
* [x] **Responsive Mobile Layout**: Chat sections, action sheets, and video controls fit within 100% viewport width without horizontal scrolling.
* [x] **Message Status**: Real-time tick transition (`sent` $\rightarrow$ `delivered` $\rightarrow$ `read`).
* [x] **AI Streaming**: Responses stream incrementally with Markdown syntax formatting.

---

## 💻 Live Demonstration Guide

Follow these 4 steps to verify the entire platform workflow using two browser windows (Standard & Incognito):

1. **User Authentication**:
   - Open `http://localhost:5173` on Window 1 and Window 2.
   - Enter your email address to receive an instant 6-digit OTP (or use Google Sign-In) to log in as two distinct accounts.
2. **Direct & Group Chat**:
   - Add the second account from the contacts panel.
   - Send messages back and forth: confirm instant delivery ticks (`sent` $\rightarrow$ `delivered` $\rightarrow$ `read`), real-time typing indicators, and attachments via Cloudinary.
3. **WebRTC Audio & Video Calling**:
   - Click the **Phone** or **Video** icon in the chat header.
   - Observe the incoming ringing screen on Window 2. Accept the call to establish an encrypted, direct P2P audio/video stream. Test mute, camera flip, floating PiP, and ending the call to verify real-time call logging.
4. **AI Assistant & Notes Integration**:
   - Switch to the **AI Assistant** tab and send a coding prompt. Watch tokens stream live with copyable code blocks.
   - Switch to **Notes**, create a quick collaborative note, and share it directly into your chat conversation with one click.

---

## ℹ️ Project Information

* **Developer**: **Raju Yadav** ([@raju95yadav](https://github.com/raju95yadav))
* **Repository**: [raju95yadav/talk-sphere](https://github.com/raju95yadav/talk-sphere)
* **Architecture**: Full-Stack MERN + Native WebRTC + Socket.io + Google Gemini Generative AI
* **Status**: Production-ready, fully responsive with dark & light themes.

---

<p align="center">
  <sub>Built with ❤️ by Raju Yadav for seamless real-time communication and AI collaboration.</sub>
</p>
