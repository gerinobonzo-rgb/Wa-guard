FROM node:22-bookworm-slim AS base

WORKDIR /app

# Install deps first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts \
    && npm cache clean --force

COPY src ./src
COPY config.json ./config.json

# Session, warning-store, and log data live outside the image so they survive
# rebuilds — see docker-compose.yml volumes. Create the dirs so the app can
# write to them even before a volume is mounted (e.g. first `docker build`
# smoke test without compose).
RUN mkdir -p /app/auth_info /app/data \
    && addgroup --system --gid 1001 wa-guard \
    && adduser --system --uid 1001 --gid 1001 --home /app wa-guard \
    && chown -R wa-guard:wa-guard /app

USER wa-guard

ENV NODE_ENV=production

# No network port is exposed — this bot only makes outbound connections to
# WhatsApp's servers, it doesn't run a server of its own.

CMD ["node", "src/index.js"]
