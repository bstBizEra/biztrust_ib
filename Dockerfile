FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
COPY shared ./shared
COPY server ./server
RUN npm run build

FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
RUN groupadd --system biztrust && useradd --system --gid biztrust --home-dir /app biztrust
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build --chown=biztrust:biztrust /app/dist ./dist
COPY --chown=biztrust:biztrust server ./server
COPY --chown=biztrust:biztrust shared ./shared
USER biztrust
EXPOSE 3000
CMD ["node", "--import", "tsx", "server/index.ts", "--production-assets"]
