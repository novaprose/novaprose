# Сервер совместного редактирования NovaProse.
#   docker build -t novaprose-sync apps/sync-server
#   docker run -p 1234:1234 -e NOVA_SYNC_SECRET=… -v novaprose-sync:/data novaprose-sync
FROM node:24-slim

ENV NODE_ENV=production \
    PORT=1234 \
    NOVA_SYNC_DB=/data/novaprose-sync.db

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY src ./src

# Документы — в томе /data; процесс — не от root.
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node

EXPOSE 1234
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "src/server.mjs"]
