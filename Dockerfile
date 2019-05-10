FROM debian:stretch
ARG DENO_VERSION=v0.4.0
RUN apt update && apt install curl git bash make -y \
    && curl -fsSL https://deno.land/x/install/install.sh | sh -s -- ${DENO_VERSION}
ENV PATH=/root/.deno/bin:$PATH
COPY . /src
WORKDIR /src
RUN deno fetch tests.ts