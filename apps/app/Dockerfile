FROM oven/bun:1.3.11 AS build
WORKDIR /workspace

ARG PUBLIC_SERVER_URL=http://localhost:1337
ARG PUBLIC_COPILOT_RUNTIME_URL=http://localhost:1337/api/copilotkit
ENV PUBLIC_SERVER_URL=$PUBLIC_SERVER_URL
ENV PUBLIC_COPILOT_RUNTIME_URL=$PUBLIC_COPILOT_RUNTIME_URL

COPY . .
RUN bun install --frozen-lockfile
RUN bun run --cwd apps/app build

FROM node:24-slim AS runtime
WORKDIR /workspace/apps/app

ENV HOST=0.0.0.0
ENV PORT=4321

COPY --from=build /workspace /workspace

EXPOSE 4321
CMD ["node", "dist/server/entry.mjs"]
