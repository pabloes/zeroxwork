# Use Node.js base image
FROM node:20.17.0-alpine

# Set the working directory for the root folder (which includes frontend and backend folders)
WORKDIR /usr/src/app

# Copy root-level package.json and package-lock.json (if exists)
COPY ./package.json ./
COPY ./package-lock.json ./

# Install dependencies from the root package.json
RUN npm install

# Move to frontend folder and copy its files
WORKDIR /usr/src/app/frontend
COPY ./frontend/package.json ./frontend/package-lock.json ./
# Install frontend dependencies
RUN npm install


# Move to backend folder and copy its files
WORKDIR /usr/src/app/backend
COPY ./backend/package.json ./backend/package-lock.json ./

# Install backend dependencies
RUN npm install

# Copy all other files (frontend and backend source code)
WORKDIR /usr/src/app
COPY . .

WORKDIR /usr/src/app/frontend
# Build the frontend
RUN npm run build

# Expose the backend port (adjust this if necessary)
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Set the working directory to the backend folder to run the backend app
WORKDIR /usr/src/app/backend

# Run the backend's production start script and Prisma commands
CMD npx prisma generate && npx prisma migrate deploy && npm run prod
