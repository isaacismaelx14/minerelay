FROM node:20-alpine AS base
WORKDIR /app

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
RUN pnpm install --filter @mvl/api... --frozen-lockfile=false

COPY . .
RUN pnpm --filter @mvl/shared build
RUN pnpm --filter @mvl/api build

CMD ["node", "apps/api/dist/main.js"]
