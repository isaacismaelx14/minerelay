FROM node:22-alpine AS base
WORKDIR /app

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
RUN pnpm install --filter @minerelay/api... --frozen-lockfile=false

COPY . .
RUN pnpm --filter @minerelay/shared build
RUN pnpm --filter @minerelay/api prisma:generate
RUN pnpm --filter @minerelay/api build

CMD ["sh", "-c", "pnpm --filter @minerelay/api prisma:generate && pnpm --filter @minerelay/api prisma:deploy && pnpm --filter @minerelay/api prisma:seed && pnpm --filter @minerelay/api start:prod"]
