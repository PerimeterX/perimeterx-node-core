#!/bin/bash

DIR=$1
echo "$DIR"
TEMPDIR=$(mktemp -d /tmp/babel-in-place.XXXXXXX)
babel --copy-files --presets=@babel/preset-env,@babel/preset-react "$DIR" --out-dir "$TEMPDIR"
rm -rf "$DIR"
mv "$TEMPDIR" "$DIR"
