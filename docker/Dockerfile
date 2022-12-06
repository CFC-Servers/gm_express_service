FROM ubuntu:22.10
RUN apt-get update -y && apt-get install -y unzip curl
ENV BUN_CANARY=1

WORKDIR /web
RUN curl https://bun.sh/install | bash
RUN mv -v /root/.bun/bin/bun /web/bun

RUN echo $(/web/bun -v)

RUN echo $(uname -r)

RUN /web/bun upgrade --canary

COPY ./docker/package.json /web/package.json
RUN /web/bun install

COPY ./index.js /web/index.js
