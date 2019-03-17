_: deno.d.ts tsconfig.json
check:
	deno --allow-read --allow-run --allow-write https://deno.land/x/license_checker@v1.5.0/main.ts --inject
	deno --fmt
deno.d.ts:
	deno --types > deno.d.ts
tsconfig.json:
	./make.sh > tsconfig.json
test:
	deno -A tests.ts
