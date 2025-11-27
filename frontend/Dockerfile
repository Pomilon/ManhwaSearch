# frontend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package definitions
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy frontend source code
COPY . .

# Expose the Express server port
EXPOSE 3000

CMD ["node", "server.js"]
