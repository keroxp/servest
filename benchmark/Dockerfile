FROM debian:stretch
ARG DENO_VERSION
RUN apt update -y && apt install curl wrk -y
ENV DENO_DIR=/deno
ENV DENO_INSTALL=/deno/.deno
ENV PATH=${DENO_INSTALL}/bin:${PATH}
RUN curl -fsSL https://deno.land/x/install/install.sh | sh -s -- ${DENO_VERSION}
COPY . /servest
RUN deno fetch /servest/benchmark/listen_bench.ts \
    && deno fetch /servest/benchmark/std_bench.ts \
    && deno fetch /servest/benchmark/main.ts
ENV TARGET=/servest/benchmark/listen_bench.ts
CMD ["deno", "-A", "/servest/benchmark/main.ts"]