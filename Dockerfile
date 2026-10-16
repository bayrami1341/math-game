FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --chown=node:node server ./server
COPY --chown=node:node contracts ./contracts
COPY --chown=node:node src ./src
COPY --chown=node:node styles ./styles
COPY --chown=node:node assets ./assets
COPY --chown=node:node *.html *.js ./
USER node
EXPOSE 8080
CMD ["node", "server/start.js"]
