FROM jarredsumner/bun:edge AS builder

COPY ../package.json package.json
RUN bun install

COPY ../index.js index.js

ENTRYPOINT ["bun", "start", "index.js"]
