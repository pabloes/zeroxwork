# Discord bot. Built from the repository root, same as the web image, because
# it reuses the backend's Prisma schema and generated client.
FROM node:20.17.0-alpine

WORKDIR /usr/src/app

# backend deps first: the Prisma client is generated from its schema
COPY ./backend/package.json ./backend/package-lock.json ./backend/
RUN cd backend && npm install --omit=dev

COPY ./bot/package.json ./bot/package-lock.json ./bot/
RUN cd bot && npm install --omit=dev

COPY ./backend/prisma ./backend/prisma
COPY ./backend/src/constants ./backend/src/constants
COPY ./bot ./bot

RUN cd backend && npx prisma generate

WORKDIR /usr/src/app/bot
ENV NODE_ENV=production

# no HTTP port: this app only talks to Discord and the database
CMD ["npm", "run", "prod"]
