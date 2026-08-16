# Stage 1: Install ALL dependencies once
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Build the application
FROM node:24-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 3: Production runtime
FROM node:24-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# PostgreSQL client tools for backup/restore. The major version MUST match the
# server major pinned in docker-compose.prod.yml — pg_restore cannot reliably
# load a dump into an older server, so a silent drift here breaks disaster
# recovery and only shows up during an actual restore.
#
# Fail the BUILD on a mismatch rather than discovering it in production. If this
# trips because the base image's Debian default moved, update both this ARG and
# POSTGRES_IMAGE in docker-compose.prod.yml together. See
# docs/PRODUCTION_DEPLOYMENT.md §11.
# Debian's own `postgresql-client` meta-package tracks the BASE IMAGE's release,
# not our database: node:24-slim is bookworm, which ships client 15. That is not
# merely a mismatch — pg_dump refuses to dump from a server NEWER than itself, so
# a 15 client against the 17 server means backups fail outright. Install the
# matching major explicitly from the PostgreSQL APT repository instead, so the
# client version is pinned to our database rather than to the base image.
ARG EXPECTED_PG_MAJOR=17
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
         -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo $VERSION_CODENAME)-pgdg main" \
         > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends "postgresql-client-${EXPECTED_PG_MAJOR}" \
    && rm -rf /var/lib/apt/lists/* \
    && INSTALLED_PG_MAJOR="$(pg_dump --version | sed -E 's/[^0-9]*([0-9]+).*/\1/')" \
    && echo "pg_dump major: ${INSTALLED_PG_MAJOR} (expected ${EXPECTED_PG_MAJOR})" \
    && if [ "$INSTALLED_PG_MAJOR" != "$EXPECTED_PG_MAJOR" ]; then \
         echo "ERROR: postgresql-client is ${INSTALLED_PG_MAJOR}, expected ${EXPECTED_PG_MAJOR}." >&2; \
         echo "       Align EXPECTED_PG_MAJOR (Dockerfile) with POSTGRES_IMAGE" >&2; \
         echo "       (docker-compose.prod.yml). See docs/PRODUCTION_DEPLOYMENT.md §11." >&2; \
         exit 1; \
       fi

COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Install production node_modules (creates .bin entries for npx CLI resolution)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts

# Restore generated Prisma client (npm ci with --ignore-scripts skips prisma generate)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Install Chromium browser to a system-wide path
ENV PLAYWRIGHT_BROWSERS_PATH=/app/ms-playwright
RUN npx playwright install --with-deps chromium

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create non-root user and set up directories
# Create the storage AND backup mount points before chown. Docker seeds a fresh
# named volume from the image content at its mount path — including ownership —
# so a path that does not exist in the image yields a root-owned empty volume
# that the uid-1001 app user cannot write to. /app/backups was missing here,
# which made entrypoint storage validation fail on every fresh deployment.
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 appuser --ingroup appgroup && \
    mkdir -p /app/storage/uploads \
             /app/backups/daily \
             /app/backups/weekly \
             /app/backups/monthly \
             /app/backups/yearly \
             /app/backups/uploads \
             /app/backups/packages && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
