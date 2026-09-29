# Contesto di build: la radice del repository (vedi docker-compose.yml e Dockerfile.dockerignore).
# Il layout dentro l'immagine rispecchia quello del repository, così mailer.mjs importa
# ../src/lib/webpush.server.ts allo stesso modo in locale e nel container.
FROM oven/bun:1-alpine
WORKDIR /app/mailer
COPY mailer/package.json mailer/bun.lock mailer/bunfig.toml ./
RUN bun install --frozen-lockfile --production
COPY mailer/mailer.mjs mailer/mailer-core.ts mailer/healthcheck.mjs ./
COPY src/lib/webpush.server.ts /app/src/lib/webpush.server.ts
USER bun
CMD ["bun", "mailer.mjs"]
