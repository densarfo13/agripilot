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

# Generate Prisma client + build frontend
RUN cd server && npx prisma generate
RUN npx vite build

# Uploads directory
RUN mkdir -p /app/server/uploads

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

WORKDIR /app/server
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && node scripts/init-admin.mjs && node src/server.js"]
