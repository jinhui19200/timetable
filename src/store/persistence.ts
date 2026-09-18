import type { AppData } from '../types/entry';
import { createInitialAppData } from './seed';

/**
 * 唯一的数据读写出口。
 *
 * ────────────────────────────────────────────────────────────────
 * ⚠️ 硬约束：组件、reducer、hooks 都不得直接访问 localStorage，必须经由本模块。
 * ────────────────────────────────────────────────────────────────
 *
 * 原因是后续要做用户账号和云同步，届时存储会从 localStorage 换成 HTTP API + 数据库
 * （计划是 Cloudflare Workers + D1）。收口之后，那次替换只改本文件，其余代码零改动。
 *
 * 同理，将来若把托管平台从 Cloudflare 换到别处，数据层也是唯一的改动点。
 *
 * 判断标准很简单：代码里出现 `localStorage` 字样的地方，只应该在本文件里。
 */

const STORAGE_KEY = 'timetable-app:data';
const BACKUP_KEY = 'timetable-app:data:backup';

/** 数据结构版本号。将来字段有破坏性变更时递增，并在 parseEnvelope 里做迁移。 */
const SCHEMA_VERSION = 1;

interface StoredEnvelope {
  version: number;
  data: AppData;
}

/**
 * 取 localStorage。
 *
 * 用 try/catch 包住是因为 Safari 隐私模式下**访问** localStorage 属性本身就会抛异常，
 * 不只是读写操作会失败。
 */
function getStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** 读一个 key，任何异常都当作「没有数据」处理。 */
function readRaw(key: string): string | null {
  try {
    return getStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/**
 * 校验并解析存储内容。
 * 任何一步不对（JSON 坏了、版本不认识、结构不是 AppData）都返回 null，
 * 由调用方决定回退到备份还是初始数据 —— 宁可重来也不要白屏。
 */
function parseEnvelope(raw: string | null): AppData | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;

    const envelope = parsed as Partial<StoredEnvelope>;
    if (envelope.version !== SCHEMA_VERSION) return null;
    if (!isAppDataShape(envelope.data)) return null;

    return envelope.data;
  } catch {
    return null;
  }
}

/** 轻量结构校验：只检查顶层形状，逐字段校验交给 TypeScript 和运行时兜底。 */
function isAppDataShape(value: unknown): value is AppData {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<AppData>;
  return (
    Array.isArray(candidate.entries) &&
    Array.isArray(candidate.periods) &&
    typeof candidate.semester === 'object' &&
    candidate.semester !== null
  );
}

/**
 * 读取数据。
 *
 * 回退顺序：主数据 → 备份 → 初始种子数据。
 * 若主数据损坏但备份可用，会把备份立刻回写为主数据，避免下次启动又读到坏数据。
 */
export function loadAppData(): AppData {
  const primary = parseEnvelope(readRaw(STORAGE_KEY));
  if (primary) return primary;

  const backup = parseEnvelope(readRaw(BACKUP_KEY));
  if (backup) {
    console.warn('[persistence] 主数据不可用，已从备份恢复');
    saveAppData(backup);
    return backup;
  }

  return createInitialAppData();
}

/**
 * 保存数据。
 *
 * 覆盖前先把当前内容挪到备份 key，于是备份永远是「上一个可用版本」。
 * 写失败（配额满、隐私模式）只告警不抛异常 —— 不能因为存不进去就让整个应用崩掉。
 */
export function saveAppData(data: AppData): void {
  try {
    const storage = getStorage();
    if (!storage) return;

    const previous = storage.getItem(STORAGE_KEY);
    if (previous !== null) {
      storage.setItem(BACKUP_KEY, previous);
    }

    const envelope: StoredEnvelope = { version: SCHEMA_VERSION, data };
    storage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch (error) {
    console.warn('[persistence] 保存失败，本次改动可能没有落盘', error);
  }
}

/** 把数据序列化成带缩进的 JSON，供「复制数据」自救入口使用。 */
export function exportDataJson(data: AppData): string {
  return JSON.stringify({ version: SCHEMA_VERSION, data }, null, 2);
}

/** 清空本地存储（主数据与备份一并删除）。下次读取会重新落回种子数据。 */
export function clearStoredData(): void {
  try {
    const storage = getStorage();
    storage?.removeItem(STORAGE_KEY);
    storage?.removeItem(BACKUP_KEY);
  } catch (error) {
    console.warn('[persistence] 清空失败', error);
  }
}
