FROM debian:stretch
ARG DENO_VERSION=v0.18.0
RUN apt update -y && apt install curl -y
RUN curl -fsSL https://deno.land/x/install/install.sh | sh -s -- ${DENO_VERSION}
ENV DENO_INSTALL=/root/.deno
ENV PATH=${DENO_INSTALL}/bin:${PATH}
COPY . /servest
RUN deno fetch /servest/site/index.ts
WORKDIR /servest/site
ENV PORT=${PORT}
EXPOSE ${PORT}
CMD ["deno", "--allow-net", "--allow-read", "--allow-env", "index.ts"]