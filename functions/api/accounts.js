/**
 * GET /api/accounts —— 列出全部账户名，供「切换账户」弹窗显示。
 *
 * ────────────────────────────────────────────────────────────────
 * ⚠️ 这里返回的是**全库**账户名，不只是本机用过的那些。
 *    因为用户明确选了「只用账户名、不做密码」，这个接口天生是公开的：
 *    任何人既能列出账户名，也能读走任意账户的全部数据。
 *    这是刻意的取舍（省掉整套登录流程），不是疏忽 —— 见 README「账户与同步」。
 * ────────────────────────────────────────────────────────────────
 *
 * 只返回 username / revision / updatedAt，**不返回 data**：
 * 弹窗只需要名字和「多久没动过」，把几百条课程一起塞进列表响应里没有用处。
 */

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  // 账户数据必须实时，任何一层缓存住了都会让「换设备能读到最新数据」这个承诺失效
  'cache-control': 'no-store',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export async function onRequestGet(context) {
  const { env } = context;

  // 绑定没配好时给出可读的原因，而不是抛一个 500 让前端只能显示「同步失败」
  if (!env.ACCOUNTS_DB) {
    return json({ error: 'binding_missing', message: 'D1 绑定 ACCOUNTS_DB 不存在' }, 500);
  }

  const { results } = await env.ACCOUNTS_DB.prepare(
    'SELECT username, revision, updated_at FROM accounts ORDER BY updated_at DESC LIMIT 200',
  ).all();

  const accounts = (results ?? []).map((row) => ({
    username: row.username,
    revision: row.revision,
    updatedAt: row.updated_at,
  }));

  return json({ accounts });
}
