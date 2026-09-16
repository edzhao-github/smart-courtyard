'use client';
import { useEffect, useState } from 'react';
import { configureRemoteStorage, flushProject, hasPendingProject } from '@/lib/project-storage';
import { validatePlan } from '@/lib/plan';
import { validateOperations } from '@/lib/operations';

export function WorkspaceGate({children}: {children:React.ReactNode}) {
  const [ready,setReady]=useState(false);
  const [username,setUsername]=useState('');
  const [status,setStatus]=useState('正在连接园区数据…');
  const [error,setError]=useState(false);
  useEffect(()=>{
    let alive=true;
    async function load() {
      try {
        const session=await fetch('/api/session',{cache:'no-store'});
        if (session.status===404) { if(alive)setReady(true);return; }
        if(session.status===401) { location.href='/login';return; }
        if(!session.ok)throw Error('无法连接服务器，请刷新重试');
        const user=await session.json() as {username:string};
        const response=await fetch('/api/workspace',{cache:'no-store'});
        if(!response.ok)throw Error('园区数据读取失败，请刷新重试');
        const data=await response.json() as {revision:number;plan:ReturnType<typeof validatePlan>;operations:ReturnType<typeof validateOperations>} | null;
        if(!data)throw Error('尚未导入园区数据，请联系管理员');
        validatePlan(data.plan);validateOperations(data.operations);
        // Preserve a recoverable browser copy before replacing cache on a new session.
        const oldPlan=localStorage.getItem('courtyard-plan-v1');
        const oldOps=localStorage.getItem('courtyard-operations-v1');
        if(oldPlan && oldOps) localStorage.setItem('courtyard-before-server-load',JSON.stringify({plan:JSON.parse(oldPlan),operations:JSON.parse(oldOps)}));
        configureRemoteStorage(data);
        // Server data is already migrated; never reset a configured tariff on a new browser.
        data.plan.elements.forEach((space:{id:string;name:string})=>{
          if(space.name.trim()==='研发办公室')localStorage.setItem(`courtyard-tariff-20260915-${space.id}`,'done');
        });
        if(alive){setUsername(user.username);setStatus('已保存到服务器');setReady(true);}
      } catch(e) { if(alive){setError(true);setStatus(e instanceof Error?e.message:'数据读取失败');} }
    }
    void load();
    const onStatus=(event:Event)=>{const detail=(event as CustomEvent).detail;setStatus(detail.status);setError(detail.error);};
    const beforeUnload=(event:BeforeUnloadEvent)=>{if(hasPendingProject()){event.preventDefault();event.returnValue='';}};
    window.addEventListener('courtyard-save-status',onStatus);
    window.addEventListener('beforeunload',beforeUnload);
    return()=>{alive=false;window.removeEventListener('courtyard-save-status',onStatus);window.removeEventListener('beforeunload',beforeUnload);};
  },[]);
  function exportPending(){
    const data={plan:JSON.parse(localStorage.getItem('courtyard-plan-v1')||'null'),operations:JSON.parse(localStorage.getItem('courtyard-operations-v1')||'null')};
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=`园区待保存备份-${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function logout(){try{await flushProject();const form=document.createElement('form');form.method='POST';form.action='/auth/logout';document.body.appendChild(form);form.submit();}catch{setError(true);setStatus('尚有未保存修改，请先下载备份再刷新登录。');}}
  return <>
    {(username||!ready)&&<div className={`workspace-status ${error?'workspace-status-error':''}`} role="status"><span>{username?`${username} · `:''}{status}</span><div>{error&&<><button onClick={exportPending}>下载待保存备份</button><button onClick={()=>location.reload()}>刷新</button></>}{username&&!error&&<button onClick={()=>void logout()}>退出登录</button>}</div></div>}
    {ready&&<div inert={error||undefined}>{children}</div>}
  </>;
}
