import type { AppData } from '../types/entry';
import { createInitialAppData } from './seed';

/**
 * 唯一的数据读写出口。
 *
 * ────────────────────────────────────────────────────────────────
 * ⚠️ 硬约束：组件、reducer、hooks 都不得直接访问 localStorage，必须经由本模块。
 * ────────────────────────────────────────────────────────────────
 *
 * 账户功能上线后，本模块管两件事：
 *
 * 1. **按账户隔离的本地存储**（同步）。每个账户一份主数据 + 一份备份，
 *    切账户只是换一个 key，不涉及搬数据。
 * 2. **「有改动没推上去」这个标记**（同步）。它让离线编辑不会丢 ——
 *    详见 hasPendingPush 的注释。
 *
 * 网络那半边（拉取 / 推送）在 store/accountsApi.ts，本文件**不碰 fetch**。
 * 这样分工的原因：本地存储的读写是同步且必须永远成功的，网络是异步且随时会失败的，
 * 把两者混在一个模块里，就很容易写出「因为网络失败所以本地也没存上」这种代码。
 *
 * 判断标准很简单：代码里出现 `localStorage` 字样的地方，只应该在本文件里。
 */

/** 账户相关 key 的统一前缀。 */
const PREFIX = 'timetable-app';
/** 当前账户名。 */
const ACCOUNT_KEY = `${PREFIX}:account`;

/**
 * 账户数据的 key 形状：`timetable-app:acct:<账户名>:<槽位>`。
 *
 * 账户名放在中间那一段，而不是像 `timetable-app:data:<账户名>` 那样直接拼在最后 ——
 * 后者会和旧版的备份 key `timetable-app:data:backup` 撞车：只要有人把账户命名成
 * `backup`，他的主数据就会覆盖掉旧版的备份，反之亦然。
 */
function acctKey(account: string, slot: 'data' | 'backup' | 'pending'): string {
  return `${PREFIX}:acct:${account}:${slot}`;
}

/**
 * 账户功能上线前的老 key。
 * 首次启动会把它们整体迁进默认账户，迁完立刻删掉。
 */
const LEGACY_DATA_KEY = `${PREFIX}:data`;
const LEGACY_BACKUP_KEY = `${PREFIX}:data:backup`;

/** 没有账户时的默认账户名。用户可以在切换弹窗里新建别的。 */
export const DEFAULT_ACCOUNT_NAME = '默认账户';

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

function writeRaw(key: string, value: string): void {
  try {
    getStorage()?.setItem(key, value);
  } catch (error) {
    console.warn(`[persistence] 写入 ${key} 失败`, error);
  }
}

function removeRaw(key: string): void {
  try {
    getStorage()?.removeItem(key);
  } catch {
    // 删不掉不影响正确性：下次读到的还是同一份数据，只是多占一点空间
  }
}

/**
 * 校验并解析存储内容。
 * 任何一步不对（JSON 坏了、版本不认识、结构不是 AppData）都返回 null，
 * 由调用方决定回退到备份还是兜底数据 —— 宁可重来也不要白屏。
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

/* ── 启动引导 ─────────────────────────────────────────────── */

/**
 * 首次启动的准备工作，**必须在 React 渲染之前调用一次**。
 *
 * 做三件事：定下当前账户名、把旧版数据迁进默认账户、确保默认账户有一份本地数据。
 * 放在 main.tsx 里而不是组件的 useState 初始化函数里，是因为它要写 localStorage ——
 * StrictMode 下初始化函数会跑两遍，把带副作用的逻辑塞进去是在赌它幂等。
 * 放到渲染前显式跑一次，就不存在这个问题。
 */
export function bootstrapStorage(): void {
  const existing = readRaw(ACCOUNT_KEY);
  const account = existing ?? DEFAULT_ACCOUNT_NAME;
  if (existing === null) writeRaw(ACCOUNT_KEY, account);

  const legacy = readRaw(LEGACY_DATA_KEY);
  const legacyBackup = readRaw(LEGACY_BACKUP_KEY);

  // 旧版数据整体搬过来，而不是丢掉重新种一份 ——
  // 否则用户升级一次就发现自己的课表变回了示例课程，等于「升级把数据弄丢了」。
  //
  // 只在目标位置还空着时才搬。目标已经有数据就不动：那种情况说明旧 key 是更早的一份，
  // 搬过去等于用一个很久以前的版本盖掉当前数据。
  if (legacy !== null && readRaw(acctKey(account, 'data')) === null) {
    writeRaw(acctKey(account, 'data'), legacy);
  }
  if (legacyBackup !== null && readRaw(acctKey(account, 'backup')) === null) {
    writeRaw(acctKey(account, 'backup'), legacyBackup);
  }

  // 老 key 立刻删掉。留着会让「到底迁过没有」变得无法判断：
  // 万一以后账户名被清空，这里会再迁一次，用很久以前的旧数据盖掉新的。
  removeRaw(LEGACY_DATA_KEY);
  removeRaw(LEGACY_BACKUP_KEY);

  // 种子数据只在**真正的首次启动**（连账户名都还没有）时才落。
  // 不写成「目标为空就补一份」：用户主动清空数据之后，键里存的是一份空数据，
  // 那种情况下再补一份示例课程，等于「清空」这个操作没生效。
  if (existing === null && readRaw(acctKey(account, 'data')) === null) {
    writeRaw(acctKey(account, 'data'), envelopeOf(createInitialAppData()));
  }
}

