#!/usr/bin/env bash
set -euo pipefail
cd /opt/smart-courtyard/app
read -r -p '账号（字母数字，至少3位）: ' courtyard_user
read -r -s -p '密码（至少12位）: ' courtyard_password
printf '\n'
read -r -s -p '再次输入密码: ' courtyard_confirmation
printf '\n'
[[ "$courtyard_password" = "$courtyard_confirmation" ]] || { echo '两次密码不一致'; exit 1; }
printf '%s' "$courtyard_password" | COURTYARD_DATA=/opt/smart-courtyard/data /opt/smart-courtyard/runtime/node --experimental-strip-types server/manage.mjs user "$courtyard_user"
chown courtyard:courtyard /opt/smart-courtyard/data/courtyard.sqlite*
unset courtyard_password courtyard_confirmation
