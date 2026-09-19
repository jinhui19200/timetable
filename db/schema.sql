-- 账户表。
--
-- 只存一张表、两列有意义的数据（username / data），刻意不拆成
-- accounts + entries + periods + semester 四张表。
--
-- 原因：这个应用本来就是「整份读、整份写」—— 启动时把整份 AppData 拉下来，
-- 改动后把整份 AppData 推上去。拆表只有在「服务端要按条件查记录」时才有价值，
-- 而这里服务端从不解析 data，它只是个带名字的 JSON 盒子。拆了反而要在
-- Functions 里写一层 AppData ↔ 多表 的映射，那是纯粹多出来的出错面。
--
-- 冲突策略是「后写覆盖先写」（用户明确选定的），所以没有 version 列做乐观锁，
-- revision 只用来显示「这个账户被改过几次」，不参与并发控制。

CREATE TABLE IF NOT EXISTS accounts (
  username   TEXT PRIMARY KEY,
  data       TEXT    NOT NULL,
  revision   INTEGER NOT NULL DEFAULT 1,
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);

-- 切换账户弹窗要按「最近改过的排在前面」列出账户。
CREATE INDEX IF NOT EXISTS idx_accounts_updated_at ON accounts (updated_at DESC);
