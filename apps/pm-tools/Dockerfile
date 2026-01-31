FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client
RUN npx prisma generate

RUN npm run build

# Production image - standalone mode
FROM base AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output and required files
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

# Create startup script before switching user
RUN printf '#!/bin/sh\nset -e\necho "=== PM Tools Startup ==="\necho "Working dir: $(pwd)"\necho "Prisma files:"\nls -la prisma/ 2>/dev/null || echo "No prisma dir"\necho "DATABASE_URL: $DATABASE_URL"\necho "Running db push..."\nnode node_modules/prisma/build/index.js db push --accept-data-loss --skip-generate 2>&1 || echo "db push failed"\necho "Starting server..."\nexec node server.js\n' > /app/start.sh && \
    chmod +x /app/start.sh && \
    chown nextjs:nodejs /app/start.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["/app/start.sh"]
