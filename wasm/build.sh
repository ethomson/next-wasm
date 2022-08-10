#!/bin/sh

CLANG="${CLANG:-clang}"

${CLANG} --target=wasm32 --no-standard-libraries --optimize=3 -Wl,--export-all -Wl,--no-entry -Wl,--import-undefined -pedantic -Wall -Wextra -Werror -o ../pages/api/maze-c.wasm maze.c
