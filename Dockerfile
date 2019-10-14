FROM debian:stretch
RUN apt update -y && apt install curl -y
ARG DENO_VERSION=v0.20.0
RUN curl -fsSL https://deno.land/x/install/install.sh | sh -s -- ${DENO_VERSION}
ENV DENO_INSTALL=/root/.deno
ENV PATH=${DENO_INSTALL}/bin:${PATH}
COPY . /servest
RUN deno fetch /servest/site/index.tsx
WORKDIR /servest/site
ENV PORT=${PORT}
EXPOSE ${PORT}
CMD ["deno", "--allow-net", "--allow-read", "--allow-env", "/servest/site/main.ts"]
