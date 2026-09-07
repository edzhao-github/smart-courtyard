import fs from 'node:fs';
import {createSpace,validatePlan} from '../lib/plan.ts';
const elements=[];const labels=[];
const add=(name,x,y,w,h,kind='room',area=null,note='')=>{const e=createSpace(kind,x,y,w,h);Object.assign(e,{name,business:'待核实',notes:`参照用户提供的梧桐院透视图绘制；位置、朝向及边长为示意，需现场校正。${area===null?'原图未提供可确认面积。':`原图标注面积：${area} m²。`}${note}水电、层高、租金等未核实，默认值不代表实际情况。`,referenceAreaM2:area,geometryEstimated:true});elements.push(e);return e;};
const building=(name,x,y,w,area,note='',floor=1)=>{const e=add(name,x,y,w,area/w,'room',area,note);e.floor=floor;return e;};
const line=(name,x,y,dx,dy)=>add(name,x,y,dx,dy,'line');
const group=(name,count,x,y,columns,w,h,kind='room',area=w*h)=>{for(let i=0;i<count;i++){const e=add(`${name} ${String(i+1).padStart(2,'0')}`,x+(i%columns)*(w+.5),y+Math.floor(i/columns)*(h+.6),w,h,kind,area,`本组原图标注 ${area} m² × ${count}。`);e.business=name.includes('摊')||name.includes('集市')?'集市':'零售';}labels.push({name:`${name} · ${area}m² × ${count}`,x,y:y-2});};
// 将透视图的园区长轴展开为左右方向，示意入口端 → 中部庭院 → 大型商业端。
const perimeter=[[5,105],[26,77],[64,77],[83,27],[163,8],[280,8],[296,25],[296,121],[246,145],[57,145],[5,123]];
for(let i=0;i<perimeter.length;i++){const a=perimeter[i],b=perimeter[(i+1)%perimeter.length];if(i!==perimeter.length-1)line('园区边界（待校正）',...a,b[0]-a[0],b[1]-a[1]);}
// 入口端集装箱与庭院
add('园区入口（示意）',4,107,3,14,'gate',null,'入口位置根据参考图左端通行口推测。');
add('甘井子水井',13,116,3,3,'outdoor',null);
const containers=[['箱 J1',23,103,7,21],['箱 J2',23,112,5,15],['箱 J3',30,125,8.333333,25],['箱 J4',41,125,12,36],['箱 J5',53,119,7,42],['箱 J6',52,108,6,30],['箱 J7',39,101,6,30]];
for(const [name,x,y,w,area] of containers)building(name,x,y,w,area);
building('二层庭院',29,111,15,370,'原图另标注 66m² 露台、500m² 庭院；370m² 面积口径待核实，此处平面外框只作示意。',2);
// 将多层建筑平面外框缩为示意占地，避免将楼层建筑面积误作实测占地。
const court=elements.find(e=>e.name==='二层庭院');court.height=10;court.notes+='示意占地150m²，原图370m²另行保留。';
building('固定店铺 50m²',28,85,10,50);
group('固定店铺',10,27,94,10,5,5);
// 中部商铺、工坊及仓库
 group('集市店铺 A',22,83,33,11,4,6);
 group('集市店铺 B',12,82,72,6,4,6);
 building('体育馆',86,51,18,279);
 building('烟囱庭院',108,52,12,120,'原图另标注庭落277m²。');
 building('白兰地仓库',122,51,16,160);
 building('工坊',137,32,18,298);
 building('办公室临建',143,61,18.5,259);
 building('管理中心',165,62,12,120);
 building('图书馆',139,51,4.5,18,'原图标注18m² × F4，面积口径待核实。',4);
 building('高砖墙库',79,114,10,95);
 building('矮砖墙库',91,114,8,40);
 building('果美甄选',107,98,27,540);
 building('青年旅舍',144,102,19.4,194,'原图标注194m² × F4，按每层194m²暂存，待确认。',4);
 building('泵道服务区',148,115,21.5,172);
 add('室内泵道',171,106,24,20,'room',480,'原图标注为室内泵道，归类为房间。');
 group('后备箱集市摊位',50,65,128,25,3,5,'outdoor',15);
// 远端商业与内街店铺
 group('邻街店铺',13,165,23,10,4.6,5);
 group('内街店铺',22,164,39,11,4,4);
 group('三宝邻街店铺',42,225,20,14,3,4);
 building('自习室',181,54,22,308,'原图标注308m² × F2，按每层308m²暂存，待确认。',2);
 building('三宝餐饮店铺',241,37,23,391);
 add('三宝摊位（范围待核）',214,39,9,8,'outdoor',null);
 building('固定店铺 1075m²',203,56,43,1075);
 building('仓储超市',249,64,35.0333333333,1051);
 building('活力中心',197,95,41.8,1463,'原图标注1463m² × F2，按每层1463m²暂存，待确认。',2);
 building('海鲜厅（标注待核）',273,42,20,200,'原图后缀“−20”含义不明，未推断为20间。');
 add('未标注建筑 A',281,102,11,12,'room',null,'参考图右侧灰紫色建筑，无可确认用途及面积。');
 add('未标注建筑 B',265,112,12,12,'room',null,'参考图右侧灰紫色建筑，无可确认用途及面积。');
 add('未标注建筑 C',249,124,12,12,'room',null,'参考图右侧灰紫色建筑，无可确认用途及面积。');
