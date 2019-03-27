_: deno.d.ts tsconfig.json
check:
	deno --allow-read --allow-run --allow-write https://denopkg.com/kt3k/deno_license_checker/main.ts --inject
	deno --fmt
deno.d.ts:
	deno --types > deno.d.ts
tsconfig.json:
	./make.sh > tsconfig.json
test:
	deno -A tests.ts
