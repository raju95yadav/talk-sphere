# ==============================================================================
# TalkSphere Backend Dockerfile - Production Multi-Stage Container
# ==============================================================================

FROM node:22-alpine AS base

# Install curl for container health checks
RUN apk add --no-cache curl

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy application source code
COPY . .

# Set container environment defaults
ENV NODE_ENV=production
ENV PORT=5000

# Security hardening: Run as unprivileged node user
USER node

EXPOSE 5000

# Container liveness health check
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://127.0.0.1:5000/api/health || exit 1

CMD ["node", "index.js"]

