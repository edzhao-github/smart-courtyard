#!/usr/bin/env bash
set -euo pipefail
systemctl start courtyard
systemctl --no-pager --full status courtyard || test "$?" = 3
