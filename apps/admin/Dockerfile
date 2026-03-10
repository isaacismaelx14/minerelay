FROM node:24-alpine AS base
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/admin/package.json apps/admin/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN pnpm install --filter @minerelay/admin... --frozen-lockfile=false

COPY apps/admin apps/admin
COPY packages/ui packages/ui

WORKDIR /app/apps/admin
RUN pnpm build

ENV PORT=3001
EXPOSE 3001

CMD ["sh", "-c", "node ./scripts/run-vinext.mjs start --port ${PORT}"]
