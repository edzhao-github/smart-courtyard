#!/bin/bash
set -euo pipefail
ssh -t root@101.42.42.11 '/opt/smart-courtyard/app/deploy/stop.sh'
