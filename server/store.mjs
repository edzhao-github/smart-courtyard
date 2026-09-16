import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { validatePlan } from '../lib/plan.ts';
import { validateOperations } from '../lib/operations.ts';

export function openStore(dir) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(resolve(dir, 'courtyard.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS users(name TEXT PRIMARY KEY, salt TEXT NOT NULL, hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, name TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS workspace(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, at TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, revision INTEGER);
    CREATE TABLE IF NOT EXISTS revisions(revision INTEGER PRIMARY KEY, at TEXT NOT NULL, data TEXT NOT NULL);`);
  function audit(actor, action, revision = null) {
    db.prepare('INSERT INTO audit(at,actor,action,revision) VALUES(?,?,?,?)').run(new Date().toISOString(), actor, action, revision);
  }
  function validate(data) {
    const plan = validatePlan(data.plan);
    const operations = validateOperations(data.operations);
    const ids = new Set(plan.elements.map(x => x.id));
    if (operations.bills.some(x => !ids.has(x.spaceId))) throw Error('账单关联的区域不存在');
    return { plan, operations };
  }
  function read() {
    const row = db.prepare('SELECT revision,data FROM workspace WHERE id=1').get();
    return row ? { revision: row.revision, ...JSON.parse(row.data) } : null;
  }
  function save(data, revision, actor) {
    const serialized = JSON.stringify(validate(data));
    db.exec('BEGIN IMMEDIATE');
    try {
      const current = read();
      if ((current?.revision ?? 0) !== revision) { db.exec('ROLLBACK'); return null; }
      const next = revision + 1;
      db.prepare('INSERT INTO workspace VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,data=excluded.data').run(next, serialized);
      db.prepare('INSERT INTO revisions VALUES(?,?,?)').run(next, new Date().toISOString(), serialized);
      // Keep the latest 100 recovery points; daily backups are kept separately.
      db.prepare('DELETE FROM revisions WHERE revision < ?').run(next - 99);
      audit(actor, 'workspace.save', next);
      db.exec('COMMIT');
      return next;
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  function setUser(name, password) {
    if (!/^[a-zA-Z0-9_-]{3,40}$/.test(name) || password.length < 12) throw Error('账号需为3–40位字母数字，密码至少12位');
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    db.prepare('INSERT INTO users VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET salt=excluded.salt,hash=excluded.hash').run(name,salt,hash);
    db.prepare('DELETE FROM sessions WHERE name=?').run(name);
    audit(name, 'account.set');
  }
  function login(name, password) {
    const user = db.prepare('SELECT * FROM users WHERE name=?').get(name);
    const candidate = scryptSync(password, user?.salt ?? 'invalid-account-salt', 64);
    if (!user || !timingSafeEqual(candidate, Buffer.from(user.hash, 'hex'))) return null;
    const token = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token), name, Date.now() + 12 * 3600_000);
    audit(name, 'login');
    return token;
  }
  function session(token) { return db.prepare('SELECT name FROM sessions WHERE token=? AND expires>?').get(digest(token), Date.now())?.name; }
  function logout(token) { db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token)); }
  return { db, read, save, setUser, login, session, logout, audit };
}
function digest(token) { return createHash('sha256').update(token || '').digest('hex'); }
