#!/usr/bin/env bash

tsconfig() {
user=$(whoami)
cat <<-EOS
{
  "compilerOptions": {
    "target": "esnext",
    "module": "esnext",
    "baseUrl": "/Users/${user}/Library/Caches",
    "paths": {
      "deno": ["./deno.d.ts"],
      "https://*": [
        "./deno/deps/https/*"
      ],
      "http://*": [
        "./deno/deps/http/*"
      ]
    }
  }
}
EOS
}

tsconfig