FROM node:18-alpine

# ffmpeg powers the media relay (WebSocket → ffmpeg → YouTube RTMP, data-plane).
RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package.json ./

RUN npm install --omit=dev

COPY . .

EXPOSE 3001

CMD ["node", "src/index.js"]
