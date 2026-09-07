#!/bin/bash
set -e
cd "$(dirname "$0")"
if command -v node >/dev/null 2>&1; then
  COURTYARD_NODE="$(command -v node)"
else
  COURTYARD_NODE="/Users/edzhao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [ ! -x "$COURTYARD_NODE" ]; then
  echo '未找到 Node.js，请先安装 Node.js 22.13 或更高版本。'
  read -r -p '按回车退出'
  exit 1
fi
if [ ! -f node_modules/vinext/dist/cli.js ]; then
  echo '缺少依赖，请在项目目录执行 pnpm install。'
  read -r -p '按回车退出'
  exit 1
fi
export PATH="$(dirname "$COURTYARD_NODE"):$PATH"
export COURTYARD_LOCAL=1
echo '园区管理本地版： http://localhost:3000/dashboard'
echo '绘图工具： http://localhost:3000/'
echo '请保持此窗口运行；按 Ctrl+C 停止服务。'
exec "$COURTYARD_NODE" node_modules/vinext/dist/cli.js dev --hostname localhost --port 3000
