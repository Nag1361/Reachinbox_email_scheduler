FROM node:22-trixie-slim AS build
WORKDIR /app
RUN apt-get update && apt-get upgrade -y \
	&& rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci
COPY index.html ./
COPY public ./public
COPY src ./src
COPY tsconfig*.json ./
COPY vite.config.ts .
RUN npm run build

FROM node:22-trixie-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get upgrade -y \
	&& rm -rf /var/lib/apt/lists/*
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/vite.config.ts ./vite.config.ts
COPY --from=build /app/dist ./dist
EXPOSE 4173
CMD ["npm", "start"]