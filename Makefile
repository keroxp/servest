_: deno.d.ts tsconfig.json
check:
	deno --allow-read --allow-run https://deno.land/x/license_checker@v1.3.0/main.ts
	deno --fmt
deno.d.ts:
	deno --types > deno.d.ts
tsconfig.json:
	./make.sh > tsconfig.json