FROM oven/bun:1.3.11 AS build
WORKDIR /workspace

COPY . .
RUN bun install --frozen-lockfile
RUN bun run --cwd apps/runtime build

FROM oven/bun:1.3.11 AS runtime
WORKDIR /workspace/apps/runtime

ENV NODE_ENV=production
ENV PORT=1337

COPY --from=build /workspace /workspace

EXPOSE 1337
CMD ["bun", "run", "dist/index.js"]
