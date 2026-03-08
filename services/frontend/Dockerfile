FROM node:22-alpine AS builder
WORKDIR /app
COPY services/frontend/package.json services/frontend/yarn.lock* ./
COPY services/frontend/ ./
RUN corepack enable && yarn install --frozen-lockfile && yarn run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js
ENV NODE_ENV=production
ENV PORT=3001
ENV CONTRACTS_JSON_PATH=/deploy-output/contracts.json
EXPOSE 3001
CMD ["node", "server.js"]
