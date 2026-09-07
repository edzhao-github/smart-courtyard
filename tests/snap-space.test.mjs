import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpace,snapSpace} from '../lib/plan.ts';
test('snap to all four rotated edges with exact contact and preserved data',()=>{
 const a={...createSpace('room',50,70,4,3),rotation:-18,rent:600};
 for(const angle of [0,37,90,-125])for(const side of ['left','right','top','bottom'])for(const alignment of ['start','center','end']){
 const b={...createSpace('room',10,20,12,8),rotation:angle};const before=structuredClone(b),r=snapSpace(a,b,side,alignment);const t=angle*Math.PI/180,dx=r.x-b.x,dy=r.y-b.y,u=dx*Math.cos(t)+dy*Math.sin(t),v=-dx*Math.sin(t)+dy*Math.cos(t);
 const offset=(outer,inner)=>alignment==='start'?0:alignment==='center'?(outer-inner)/2:outer-inner;
 const expected={left:[-4,offset(8,3)],right:[12,offset(8,3)],top:[offset(12,4),-3],bottom:[offset(12,4),8]}[side];assert.ok(Math.abs(u-expected[0])<1e-9);assert.ok(Math.abs(v-expected[1])<1e-9);assert.equal(r.rotation,angle);assert.equal(r.width,4);assert.equal(r.height,3);assert.equal(r.rent,600);assert.deepEqual(b,before);
 }
});
test('automatic snap picks nearest side; self and line targets rejected',()=>{const b=createSpace('room',10,10,10,10),a=createSpace('room',21,10,4,3);assert.deepEqual(snapSpace(a,b),snapSpace(a,b,'right'));assert.throws(()=>snapSpace(a,a));assert.throws(()=>snapSpace(a,createSpace('line',0,0,4,0)));});
