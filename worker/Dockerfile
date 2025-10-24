FROM node:18-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV PORT=4000 \
    AWS_REGION=ap-southeast-2

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD curl -f http://localhost:4000/healthz || exit 1

EXPOSE 4000
CMD ["node", "index.js"]