default: test
.PHONY: types	
types:
	deno run -A tools/gen_types.ts
	deno fmt types/**/*.ts
test:
	deno test -A --unstable
build:
	docker build -t servest/site .
bench:
	docker build -t servest/bench -f benchmark/Dockerfile .
do-bench: bench
	docker run -t servest/bench
do-std-bench: bench
	docker run -e TARGET=/servest/benchmark/std_bench.ts -t servest/bench
dev:
	./tools/dev.ts site/ "site/index.ts"
.PHONY: mod.ts	
mod.ts:
	deno run --allow-read --allow-write ./tools/make_mod.ts