// 道路以线对象表达，避免被误计入可租区域面积。
line('主通道示意',61,108,14,-17);line('主通道示意',75,91,82,0);line('主通道示意',157,91,27,-13);line('主通道示意',184,78,0,-44);line('通行路线示意',157,91,29,7);
const plan=validatePlan({schemaVersion:1,name:'梧桐院 · 参考图平面初稿',unit:'m',elements,reference:{title:'新生路185号梧桐院测量数据',source:'用户提供的透视参考图',notice:'非测绘图；相对位置已做平面展开与排布调整；方向非真实北向；边长、位置、层高及水电费用均待核实。',areaPolicy:'原图明确标注面积单独保存在referenceAreaM2和notes；多层建筑面积口径待确认。',unidentifiedGreenhouses:'原图无法确定大棚范围，未将普通建筑擅自标为大棚。'}});
fs.writeFileSync('outputs/wutong-courtyard-plan.json',JSON.stringify(plan,null,2));
const esc=s=>String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
const svg=[];svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="2100" height="1240" viewBox="0 0 2100 1240"><defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r=".8" fill="#dce4e7"/></pattern></defs><rect width="2100" height="1240" fill="#f6f8fa"/><text x="66" y="65" font-size="32" font-weight="bold" fill="#1d3f4a" font-family="Arial, sans-serif">梧桐院 · 园区平面管理图</text><text x="67" y="97" font-size="16" fill="#6b818b">根据参考透视图展开 · 建筑 / 商铺 / 摊位独立建档 · 平面初稿，位置与边长待校正</text><rect x="44" y="125" width="2012" height="980" rx="16" fill="white" stroke="#dee6e9"/><rect x="44" y="125" width="2012" height="980" rx="16" fill="url(#grid)"/><g transform="translate(65 145) scale(6.55)">`);
svg.push(`<polygon points="${perimeter.map(p=>p.join(',')).join(' ')}" fill="#f0f5f1" stroke="#788d8c" stroke-width=".5"/>`);
// 宽通路置于建筑下方，保持平面可读。
svg.push('<path d="M 13 111 L 68 111 L 76 89 L 156 89 L 184 77 L 184 33 M 76 89 L 79 24 M 156 89 L 182 98 L 190 134 M 184 77 L 291 77" fill="none" stroke="#e1e6e9" stroke-width="4.8" stroke-linecap="round"/>');
for(const e of elements){if(e.kind==='line')continue;const small=/ (\d\d)$/.test(e.name);let fill='#e6eef9',stroke='#6d91bb';if(e.name.includes('活力中心')){fill='#cbdcf5';stroke='#4074ac';}if(e.kind==='outdoor'){fill='#fbefd2';stroke='#c49e4e';}if(e.kind==='gate'){fill='#e8d9ea';stroke='#a16ca2';}if(e.name.startsWith('未标注')){fill='#e8e6ed';stroke='#a8a0b2';}svg.push(`<g><rect x="${e.x}" y="${e.y}" width="${e.width}" height="${e.height}" rx=".25" fill="${fill}" stroke="${stroke}" stroke-width=".18"/>`);const text=small?e.name.match(/\d\d$/)[0]:e.name;const f=small?1.12:Math.min(2.0,e.width/(text.length*.98),e.height*.25);svg.push(`<text x="${e.x+e.width/2}" y="${e.y+e.height/2+(small?.4:-.4)}" text-anchor="middle" font-size="${f}" fill="#344f65">${esc(text)}</text>`);if(!small&&e.referenceAreaM2!==null&&e.height>5){svg.push(`<text x="${e.x+e.width/2}" y="${e.y+e.height/2+2}" text-anchor="middle" font-size="1.35" fill="#668097">${e.referenceAreaM2}m²${e.floor>1?` · ${e.floor}层`:''}</text>`);}svg.push('</g>');}
for(const l of labels)svg.push(`<text x="${l.x}" y="${l.y}" font-size="1.9" font-weight="bold" fill="#536d78">${esc(l.name)}</text>`);
svg.push('<text x="31" y="72" font-size="2.4" fill="#8b9c9e">01 / 入口与箱体庭院</text><text x="89" y="17" font-size="2.4" fill="#8b9c9e">02 / 集市与文创生活区</text><text x="226" y="5" font-size="2.4" fill="#8b9c9e">03 / 内街与综合商业区</text></g>');
svg.push('<g font-family="Arial, sans-serif" font-size="16" fill="#526b76"><rect x="68" y="1120" width="18" height="18" rx="3" fill="#e6eef9" stroke="#6d91bb"/><text x="99" y="1135">建筑 / 独立商铺</text><rect x="300" y="1120" width="18" height="18" rx="3" fill="#fbefd2" stroke="#c49e4e"/><text x="331" y="1135">露天场地 / 摊位</text><rect x="535" y="1120" width="18" height="18" rx="3" fill="#e8d9ea" stroke="#a16ca2"/><text x="566" y="1135">入口（示意）</text><rect x="748" y="1120" width="18" height="18" rx="3" fill="#e8e6ed" stroke="#a8a0b2"/><text x="779" y="1135">用途待核实</text><text x="68" y="1178">面积文字来自原图；多层面积口径待确认。位置、边长、道路及入口为推定示意，未标真实北向，不用于施工或计费。</text><text x="68" y="1208">原图未明确大棚位置，本稿未擅自指定大棚；导入编辑器后可继续绘制。图纸附带完整可编辑 JSON 数据。</text></g></svg>');
fs.writeFileSync('outputs/wutong-courtyard-plan.svg',svg.join(''));
console.log(JSON.stringify({objects:elements.length,units:elements.filter(e=>/ (\d\d)$/.test(e.name)).length,files:['outputs/wutong-courtyard-plan.json','outputs/wutong-courtyard-plan.svg']}));
