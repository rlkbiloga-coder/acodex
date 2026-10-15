FROM mcr.microsoft.com/playwright:v1.55.0-noble
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/server.js"]
