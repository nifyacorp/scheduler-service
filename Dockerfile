FROM node:20-slim

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose the port the app runs on
EXPOSE 8081

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8081

# Run the application
CMD ["node", "src/index.js"]