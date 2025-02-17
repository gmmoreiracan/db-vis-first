# Stage 1: Build the application using Node.js
FROM --platform=linux/amd64 node:latest AS build

# Set the working directory inside the container
WORKDIR /app

# Copy the package.json and package-lock.json files first
COPY package*.json ./

# Install the project dependencies
RUN npm install

# Copy the rest of the app's source code
COPY . .

# Build the app using Vite
RUN npm run build

# Stage 2: Serve the app using a simple web server (nginx)
FROM --platform=linux/amd64 nginx:alpine

# Copy the built app from the build stage to nginx's html directory
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/initialdb.json /usr/share/nginx/html

# Expose port 80 for the ngnix web server
EXPOSE 80

# Start nginx server
CMD ["nginx", "-g", "daemon off;"]