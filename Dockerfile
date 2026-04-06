# ─── AgriPilot Docker Production Image ──────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx vite build

FROM node:20-alpine AS production
WORKDIR /app

# Copy server
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

COPY server/ ./server/

# Copy built frontend
COPY --from=frontend-build /app/dist ./dist

# Generate Prisma client
RUN cd server && npx prisma generate

# Create uploads directory
RUN mkdir -p /app/server/uploads

WORKDIR /app/server

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# Run migrations then start server
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && node src/server.js"]
