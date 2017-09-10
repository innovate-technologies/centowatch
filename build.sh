#!/bin/sh

mkdir build
exec flow-remove-types --out-file build/main.js main.js
