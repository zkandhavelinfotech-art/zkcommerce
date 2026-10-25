# ZKCommerce v4.1 — Production Dockerfile (Railway compatible)
# Does NOT copy .env files — all secrets come from Railway env vars
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json ./
RUN npm install --omit=dev

# Copy application source only
COPY api/ ./api/
COPY database/ ./database/
COPY assets/ ./assets/

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S zkapi -u 1001 && \
    chown -R zkapi:nodejs /app
USER zkapi

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

CMD ["node", "api/server.js"]
