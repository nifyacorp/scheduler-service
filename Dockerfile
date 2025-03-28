FROM node:18-slim

WORKDIR /app

# Set build arguments
ARG BUILD_TIMESTAMP
ARG COMMIT_SHA
ARG DEPLOYMENT_ID

# Set as environment variables
ENV BUILD_TIMESTAMP=${BUILD_TIMESTAMP}
ENV COMMIT_SHA=${COMMIT_SHA}
ENV DEPLOYMENT_ID=${DEPLOYMENT_ID}

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 8080

CMD ["node", "src/index.js"]