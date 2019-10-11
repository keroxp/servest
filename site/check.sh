#!/usr/bin/env bash
DIR=$(dirname $0)
for i in $(ls ${DIR}/public/example); do
  deno fetch ${DIR}/public/example/${i}
done