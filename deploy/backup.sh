#!/usr/bin/env bash
set -euo pipefail
systemctl start courtyard-backup
journalctl -u courtyard-backup -n 5 --no-pager
