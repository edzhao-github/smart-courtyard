#!/usr/bin/env bash
set -euo pipefail
courtyard_cert="${RENEWED_LINEAGE:-/etc/letsencrypt/live/courtyard-ip}"
[[ "$courtyard_cert" = /etc/letsencrypt/live/courtyard-ip ]] || exit 0
install -d -m 700 -o courtyard -g courtyard /opt/smart-courtyard/data/tls
install -m 600 -o courtyard -g courtyard "$courtyard_cert/fullchain.pem" /opt/smart-courtyard/data/tls/fullchain.pem
install -m 600 -o courtyard -g courtyard "$courtyard_cert/privkey.pem" /opt/smart-courtyard/data/tls/privkey.pem
systemctl try-restart courtyard
