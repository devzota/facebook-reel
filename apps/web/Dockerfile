# Stage 1: Build Frontend Vite Application
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy root & workspaces package files
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/

RUN npm install --legacy-peer-deps

# Copy frontend source
COPY apps/web ./apps/web

WORKDIR /usr/src/app/apps/web

# Build production bundle
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy built assets to Nginx html directory
COPY --from=builder /usr/src/app/apps/web/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
