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
