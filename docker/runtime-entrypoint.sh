#!/bin/sh
set -eu

if [ "$(id -u)" = "0" ]; then
  mkdir -p /app/runtime /app/data
  chown -R angee:angee /app/runtime
  chown angee:angee /app/data
  exec gosu angee "$@"
fi

exec "$@"
