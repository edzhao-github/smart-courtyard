#!/usr/bin/env bash
set -euo pipefail
systemctl restart courtyard
systemctl --no-pager --full status courtyard || test "$?" = 3
