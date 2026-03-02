FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/fancymenu-sandbox/package.json apps/fancymenu-sandbox/package.json
RUN pnpm install --filter @mvl/fancymenu-sandbox... --frozen-lockfile

COPY . .
RUN pnpm --filter @mvl/fancymenu-sandbox build

EXPOSE 3210
CMD ["node", "apps/fancymenu-sandbox/dist/index.js"]
