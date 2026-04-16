FROM node:20-slim
WORKDIR /app

RUN apt-get update -y && apt-get install -y \
  openssl \
  chromium \
  fonts-liberation \
  libgbm1 \
  libnss3 \
  --no-install-recommends && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package*.json ./
RUN npm install --omit=dev

COPY . .
RUN npx prisma generate

EXPOSE 3333

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node src/server.js"]
