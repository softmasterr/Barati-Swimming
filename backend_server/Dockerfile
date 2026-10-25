# ====================================================================
# Dockerfile - Barati Swimming Academy Cloud Backend Server
# Node.js LTS 22 Alpine Multi-Stage Optimized Image
# ====================================================================

FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# ====================================================================
# Production Runtime Stage
# ====================================================================
FROM node:22-alpine AS runner

WORKDIR /app

# Create unprivileged user for security hardening
RUN addgroup -S -g 1001 nodejs && \
    adduser -S -u 1001 -G nodejs barati

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/barati.db

# Copy production node_modules from builder
COPY --from=builder --chown=barati:nodejs /app/node_modules ./node_modules
COPY --chown=barati:nodejs package*.json ./
COPY --chown=barati:nodejs server.js ./
COPY --chown=barati:nodejs src ./src
COPY --chown=barati:nodejs public ./public

# Create data directory for SQLite persistence and grant ownership to barati user
RUN mkdir -p /app/data && chown -R barati:nodejs /app/data

# Switch to unprivileged non-root user
USER barati

# Expose HTTP port
EXPOSE 3000

# Continuous Container Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Launch Server
CMD ["node", "server.js"]
