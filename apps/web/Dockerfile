# Multi-stage Dockerfile for React + Vite frontend
# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace files
COPY package.json package-lock.json ./

# Copy app source
COPY apps/web ./apps/web

# Install all dependencies
RUN npm ci --workspace=web

# Build the application with API URL build arg
ARG VITE_API_URL=http://localhost:3000/api/v1
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app/apps/web
RUN npm run build

# Runtime stage using nginx
FROM nginx:alpine

# Copy nginx configuration
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Create a simple nginx config that serves the SPA
RUN cat > /etc/nginx/conf.d/default.conf <<EOF
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html index.htm;

    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css text/javascript application/javascript application/json;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Serve index.html for all non-file requests (SPA routing)
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Don't log favicon and robots
    location = /favicon.ico {
        log_not_found off;
        access_log off;
    }
    location = /robots.txt {
        log_not_found off;
        access_log off;
    }
}
EOF

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q -O- http://localhost/index.html | grep -q "<!doctype html>" || exit 1
