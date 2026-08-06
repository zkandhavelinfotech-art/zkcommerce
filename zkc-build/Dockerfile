# ZKCommerce v4.1 API — Docker
FROM node:20-alpine

WORKDIR /app

# Install deps
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Copy API source
COPY api/ ./api/
COPY database/ ./database/
COPY .env.example .env.example

# Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S zkapi -u 1001
USER zkapi

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "api/server.js"]
