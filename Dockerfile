# Bidwire: MCP server + live exchange UI in one container.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY web/package.json web/package-lock.json ./web/
RUN npm --prefix web ci
COPY . .
RUN npm --prefix web run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8787 BIDWIRE_DB=/data/bidwire.db
COPY --from=build /app /app
RUN mkdir -p /data
EXPOSE 8787
CMD ["npx", "tsx", "server/src/index.ts"]
