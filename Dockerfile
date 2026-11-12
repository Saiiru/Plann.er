# Multi-stage, local-only learning API. Production internet exposure is NOT configured.
FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY prisma ./prisma
RUN ./node_modules/.bin/prisma generate
COPY src ./src
COPY scripts ./scripts
COPY tsconfig*.json ./
RUN npm run build

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
RUN install -d -o node -g node /app/data
USER node
ENV NODE_ENV=production \
    DATABASE_URL=file:../data/trips.db \
    MAIL_PREVIEW_DIR=/app/data/mail-preview \
    PORT=3333 \
    HOST=0.0.0.0
EXPOSE 3333
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node scripts/start.cjs"]
