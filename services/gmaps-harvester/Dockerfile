FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

ENV GMAPS_HARVESTER_PORT=5071
EXPOSE 5071

CMD ["npx", "tsx", "src/index.ts"]
