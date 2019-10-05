_: deno.d.ts tsconfig.json
check:
	deno --allow-read --allow-run --allow-write https://denopkg.com/kt3k/deno_license_checker/main.ts --inject
	deno fmt *
deno.d.ts:
	deno --types > deno.d.ts
tsconfig.json:
	./make.sh > tsconfig.json
test:
	deno run -A tests.ts
build:
	docker build -t servest/site .
bench:
	docker build -t servest/bench -f benchmark/Dockerfile .
do-bench: bench
	docker run -t servest/bench
do-std-bench: bench
	docker run -e TARGET=/servest/benchmark/std_bench.ts -t servest/bench
