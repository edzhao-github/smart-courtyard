const keys = ['courtyard-plan-v1', 'courtyard-operations-v1'];
let remote = false;
let revision = 0;
let generation = 0;
let savedGeneration = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let pending: Promise<void> | undefined;
let blocked = false;
let baseline = '';
function snapshot() {
  return {plan: JSON.parse(localStorage.getItem(keys[0]) || 'null'), operations: JSON.parse(localStorage.getItem(keys[1]) || 'null')};
}
function notify(status: string, error = false) {
  window.dispatchEvent(new CustomEvent('courtyard-save-status', {detail:{status,error}}));
}
export function configureRemoteStorage(value: {revision:number; plan:unknown; operations:unknown}) {
  localStorage.setItem(keys[0], JSON.stringify(value.plan));
  localStorage.setItem(keys[1], JSON.stringify(value.operations));
  revision = value.revision;
  baseline = JSON.stringify(snapshot());
  remote = true;
}
export function saveProjectValue(key: string, value: string) {
  if (remote && blocked && keys.includes(key)) throw Error('服务器保存未完成，请先处理顶部提示');
  localStorage.setItem(key,value);
  if (!remote || !keys.includes(key)) return;
  generation++;
  notify('正在保存到服务器…');
  clearTimeout(timer);
  timer = setTimeout(()=>void flushProject().catch(()=>{}),300);
}
export function hasPendingProject() { return remote && (generation !== savedGeneration || blocked); }
export function isRemoteStorage() { return remote; }
export async function flushProject(): Promise<void> {
  if (!remote) return;
  if (pending) { await pending; if (generation !== savedGeneration) return flushProject(); return; }
  if (blocked) throw Error('保存已暂停');
  clearTimeout(timer);
  pending = (async()=>{
    while (generation !== savedGeneration) {
      const saving = generation;
      const data = snapshot();
      const serialized = JSON.stringify(data);
      if (serialized === baseline) { savedGeneration=saving; notify('已保存到服务器'); continue; }
      const response = await fetch('/api/workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,revision})});
      if (!response.ok) {
        const message = response.status === 409 ? '另一窗口已更新数据。本页修改尚未保存，请下载待保存备份，再刷新核对。' : response.status === 401 ? '登录已过期。本页修改尚未保存，请下载待保存备份后重新登录。' : '服务器保存失败。本页修改仍在浏览器中，请下载待保存备份。';
        throw Error(message);
      }
      revision=(await response.json() as {revision:number}).revision;
      baseline=serialized;
      savedGeneration=saving;
    }
    notify('已保存到服务器');
  })().catch(error=>{blocked=true;notify(error.message,true);throw error;}).finally(()=>{pending=undefined;});
  return pending;
}