function envelopeOf(data: AppData): string {
  const envelope: StoredEnvelope = { version: SCHEMA_VERSION, data };
  return JSON.stringify(envelope);
}

/* ── 当前账户 ─────────────────────────────────────────────── */

/** 读当前账户名。没设置过返回默认账户名（此时本地还没有它的数据，会走兜底）。 */
export function getAccountName(): string {
  return readRaw(ACCOUNT_KEY) ?? DEFAULT_ACCOUNT_NAME;
}

export function setAccountName(account: string): void {
  writeRaw(ACCOUNT_KEY, account);
}

/* ── 账户数据（同步） ─────────────────────────────────────── */

/** 某个账户在本机有没有数据。用来区分「本机第一次见到的账户」和「本机已有的账户」。 */
export function hasLocalData(account: string): boolean {
  return readRaw(acctKey(account, 'data')) !== null;
}

/**
 * 读取某个账户的本地数据。
 *
 * 回退顺序：主数据 → 备份 → 调用方给的兜底。
 *
 * 兜底由调用方决定、不写死成种子数据，是因为两种场景要的东西正好相反：
 * 首次启动的默认账户应该看到示例课程（否则一打开是空白，会以为应用坏了），
 * 而用户新建的账户必须是空的（否则等于把示例课程塞进他刚建的空账户里）。
 */
export function loadLocalData(account: string, fallback: AppData): AppData {
  const primary = parseEnvelope(readRaw(acctKey(account, 'data')));
  if (primary) return primary;

  const backup = parseEnvelope(readRaw(acctKey(account, 'backup')));
  if (backup) {
    console.warn(`[persistence] 账户「${account}」主数据不可用，已从备份恢复`);
    saveLocalData(account, backup);
    return backup;
  }

  return fallback;
}

/**
 * 保存某个账户的数据。
 *
 * 覆盖前先把当前内容挪到备份 key，于是备份永远是「上一个可用版本」。
 * 写失败（配额满、隐私模式）只告警不抛异常 —— 不能因为存不进去就让整个应用崩掉。
 */
export function saveLocalData(account: string, data: AppData): void {
  try {
    const storage = getStorage();
    if (!storage) return;

    const key = acctKey(account, 'data');
    const previous = storage.getItem(key);
    if (previous !== null) storage.setItem(acctKey(account, 'backup'), previous);

    storage.setItem(key, envelopeOf(data));
  } catch (error) {
    console.warn('[persistence] 保存失败，本次改动可能没有落盘', error);
  }
}

/* ── 待推送标记 ───────────────────────────────────────────── */

/**
 * 「这个账户在本机有改动、但还没成功推给服务端」。
 *
 * 存在的唯一理由是**别让离线时的编辑凭空消失**：
 * 断网改了两条课、推送失败、然后关掉页面 —— 如果没有这个标记，
 * 下次启动会先拉远端（还是旧的），把本地的改动盖掉，而且事后完全看不出来。
 * 有了它，下次启动会先推本地，再拉远端。
 *
 * 标记只在**推送失败**时打上，不在拉取失败时打 —— 拉取失败说明不了本地是不是更新的，
 * 这时推上去反而可能用陈旧数据覆盖别的设备刚做的改动。
 */
export function hasPendingPush(account: string): boolean {
  return readRaw(acctKey(account, 'pending')) === '1';
}

export function markPendingPush(account: string): void {
  writeRaw(acctKey(account, 'pending'), '1');
}

export function clearPendingPush(account: string): void {
  removeRaw(acctKey(account, 'pending'));
}

/* ── 自救入口 ─────────────────────────────────────────────── */

/** 把数据序列化成带缩进的 JSON，供「复制数据」自救入口使用。 */
export function exportDataJson(data: AppData): string {
  const envelope: StoredEnvelope = { version: SCHEMA_VERSION, data };
  return JSON.stringify(envelope, null, 2);
}

/** 清空某个账户的本地存储（主数据、备份、待推送标记一并删除）。 */
export function clearStoredData(account: string): void {
  removeRaw(acctKey(account, 'data'));
  removeRaw(acctKey(account, 'backup'));
  removeRaw(acctKey(account, 'pending'));
}
