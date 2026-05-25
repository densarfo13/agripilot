FROM node:20-alpine
WORKDIR /app

# Frontend deps (ignore postinstall — server/ not copied yet)
COPY package*.json ./
RUN npm install --ignore-scripts

# Server deps
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

# Copy all source
COPY . .

# ─── Build-metadata fallback ─────────────────────────────────
# scripts/deploy/deploy-railway.mjs writes BUILD_SHA + BUILD_TIMESTAMP
# at the repo root before `railway up`, so when the `COPY . .` above
# runs they land at /app/BUILD_SHA and /app/BUILD_TIMESTAMP and the
# runtime resolver in server/src/config/productionRuntime.js reads
# them via FARROWAY_BUILD_SHA_FILE / FARROWAY_BUILD_TIMESTAMP_FILE.
#
# Fallback shim: if a developer or CI runs `docker build` directly
# (bypassing the deploy script), the files are missing. Write
# placeholder values so the runtime can still report "unknown"
# instead of failing. The placeholder is "unknown" not a fake SHA
# so /api/health makes the absence visible to operators.
RUN if [ ! -f /app/BUILD_SHA ]; then echo "unknown" > /app/BUILD_SHA; fi && \
    if [ ! -f /app/BUILD_TIMESTAMP ]; then date -u +"%Y-%m-%dT%H:%M:%SZ" > /app/BUILD_TIMESTAMP; fi
ENV FARROWAY_BUILD_SHA_FILE=/app/BUILD_SHA
ENV FARROWAY_BUILD_TIMESTAMP_FILE=/app/BUILD_TIMESTAMP

# Generate Prisma client + build intelligence TS + build frontend
RUN cd server && npx prisma generate
RUN cd server/intelligence && npx tsc --project tsconfig.json && cp -r lib dist/lib
RUN npx vite build

# Uploads directory
RUN mkdir -p /app/server/uploads

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

WORKDIR /app
CMD ["sh", "-c", "node scripts/prisma-deploy-with-baseline.mjs && cd server && node scripts/init-admin.mjs && node src/server.js"]
# NOTE: init-admin.mjs only creates admin if not exists. Set FORCE_ADMIN_RESET=1 to overwrite password once.
