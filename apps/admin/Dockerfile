FROM node:22-alpine AS base
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

ENV PORT=3001
EXPOSE 3001

CMD ["sh", "-c", "node ./scripts/run-vinext.mjs start --port ${PORT}"]
