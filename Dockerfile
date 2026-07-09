# Debian-based image (not Alpine) so prebuilt native binaries (better-sqlite3)
# and Puppeteer's bundled Chromium both work without extra fuss.
FROM node:20-bookworm-slim

# System libraries Chromium needs to actually launch headless, for the
# WhatsApp automation feature (whatsapp-web.js -> puppeteer). Also installs
# python3/make/g++ as a fallback in case a native module ever needs to
# compile from source instead of using a prebuilt binary.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates wget gnupg fonts-liberation \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 \
    libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libglib2.0-0 libgtk-3-0 \
    libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 \
    libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 \
    libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \
    lsb-release xdg-utils python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first so this layer is cached unless package files change
COPY package.json package-lock.json ./
RUN npm ci

# Now copy the rest of the source and build
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Schema creation + first-run admin/doctor seeding happens automatically on
# startup (see lib/db.ts + lib/seed.ts) once DATABASE_PATH points at your
# mounted Railway volume - no separate setup command needed here.
CMD ["npm", "start"]
