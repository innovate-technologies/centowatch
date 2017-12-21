#!/bin/sh

mkdir build
exec flow-remove-types --out-dir build/ src/
