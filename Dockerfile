FROM debian:stretch
RUN apt update -y && apt install curl -y
ARG DENO_VERSION=v0.22.0
ENV DENO_DIR=/deno
ENV DENO_INSTALL=${DENO_DIR}/.deno
ENV PATH=${DENO_INSTALL}/bin:${PATH}
RUN curl -fsSL https://deno.land/x/install/install.sh | sh -s -- ${DENO_VERSION}
COPY modules.json modules-lock.json /servest/
COPY ./vendor /servest/vendor
COPY ./tools/fetch_dir.ts /servest/tools/fetch_dir.ts
RUN deno -A /servest/tools/fetch_dir.ts /servest/vendor
COPY . /servest
RUN deno -A /servest/tools/fetch_dir.ts /servest/site
WORKDIR /servest/site
ENV PORT=${PORT}
EXPOSE ${PORT}
CMD ["deno", "--allow-net", "--allow-read", "--allow-env", "/servest/site/index.ts"]
