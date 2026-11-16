FROM node:24-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
COPY patches ./patches

# Prisma reads a URL when generating the client, without connecting to it.
RUN DATABASE_URL=postgresql://localhost/presentation_ai pnpm install --frozen-lockfile

# The prebuilt canvas module loads Expat from the operating system.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libexpat1 \
    && rm -rf /var/lib/apt/lists/*

COPY . .

EXPOSE 3000
CMD ["pnpm", "dev", "--hostname", "0.0.0.0"]
