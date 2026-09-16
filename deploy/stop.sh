#!/usr/bin/env bash
set -euo pipefail
systemctl stop courtyard
systemctl --no-pager --full status courtyard || test "$?" = 3
