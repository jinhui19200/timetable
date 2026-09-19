import type { AppData } from '../types/entry';

/**
 * 账户数据的远端读写。
 *
 * 这一层只做「发请求 / 解析响应 / 把失败翻译成人话」，不含任何状态管理，
 * 也不碰 localStorage —— 本地存储全在 persistence.ts。
 *
 * 两个刻意的设计：
 *
 * 1. **所有请求都带超时。** 没有超时的话，断网时 fetch 可能挂几十秒，
 *    界面会一直停在「同步中」，用户既不知道出了什么事也没法重试。
 *    超时后走「离线」分支，本地照常可用。
 * 2. **失败一律抛 Error**，由调用方决定是显示还是吞掉。这里不返回 null 之类的
 *    哨兵值 —— 「账户不存在」和「请求失败」是两件事，混成一个 null 会让
 *    调用方没法区分「这是个新账户」和「网络挂了」。
 */

/** 单个请求的超时。8 秒足够覆盖慢速移动网络，又不会让人等到以为卡死。 */
const REQUEST_TIMEOUT_MS = 8000;

export interface AccountSummary {
  username: string;
  revision: number;
  /** ISO 时间字符串 */
  updatedAt: string;
}

interface AccountPayload {
  username: string;
  data: AppData;
  revision: number;
  updatedAt: string;
}

/** 把底层异常翻译成能直接显示给用户的一句话。 */
export function describeSyncError(cause: unknown): string {
  if (cause instanceof DOMException && cause.name === 'AbortError') return '请求超时';
  if (cause instanceof TypeError) return '连不上服务器';
  if (cause instanceof Error) return cause.message;
  return '同步失败';
}

async function request(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

/** 服务端返回的错误码 → 可读文案。未知错误码直接透传，方便排查。 */
async function readError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as { message?: string; error?: string };
    return new Error(body.message ?? body.error ?? `HTTP ${response.status}`);
  } catch {
    return new Error(`HTTP ${response.status}`);
  }
}

/** 列出全部账户名，供切换账户弹窗显示。 */
export async function listAccounts(): Promise<AccountSummary[]> {
  const response = await request('/api/accounts');
  if (!response.ok) throw await readError(response);

  const body = (await response.json()) as { accounts?: AccountSummary[] };
  return body.accounts ?? [];
}

/**
 * 读一个账户的整份数据。
 *
 * 账户不存在时返回 null —— 这是正常结果（客户端据此知道该建新账户了），
 * 不抛异常。除此之外的任何失败都抛。
 */
export async function fetchAccountData(username: string): Promise<AppData | null> {
  const response = await request(`/api/account?name=${encodeURIComponent(username)}`);

  if (response.status === 404) return null;
  if (!response.ok) throw await readError(response);

  const body = (await response.json()) as AccountPayload;
  return body.data;
}

/** 整份覆盖写回。账户不存在时服务端会新建。 */
export async function pushAccountData(username: string, data: AppData): Promise<void> {
  const response = await request(`/api/account?name=${encodeURIComponent(username)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data }),
  });

  if (!response.ok) throw await readError(response);
}
