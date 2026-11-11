# Discord bot, deployed as its own CapRover app.
#
# The build context is the repository root, not bot/: the bot reuses the
# backend's Prisma schema and role catalogue. That is why its captain-definition
# lives at the root (captain-definition-bot). CapRover uses the directory of the
# captain-definition file as the context, so one inside bot/ could not reach
# ../backend.
FROM node:20.17.0-alpine

WORKDIR /usr/src/app

# Only Prisma is needed from the backend, not its whole dependency tree, which
# is heavy to install on a small server. The versions come from the backend's
# lockfile so the bot always generates the same client the website runs.
COPY ./backend/package-lock.json /tmp/backend-lock.json
RUN mkdir -p backend && cd backend \
    && PRISMA_VERSION=$(node -p "require('/tmp/backend-lock.json').packages['node_modules/prisma'].version") \
    && CLIENT_VERSION=$(node -p "require('/tmp/backend-lock.json').packages['node_modules/@prisma/client'].version") \
    && npm init -y > /dev/null \
    && npm install --no-audit --no-fund "prisma@${PRISMA_VERSION}" "@prisma/client@${CLIENT_VERSION}"

COPY ./bot/package.json ./bot/package-lock.json ./bot/
RUN cd bot && npm ci --omit=dev --no-audit --no-fund

COPY ./backend/prisma ./backend/prisma
COPY ./backend/src/constants ./backend/src/constants
COPY ./bot ./bot

RUN cd backend && npx prisma generate

WORKDIR /usr/src/app/bot
ENV NODE_ENV=production

# no HTTP port: this app only talks to Discord and the database
CMD ["npm", "run", "prod"]
