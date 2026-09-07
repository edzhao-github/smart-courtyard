import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutLabel} from '../lib/label-layout.ts';
test('CJK room names, marker prefixes and tiny shapes stay in their padded bounds',()=>{
 for(const [name,w,h] of [['路途汽车音响',6,8.65],['P · 停车场入口区域',2,10],['ϟ 充电桩',.5,.5],['长房间名称'.repeat(200),30,2],['WWWW office 123',8,6]]){
 const area=`${(w*h).toFixed(1)} m²`,l=layoutLabel(name,w,h,area);
 assert.ok(l.font>0);assert.ok(l.lines.length<=3);
 for(const line of l.lines){assert.ok(Array.from(line.text).length*l.font*1.15<=l.innerWidth+1e-8);assert.ok(line.y-l.font*.5>=0);assert.ok(line.y+l.font*.5<=l.innerHeight);}
 assert.ok(l.areaY-l.areaFont*.5>=0);assert.ok(l.areaY+l.areaFont*.5<=l.innerHeight);
 }
});
