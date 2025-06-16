
FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Create directory for frontend build files
RUN mkdir -p /app/frontend-build

# Expose port 3000 (mapped to 80 externally)
EXPOSE 3000

CMD ["npm", "start"]
