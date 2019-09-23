FROM debian:stretch
RUN apt update -y && apt install curl -y
ARG DENO_VERSION=v0.18.0
RUN curl -fsSL https://deno.land/x/install/install.sh | sh -s -- ${DENO_VERSION}
ENV DENO_INSTALL=/root/.deno
ENV PATH=${DENO_INSTALL}/bin:${PATH}
COPY . /servest
RUN deno fetch /servest/site/index.ts
WORKDIR /servest/site
ENV PORT=${PORT}
EXPOSE ${PORT}
RUN cp *.ts /servest/site/public
CMD ["deno", "--allow-net", "--allow-read", "--allow-env", "index.ts"]