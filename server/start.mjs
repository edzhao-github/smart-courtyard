import { spawn } from 'node:child_process';
const env={...process.env,COURTYARD_LOCAL:'1',NODE_ENV:'production'};
const app=spawn(process.execPath,['node_modules/vinext/dist/cli.js','start','--hostname','127.0.0.1','--port',env.UPSTREAM_PORT||'3181'],{stdio:'inherit',env});
const gateway=spawn(process.execPath,['--experimental-strip-types','server/gateway.mjs'],{stdio:'inherit',env});
let closing=false;
function stop(code){if(closing)return;closing=true;app.kill('SIGTERM');gateway.kill('SIGTERM');setTimeout(()=>process.exit(code),1000);}
app.on('exit',()=>stop(1));gateway.on('exit',()=>stop(1));
app.on('error',()=>stop(1));gateway.on('error',()=>stop(1));
process.on('SIGTERM',()=>stop(0));process.on('SIGINT',()=>stop(0));
