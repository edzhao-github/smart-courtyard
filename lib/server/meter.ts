import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { calculateMeterCharge, type Tariff } from '../meter-billing';
export type Reading = { at: string; kwh: number };
type State = { address: string; readings: Reading[]; checkedAt?: string };
const dir = path.join(process.cwd(), '.local-meter');
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => {});
  return next;
}
export function readMeter() { return serialize(query); }
export function changeMeterTariff(price: number) {
  return serialize(async () => {
    if (!Number.isFinite(price) || price < 0 || price > 100000) throw Error('电价范围无效');
    const meter = await query();
    if (!meter.billing) throw Error('缺少初始计费设置');
    if (meter.billing.pricePerKwh === price) return meter;
    const latest = meter.readings[meter.readings.length - 1];
    if (!latest || meter.warning || meter.billing.usageKwh === null) throw Error('当前读数不可用于改价');
    const configPath = path.join(dir, 'config.json');
    const config = JSON.parse(await readFile(configPath, 'utf8'));
    const tariffs: Tariff[] = config.billing.tariffs || [{ startKwh: config.billing.startKwh, pricePerKwh: config.billing.pricePerKwh }];
    if (latest.kwh < tariffs[tariffs.length - 1].startKwh) throw Error('当前读数早于最近改价起点');
    tariffs.push({ startKwh: latest.kwh, pricePerKwh: price, effectiveReadingAt: latest.at });
    config.billing.tariffs = tariffs;
    config.billing.pricePerKwh = price;
    await writeFile(path.join(dir, 'config.tmp'), JSON.stringify(config, null, 2), { mode: 0o600 });
    await rename(path.join(dir, 'config.tmp'), configPath);
    return query();
  });
}
async function query() {
  const config = JSON.parse(await readFile(path.join(dir, 'config.json'), 'utf8'));
  let state: State = { address: config.address, readings: [] };
  try { state = JSON.parse(await readFile(path.join(dir, 'readings.json'), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw Error('本机读数记录无法读取，请保留记录文件后检查。'); }
  if (state.address !== config.address) throw Error('电表编号与历史记录不一致。');
  const result = (warning = '') => {
    const settings = config.billing;
    const valid = settings && typeof settings.startKwh === 'number' && Number.isFinite(settings.startKwh) && settings.startKwh >= 0
      && typeof settings.pricePerKwh === 'number' && Number.isFinite(settings.pricePerKwh) && settings.pricePerKwh >= 0;
    const latest = state.readings[state.readings.length - 1];
    const decreased = state.readings.some((reading, index) => index > 0 && reading.kwh < state.readings[index - 1].kwh);
    const usage = valid && latest && latest.kwh >= settings.startKwh && !decreased
      ? Math.round((latest.kwh - settings.startKwh) * 1000) / 1000 : null;
    const tariffs: Tariff[] = valid ? settings.tariffs || [{ startKwh: settings.startKwh, pricePerKwh: settings.pricePerKwh }] : [];
    const billing = valid ? { startKwh: settings.startKwh, pricePerKwh: settings.pricePerKwh, tariffs,
      usageKwh: usage, amount: usage === null ? null : calculateMeterCharge(latest.kwh, tariffs),
      warning: decreased ? '历史读数曾下降，需核对换表或清零记录后再计算电费。' : '' } : null;
    return { roomName: config.roomName, address: state.address, readings: state.readings, checkedAt: state.checkedAt, warning, billing };
  };
  if (state.checkedAt && Date.now() - Date.parse(state.checkedAt) < 5 * 60_000) return result();
  try {
    const url = new URL('http://api2.tqdianbiao.com/Api/EleMeterState');
    url.searchParams.set('auth', config.authCode);
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), cache: 'no-store', redirect: 'error' });
    if (!response.ok) throw Error('电表平台暂时无法访问。');
    const body = await response.json() as { status: unknown; data?: Array<{ address: string; c0: unknown; rate: unknown; power_modify_time: unknown }> };
    if (Number(body.status) !== 1 || !Array.isArray(body.data)) throw Error('电表平台查询失败，请检查授权配置。');
    const row = body.data.find((entry: { address: string }) => String(entry.address) === config.address);
    if (!row) throw Error('平台未返回已配置的电表。');
    const kwh = Number(row.c0) * Number(row.rate);
    const at = String(row.power_modify_time || '');
    if (row.c0 === '' || row.c0 == null || !Number.isFinite(kwh) || kwh < 0 || !(Number(row.rate) > 0) || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(at) || !Number.isFinite(Date.parse(at.replace(' ', 'T') + '+08:00'))) throw Error('平台读数或抄表时间无效。');
    const latest = state.readings[state.readings.length - 1];
    if (!latest || at > latest.at) state.readings.push({ at, kwh });
    // Same source timestamp is not a new reading, even after a refresh.
    state.checkedAt = new Date().toISOString();
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'readings.tmp'), JSON.stringify(state, null, 2), { mode: 0o600 });
    await rename(path.join(dir, 'readings.tmp'), path.join(dir, 'readings.json'));
    return result(latest && kwh < latest.kwh ? '累计读数下降，可能换表或清零，本段用量不计算。' : '');
  } catch (error) {
    if (state.readings.length) return result('本次同步失败，正在显示本机最后保存的读数。');
    // Never expose upstream URLs or credentials in client errors.
    throw Error('暂时无法获取电表读数，请稍后重试或检查本机授权配置。');
  }
}
