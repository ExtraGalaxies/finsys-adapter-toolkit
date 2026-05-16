FROM node:24-alpine

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.mjs ./
COPY data ./data

ENV PORT=4200
EXPOSE 4200

USER node
CMD ["node", "server.mjs"]
