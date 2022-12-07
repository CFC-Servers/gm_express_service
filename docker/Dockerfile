FROM denoland/deno:alpine

USER deno
WORKDIR /app

COPY ./index.js /app/index.js
COPY ./docker/selfhost.js /app/setup_app.js

ENTRYPOINT ["deno", "run", "--allow-net", "--allow-read", "/app/index.js"]
