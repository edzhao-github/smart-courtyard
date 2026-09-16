import { readFileSync } from 'node:fs';
import { openStore } from './store.mjs';
const store = openStore(process.env.COURTYARD_DATA || './data');
const [action, argument] = process.argv.slice(2);
try {
  if (action === 'user') {
    const password = readFileSync(0, 'utf8').trimEnd();
    store.setUser(argument, password);
    console.log(`账号 ${argument} 已设置；旧会话已失效。`);
  } else if (action === 'import') {
    if (store.read()) throw Error('服务器已有数据，拒绝覆盖。请使用登录后的导入功能。');
    const revision = store.save(JSON.parse(readFileSync(argument, 'utf8')), 0, 'migration');
    console.log('迁移完成，版本', revision);
  } else if (action === 'summary') {
    const data = store.read();
    console.log(JSON.stringify(data ? { revision:data.revision, elements:data.plan.elements.length, bills:data.operations.bills.length, parking:data.operations.parking.length, pipes:data.operations.pipes.length, tenders:data.operations.tenders.length } : null));
  } else throw Error('用法：manage.mjs user 账号 < 密码文件 | import 备份.json | summary');
} finally { store.db.close(); }
