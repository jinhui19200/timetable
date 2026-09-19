/**
 * /api/account?name=<账户名> —— 读一个账户的整份数据，或整份覆盖写回去。
 *
 * ────────────────────────────────────────────────────────────────
 * 为什么账户名走查询串，而不是 /api/accounts/:username 这种路径参数：
 * 账户名允许中文，放进路径段就要 percent-encode，而 Pages Functions 的
 * context.params 到底给的是编码前的还是编码后的值，官方文档没有写明 ——
 * 一旦它是编码后的，中文账户名就会以 `%E6%88%91%E7%9A%84...` 的形式存进库，
 * 换个客户端按原文去查就查不到。查询串由 URLSearchParams 解码，语义没有歧义。
 * ────────────────────────────────────────────────────────────────
 *
 * 没有做乐观锁（没有 If-Match / version 比对），因为用户明确选定了
 * 「冲突时直接覆盖」：两台设备同时改，后写的那次赢，不做拒绝也不做合并。
 * 因此本文件里没有并发控制代码 —— 那是刻意省掉的，不是漏掉的。
 */

/** 账户名长度上限。太长的名字在弹窗里会折行，也容易被拿来塞垃圾数据。 */
const MAX_USERNAME_LENGTH = 24;

/**
 * 请求体上限 2MB。
 * 实测一份约 200 条记录的课表 JSON 在 60KB 上下，2MB 留了 30 倍余量，
 * 同时能挡住「往库里灌大文件」这种把 D1 撑爆的用法。
 */
const MAX_BODY_BYTES = 2 * 1024 * 1024;

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/**
 * 校验并规整账户名。
 *
 * 服务端必须自己校验一遍 —— 前端那道校验只是体验，任何人用 curl 都能绕过它。
 * 禁掉 `/` `\` 和控制字符：前者会让名字在日志和 URL 里产生歧义，后者纯粹是脏数据。
 */
function normalizeUsername(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.trim();
  if (name.length === 0 || name.length > MAX_USERNAME_LENGTH) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f/\\]/.test(name)) return null;
  return name;
}

/**
 * 只校验顶层形状，和前端 persistence.ts 的 isAppDataShape 口径一致。
 *
 * 不逐字段校验是刻意的：服务端从不解析 data，它只是个带名字的 JSON 盒子。
 * 真要逐字段校验，就得在 Functions 里维护一份和 types/entry.ts 平行的类型定义，
 * 两边一旦不同步，改前端字段反而会被服务端拒收 —— 那是比脏数据更糟的故障。
 */
function isAppData(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray(value.entries) &&
    Array.isArray(value.periods) &&
    typeof value.semester === 'object' &&
    value.semester !== null
  );
}

/** 两个方法共用的前置检查，返回 null 表示可以继续。 */
function preflight(env, name) {
  if (!env.ACCOUNTS_DB) {
    return json({ error: 'binding_missing', message: 'D1 绑定 ACCOUNTS_DB 不存在' }, 500);
  }
  if (!name) {
    return json({ error: 'invalid_username', message: '账户名不合法' }, 400);
  }
  return null;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const name = normalizeUsername(new URL(request.url).searchParams.get('name'));

  const failed = preflight(env, name);
  if (failed) return failed;

  const row = await env.ACCOUNTS_DB.prepare(
    'SELECT username, data, revision, updated_at FROM accounts WHERE username = ?1',
  )
    .bind(name)
    .first();

  // 404 是一个正常结果，不是错误：客户端据此判断「这是个新账户」。
  if (!row) return json({ error: 'not_found' }, 404);

  let data;
  try {
    data = JSON.parse(row.data);
  } catch {
    // 库里存了坏 JSON。这种情况只可能来自手工改库，但仍然要给出可分辨的错误码，
    // 否则客户端只会显示一句无从下手的「同步失败」。
    return json({ error: 'corrupted', message: '服务端数据不是合法 JSON' }, 500);
  }

  return json({
    username: row.username,
    data,
    revision: row.revision,
    updatedAt: row.updated_at,
  });
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const name = normalizeUsername(new URL(request.url).searchParams.get('name'));

  const failed = preflight(env, name);
  if (failed) return failed;

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return json({ error: 'too_large', message: '数据超过 2MB 上限' }, 413);
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return json({ error: 'invalid_json', message: '请求体不是合法 JSON' }, 400);
  }

  if (!isAppData(payload?.data)) {
    return json({ error: 'invalid_data', message: '缺少 entries / periods / semester' }, 400);
  }

  const now = new Date().toISOString();

  // upsert：账户不存在就建，存在就整份覆盖。
  // revision 只在覆盖时 +1，用于显示「这个账户被改过几次」，不参与并发控制。
  await env.ACCOUNTS_DB.prepare(
    `INSERT INTO accounts (username, data, revision, created_at, updated_at)
     VALUES (?1, ?2, 1, ?3, ?3)
     ON CONFLICT(username) DO UPDATE SET
       data       = excluded.data,
       revision   = accounts.revision + 1,
       updated_at = excluded.updated_at`,
  )
    .bind(name, JSON.stringify(payload.data), now)
    .run();

  return json({ username: name, updatedAt: now });
}
