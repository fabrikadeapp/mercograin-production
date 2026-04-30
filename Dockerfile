# Use Node.js official image (slim has better library support than alpine)
FROM node:20-slim

WORKDIR /app

# Install OpenSSL for Prisma compatibility
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy rest of application
COPY . .

# Build Next.js app
RUN npm run build

# Create entrypoint script for migrations and seed
RUN echo '#!/bin/bash\n\
set -e\n\
echo "Running database migrations..."\n\
npx prisma migrate deploy || echo "Migrations already applied"\n\
echo "Seeding database..."\n\
npx prisma db seed || echo "Seed already applied"\n\
echo "Starting application..."\n\
npm run start' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Expose port
EXPOSE 3000

# Start with migrations
CMD ["/app/entrypoint.sh"]
