FROM debian:stretch
RUN apt update -y && apt install curl wrk -y
RUN curl -fsSL https://deno.land/x/install/install.sh | sh -s -- ${DENO_VERSION}
ENV DENO_INSTALL=/root/.deno
ENV PATH=${DENO_INSTALL}/bin:${PATH}
COPY . /servest
RUN deno fetch /servest/benchmark/listen_bench.ts
ENV TARGET=/servest/benchmark/listen_bench.ts
CMD ["deno", "-A", "/servest/benchmark/main.ts"]