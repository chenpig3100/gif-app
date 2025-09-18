FROM node:20-bookworm

# install ffmpeg
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# create app directory
WORKDIR /app

# copy package files and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# copy app source code
COPY . .

# create necessary directories
RUN mkdir -p uploads outputs data

# set environment variables and start the app
ENV NODE_ENV=production
EXPOSE 3000

# start the app
CMD ["node", "src/app.js"]