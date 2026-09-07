import fs from 'node:fs';
import {createSpace,validatePlan} from '../lib/plan.ts';
import sharp from '../node_modules/.pnpm/sharp@0.34.5/node_modules/sharp/lib/index.js';
const elements=[],marks=[];const S=8;
// 原参考图显示坐标（1717×1472），保留原图左下→右上方向；只移除立面和投影。
function rect(name,cx,cy,w,h,angle,area=null,kind='room',floor=1,label=null){const a=angle*Math.PI/180;const x=cx-w/2*Math.cos(a)+h/2*Math.sin(a),y=cy-w/2*Math.sin(a)-h/2*Math.cos(a);const e=createSpace(kind,x/S,y/S,w/S,h/S);Object.assign(e,{name,rotation:angle,floor,referenceAreaM2:area,geometryEstimated:true,notes:`按用户参考图逐块对位，保留左下至右上的图面方向。轮廓与位置来自透视图人工判读，非实测边长；图形面积不作为计费面积。${area!==null?`原图标注面积 ${area}m²；`:'原图面积未确认；'}水电、租金及层高未知。${floor>1?'原图层数已保留，标注面积为单层还是总面积待核实。':''}`});elements.push(e);if(label)marks.push({e,text:label[2]||name,x:label[0],y:label[1]});return e;}
function row(name,n,x1,y1,x2,y2,depth,area,kind='room'){const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy),angle=Math.atan2(dy,dx)*180/Math.PI;for(let i=0;i<n;i++)rect(`${name} ${String(i+1).padStart(2,'0')}`,x1+dx*(i+.5)/n,y1+dy*(i+.5)/n,L/n-.6,depth,angle,area,kind);}
function line(name,a,b){const e=createSpace('line',a[0]/S,a[1]/S,(b[0]-a[0])/S,(b[1]-a[1])/S);e.name=name;elements.push(e);}
const outline=[[46,1056],[142,962],[280,850],[474,691],[652,531],[792,426],[848,330],[906,258],[940,236],[981,234],[1112,302],[1400,461],[1458,510],[1540,459],[1680,526],[1513,865],[1342,875],[1170,931],[1011,1025],[890,1070],[533,1093],[170,1118],[76,1085]];
for(let i=0;i<outline.length;i++)line('园区边界（参照原图）',outline[i],outline[(i+1)%outline.length]);
// 左下入口和箱体围合庭院
rect('入口（图示位置待确认）',136,994,35,7,-44,null,'gate',1,[65,950,'入口（待核实）']);
rect('甘井子水井',103,1038,10,10,0,null,'outdoor',1,[24,1020]);
rect('二层庭院',266,1003,116,76,-42,370,'room',2,[480,1147,'二层庭院 370m² · 2层']);
rect('箱 J1',221,1041,40,16,4,21,'room',1,[194,1190,'箱 J1 · 21m²']);
rect('箱 J2',265,1044,29,16,4,15,'room',1,[310,1220,'箱 J2 · 15m²']);
rect('箱 J3',326,1047,44,18,4,25,'room',1,[391,1190,'箱 J3 · 25m²']);
rect('箱 J4',187,990,61,18,-43,36,'room',1,[32,869,'箱 J4 · 36m²']);
rect('箱 J5',310,915,66,20,44,42,'room',1,[48,807,'箱 J5 · 42m²']);
rect('箱 J6',350,965,51,18,-12,30,'room',1,[80,752,'箱 J6 · 30m²']);
rect('箱 J7',264,942,52,17,-43,30,'room',1,[85,1149,'箱 J7 · 30m²']);
// 沿园区左侧边界由下向上排列，保持原图连续街边关系。
row('固定店铺',10,298,842,451,714,19,25);
rect('固定店铺 50m²',438,1008,80,28,-14,50,'room',1,[29,700,'固定店铺 · 50m²']);
row('集市店铺 A',22,472,696,650,551,22,24);
row('集市店铺 B',12,619,637,754,534,23,24);
// 中部建筑按原图的位置对位：体育馆左下、烟囱庭院中间、仓库上方、工坊最上。
rect('体育馆',582,754,135,87,30,279,'room',1,[343,547,'体育馆 279m²']);
rect('烟囱庭院',661,672,97,67,30,120,'room',1,[341,501,'烟囱庭院 120m² / 庭落277m²']);
rect('白兰地仓库',751,616,123,53,-37,160,'room',1,[440,452,'白兰地仓库 160m²']);
rect('工坊',745,543,128,92,30,298,'room',1,[526,393,'工坊 298m²']);
rect('图书馆',735,568,29,20,30,18,'room',4,[423,422,'图书馆 18m² × F4']);
// 左中道路的露天后备箱集市，原图是三条长条摊位带。
row('后备箱集市',17,407,907,475,847,19,15,'outdoor');
row('后备箱集市',17,442,937,515,872,19,15,'outdoor');
row('后备箱集市',16,480,969,551,905,19,15,'outdoor');
// 修正同名编号：50个摊位连续编号。
elements.filter(e=>e.name.startsWith('后备箱集市 ')).forEach((e,i)=>e.name=`后备箱集市 ${String(i+1).padStart(2,'0')}`);
// 中下方独立院落
rect('高砖墙库',664,911,86,43,-39,95,'room',1,[593,1197,'高砖墙库 95m²']);
rect('矮砖墙库',713,929,54,30,-39,40,'room',1,[718,1224,'矮砖墙库 40m²']);
rect('果美甄选',871,712,160,89,-39,540,'room',1,[830,1190,'果美甄选 540m²']);
rect('青年旅舍',953,982,171,102,-40,194,'room',4,[940,1300,'青年旅舍 194m² × F4']);
rect('泵道服务区',1102,880,131,38,-37,172,'room',1,[1194,1005,'泵道服务区 172m²']);
rect('室内泵道',1003,802,126,49,41,480,'room',1,[1060,1123,'室内泵道 480m²']);
// 原图远端：左侧为自习室/办公管理、两排内街；右側为固定店铺/仓储超市/活力中心。
rect('管理中心',848,448,66,34,31,120,'room',1,[669,319,'管理中心 120m²']);
rect('办公室临建',904,367,91,46,31,259,'room',1,[650,275,'办公室临建 259m²']);
rect('自习室',918,292,99,45,-64,308,'room',2,[711,150,'自习室 308m² × F2']);
row('邻街店铺',13,824,424,879,350,24,23);
row('内街店铺',11,900,461,997,353,19,16);
row('内街店铺',11,916,476,1012,369,19,16);
elements.filter(e=>e.name.startsWith('内街店铺 ')).forEach((e,i)=>e.name=`内街店铺 ${String(i+1).padStart(2,'0')}`);
rect('三宝餐饮店铺',1034,284,116,32,30,391,'room',1,[1150,85,'三宝餐饮店铺 391m²']);
rect('三宝摊位',1017,331,68,35,30,null,'outdoor',1,[962,60,'三宝摊位']);
row('三宝邻街店铺',21,1103,309,1392,463,14,12);
row('三宝邻街店铺',21,1096,323,1385,477,14,12);
elements.filter(e=>e.name.startsWith('三宝邻街店铺 ')).forEach((e,i)=>e.name=`三宝邻街店铺 ${String(i+1).padStart(2,'0')}`);
rect('固定店铺 1075m²',1061,452,153,116,30,1075,'room',1,[1177,170,'固定店铺 1075m²']);
rect('仓储超市',1219,435,248,92,30,1051,'room',1,[1395,242,'仓储超市 1051m²']);
rect('活力中心',1090,589,278,115,30,1463,'room',2,[1210,1220,'活力中心 1463m² × F2']);
rect('海鲜厅（标注待核）',1441,523,73,44,30,200,'room',1,[1510,394,'海鲜厅 200m²（后缀待核）']);
// 右侧原图三个无文字指向的灰紫色建筑，不添加虚构业态。
rect('未标注建筑 A',1575,550,175,103,30,null,'room',1,[1560,680,'未标注建筑 A']);
rect('未标注建筑 B',1507,665,164,96,30,null,'room',1,[1515,782,'未标注建筑 B']);
rect('未标注建筑 C',1434,784,151,92,30,null,'room',1,[1440,898,'未标注建筑 C']);
const extraLabels=[['固定店铺 25m² × 10',195,610,358,795],['集市店铺 24m² × 22',285,569,540,646],['集市店铺 24m² × 12',407,357,684,587],['后备箱集市 15m² × 50',96,659,462,917],['邻街店铺 23m² × 13',707,208,850,390],['内街店铺 16m² × 22',851,109,954,409],['三宝邻街店铺 12m² × 42',1231,126,1263,400]];
const plan=validatePlan({schemaVersion:1,name:'梧桐院 · 原图同向平面修订稿',unit:'m',elements,reference:{source:'用户提供的1717×1472透视参考图',orientation:'保持原图入口左下、园区向右上延伸；非地理北向',method:'逐块人工对位，移除建筑立面与投影；未将园区横向重排。',scale:'图像到编辑坐标暂按8像素/米；没有实测标尺，几何面积无实测意义。',area:'原图标注面积保存在 referenceAreaM2 与 notes，不能使用估算的宽×高进行计费。'}});
fs.writeFileSync('outputs/wutong-courtyard-oriented.json',JSON.stringify(plan,null,2));
const esc=s=>String(s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
let out=`<svg xmlns="http://www.w3.org/2000/svg" width="1717" height="1472" viewBox="0 0 1717 1472"><rect width="1717" height="1472" fill="#fafbfc"/><g font-family="Arial, sans-serif"><text x="45" y="62" font-size="28" font-weight="bold" fill="#29464b">梧桐院 · 原图同向平面修订稿</text><text x="45" y="94" font-size="15" fill="#6c8085">保留原图左下 → 右上方向及相对位置 · 二维轮廓，无立面和阴影</text><polygon points="${outline.map(p=>p.join(',')).join(' ')}" fill="#e7efe7" stroke="#8b9b91" stroke-width="2"/>`;
// 沿原图道路走向，不用贯穿建筑的横向直路。
out+='<path d="M 135 995 L 318 886 L 490 740 L 614 650 L 785 503 L 815 463 L 879 319 L 963 248 L 1100 322 M 330 916 L 552 1023 L 780 1000 L 881 916 L 1068 813 L 1245 784 L 1394 513 M 611 679 L 733 826 L 854 752 L 928 660 L 985 530 M 829 465 L 909 513" fill="none" stroke="#d0d8dc" stroke-width="22" stroke-linejoin="round"/>';
for(const e of elements){if(e.kind==='line')continue;const small=/ \d\d$/.test(e.name);let fill='#f3e8c6',stroke='#ac9860';if(e.name==='活力中心'){fill='#bcd7ec';stroke='#4b83aa';}if(e.name==='仓储超市'){fill='#f8d0b4';stroke='#b5815f';}if(e.name.startsWith('箱')||e.name==='二层庭院'){fill='#edd9ec';stroke='#ac87aa';}if(e.name.startsWith('未标注')){fill='#e0dce8';stroke='#aaa0b8';}if(e.kind==='outdoor'){fill='#f4eedb';stroke='#b4a271';}if(e.kind==='gate'){fill='#ccdfd7';stroke='#557967';}out+=`<g transform="translate(${e.x*S} ${e.y*S}) rotate(${e.rotation})"><rect width="${e.width*S}" height="${e.height*S}" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/></g>`;if(!small&&!marks.some(m=>m.e===e)){const a=e.rotation*Math.PI/180;const cx=(e.x+e.width/2*Math.cos(a)-e.height/2*Math.sin(a))*S,cy=(e.y+e.width/2*Math.sin(a)+e.height/2*Math.cos(a))*S;out+=`<text x="${cx}" y="${cy}" text-anchor="middle" font-size="11" fill="#675f4a">${esc(e.name)}</text>`;}}
function leader(text,x,y,cx,cy){const right=x<cx;const anchor=right?'start':'end';const endx=x+(right?12:-12);out+=`<path d="M ${cx} ${cy} L ${cx} ${y+6} L ${endx} ${y+6}" fill="none" stroke="#93a3a7" stroke-width="1" stroke-dasharray="3 4"/><circle cx="${cx}" cy="${cy}" r="2.5" fill="#6a8187"/><text x="${x}" y="${y}" text-anchor="${anchor}" font-size="16" fill="#2f484f" stroke="#fafbfc" stroke-width="4" paint-order="stroke">${esc(text)}</text>`;}
for(const m of marks){const e=m.e,a=e.rotation*Math.PI/180;leader(m.text,m.x,m.y,(e.x+e.width/2*Math.cos(a)-e.height/2*Math.sin(a))*S,(e.y+e.width/2*Math.sin(a)+e.height/2*Math.cos(a))*S);}
for(const [t,x,y,cx,cy] of extraLabels)leader(t,x,y,cx,cy);
out+='<text x="45" y="1380" font-size="17" fill="#405d64">修订重点：恢复箱体庭院、中部集市与仓库、右上商业建筑、右侧三座建筑之间的原图关系。</text><text x="45" y="1412" font-size="15" fill="#76878b">依据透视图人工判读，不是测绘平面图；标注面积沿用原图，轮廓尺寸待核实。原图未注明地理北向。</text></g></svg>';
fs.writeFileSync('outputs/wutong-courtyard-oriented.svg',out);await sharp(Buffer.from(out)).png().toFile('outputs/wutong-courtyard-oriented.png');console.log({objects:elements.length});
