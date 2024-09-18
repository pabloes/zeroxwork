# Stage 1: Build the frontend
FROM node:20.17.0-alpine AS frontend-builder

# Set working directory for frontend
WORKDIR /usr/src/app/frontend

# Copy frontend-specific files
COPY ./frontend/package.json ./
COPY ./frontend/package-lock.json ./

# Install frontend dependencies
RUN npm install

# Copy the frontend source code
COPY ./frontend ./

# Build the frontend
RUN npm run build

# Stage 2: Set up the backend and serve the app
FROM node:20.17.0-alpine

# Set working directory for backend
WORKDIR /usr/src/app/backend

# Copy backend-specific files
COPY ./backend/package.json ./
COPY ./backend/package-lock.json ./

# Install backend dependencies
RUN npm install

# Copy the backend source code
COPY ./backend ./

# Copy the frontend build from the first stage to serve with the backend
COPY --from=frontend-builder /usr/src/app/frontend/dist ./public

# Expose ports for both frontend (if needed) and backend
EXPOSE 3000 5000

# Set environment to production
ENV NODE_ENV=production

# Start the backend server
CMD ["npm", "start"]
