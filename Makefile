_: deno.d.ts tsconfig.json
check:
	deno --allow-read --allow-run --allow-write https://denopkg.com/kt3k/deno_license_checker@v2.0.0/main.ts --inject
deno.d.ts:
	deno --types > deno.d.ts
tsconfig.json:
	./make.sh > tsconfig.json
.PHONY: types	
types:
	deno -A tools/gen_types.ts
	deno fmt types/**/*.ts
test:
	deno test -A *_test.ts
build:
	docker build --build-arg DENO_VERSION=`cat .denov` -t servest/site .
bench:
	docker build --build-arg DENO_VERSION=`cat .denov` -t servest/bench -f benchmark/Dockerfile .
do-bench: bench
	docker run -t servest/bench
do-std-bench: bench
	docker run -e TARGET=/servest/benchmark/std_bench.ts -t servest/bench
dev:
	./tools/dev.ts "site/**/*.ts" "site/**/*.tsx" "site/index.ts"
mod.ts: *.ts
	./tools/make_mod.ts