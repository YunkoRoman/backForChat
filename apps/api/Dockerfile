# Multi-stage Dockerfile for NestJS API
# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace files
COPY package.json package-lock.json ./

# Copy app source
COPY apps/api ./apps/api

# Install all dependencies (including dev deps for build)
RUN npm ci --workspace=api

# Build the application
WORKDIR /app/apps/api
RUN npm run build

# Runtime stage
FROM node:22-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy package files from builder
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/apps/api/package.json ./apps/api/

# Copy the built app and its dependencies from builder. npm workspaces
# hoists everything into the ROOT node_modules - apps/api/node_modules
# doesn't exist (confirmed by actually running `npm ci --workspace=api`
# against this exact build context outside Docker, since this environment's
# Docker daemon can't reach its configured registry proxy to verify via a
# real `docker build`); copying it would fail the build on a missing path.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Change ownership to non-root user
RUN chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/v1', (r) => { if (r.statusCode !== 200) throw new Error(r.statusCode) })"

ENTRYPOINT ["/sbin/dumb-init", "--"]
CMD ["node", "apps/api/dist/main.js"]
