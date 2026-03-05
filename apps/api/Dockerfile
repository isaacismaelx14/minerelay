FROM node:20-alpine AS base
WORKDIR /app

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
RUN pnpm install --filter @mss/api... --frozen-lockfile=false

COPY . .
RUN pnpm --filter @mss/shared build
RUN pnpm --filter @mss/api prisma:generate
RUN pnpm --filter @mss/api build

CMD ["sh", "-c", "pnpm --filter @mss/api prisma:generate && pnpm --filter @mss/api prisma:deploy && pnpm --filter @mss/api prisma:seed && node apps/api/dist/src/main.js"]
