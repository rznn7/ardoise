FROM node:24.22.1-bookworm-slim AS build

RUN corepack enable
WORKDIR /repo

COPY . .
RUN pnpm install --frozen-lockfile --filter @ardoise/frontend...
RUN pnpm --filter @ardoise/frontend... build

FROM caddy:2.11.7-alpine

ARG GIT_SHA=dev
ARG GIT_DATE=

COPY apps/frontend/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/frontend/dist/frontend/browser /srv
RUN printf '{"sha":"%s","date":"%s"}\n' "$GIT_SHA" "$GIT_DATE" > /srv/version.json
