
# Multi-stage build for React/Vite frontend
FROM node:18-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY bun.lockb ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# This stage just outputs the built files to a volume
FROM alpine:latest as frontend-dist
WORKDIR /dist
COPY --from=builder /app/dist .
CMD ["sh", "-c", "cp -r /dist/* /output/ && tail -f /dev/null"]
