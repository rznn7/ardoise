FROM node:24.22.1-bookworm-slim

RUN corepack enable
WORKDIR /repo

COPY . .
RUN pnpm install --frozen-lockfile --filter @ardoise/backend...
RUN pnpm --filter @ardoise/backend... build

WORKDIR /repo/apps/backend
EXPOSE 3000
CMD ["sh", "-c", "pnpm db:migrate && pnpm db:seed && exec node dist/main"]
