FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile --production
COPY mailer.mjs mailer-core.ts healthcheck.mjs ./
USER bun
CMD ["bun", "mailer.mjs"]
