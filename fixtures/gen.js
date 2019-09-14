// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { writeRequest, writeResponse, writeTrailers } from "../serveio.ts";
import { encode } from "https://deno.land/std@v0.3.2/strings/strings.ts";
import { StringReader } from "https://deno.land/std@v0.3.2/io/readers.ts";

async function main() {
  await basicRequestGet();
  await basicRequestPost();
  await chunkedRequestPost();
  await chunkedRequestPostWithTrailers();
  await basicResponse();
  await chunkedResponse();
}
main();
async function basicRequestGet() {
  const f = await Deno.open("./fixtures/request_get.txt", "w");
  await writeRequest(f, {
    url: "http://deno.land/index.html?deno=land&msg=gogo",
    method: "GET",
    headers: new Headers({
      "Content-Type": "text/plain"
    })
  });
  f.close();
}
async function basicRequestPost() {
  const f = await Deno.open("./fixtures/request_post.txt", "w");
  await writeRequest(f, {
    url: "http://deno.land/index.html",
    method: "POST",
    headers: new Headers({
      "Content-Type": "text/plain"
    }),
    body: encode(
      "A secure JavaScript/TypeScript runtime built with V8, Rust, and Tokio"
    )
  });
  f.close();
}
async function chunkedRequestPost() {
  const f = await Deno.open("./fixtures/request_post_chunked.txt", "w");
  const headers = new Headers({
    "Content-Type": "text/plain",
    "Transfer-Encoding": "chunked"
  });
  await writeRequest(f, {
    url: "http://deno.land/index.html",
    method: "POST",
    headers,
    body: new StringReader(
      "A secure JavaScript/TypeScript runtime built with V8, Rust, and Tokio"
    )
  });
  f.close();
}
async function chunkedRequestPostWithTrailers() {
  const f = await Deno.open(
    "./fixtures/request_post_chunked_trailers.txt",
    "w"
  );
  const headers = new Headers({
    "Content-Type": "text/plain",
    "Transfer-Encoding": "chunked",
    Trailer: "X-Deno, X-Node"
  });
  await writeRequest(f, {
    url: "http://deno.land/index.html",
    method: "POST",
    headers,
    body: new StringReader(
      "A secure JavaScript/TypeScript runtime built with V8, Rust, and Tokio"
    )
  });
  await writeTrailers(
    f,
    headers,
    new Headers({
      "X-Deno": "land",
      "X-Node": "js"
    })
  );
  f.close();
}
async function basicResponse() {
  const f = await Deno.open("./fixtures/response.txt", "w");
  await writeResponse(f, {
    status: 200,
    headers: new Headers({
      "Content-Type": "text/plain"
    }),
    body: encode(
      "A secure JavaScript/TypeScript runtime built with V8, Rust, and Tokio"
    )
  });
  f.close();
}
async function chunkedResponse() {
  const f = await Deno.open("./fixtures/response_chunked.txt", "w");
  const headers = new Headers({
    "Content-Type": "text/plain",
    Trailer: "X-Deno, X-Node"
  });
  await writeResponse(f, {
    status: 200,
    headers,
    body: new StringReader(
      "A secure JavaScript/TypeScript runtime built with V8, Rust, and Tokio"
    )
  });
  await writeTrailers(
    f,
    headers,
    new Headers({
      "X-Deno": "land",
      "X-Node": "js"
    })
  );
  f.close();
}
