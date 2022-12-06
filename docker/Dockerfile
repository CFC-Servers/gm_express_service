FROM denoland/deno:alpine

USER deno
WORKDIR /app

COPY ./index.js /app/index.js
COPY ./selfhost.js /app/selfhost.js

ENTRYPOINT ["deno", "run", "--allow-net", "--allow-read", "/app/index.js"]
