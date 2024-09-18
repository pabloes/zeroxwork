# Use Node.js base image
FROM node:20.17.0-alpine

# Set working directory for the root folder (which includes frontend and backend folders)
WORKDIR /usr/src/app

# Copy root-level package.json and package-lock.json (if exists)
COPY ./package.json ./
COPY ./package-lock.json ./

# Install dependencies from the root package.json
RUN npm install

# Change to frontend folder and install dependencies if it has its own package.json
WORKDIR /usr/src/app/frontend
COPY ./frontend/package.json ./frontend/
COPY ./frontend/package-lock.json ./frontend/
RUN npm install

# Change to backend folder and install dependencies if it has its own package.json
WORKDIR /usr/src/app/backend
COPY ./backend/package.json ./backend/
COPY ./backend/package-lock.json ./backend/
RUN npm install

# Return to the root working directory
WORKDIR /usr/src/app

# Copy all files from the root folder (including frontend and backend)
COPY . .

# Expose the backend port (change it if necessary)
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the app (frontend build and backend start will be handled by your "start" script)
CMD ["npm", "start"]
