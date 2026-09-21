# 时间表（timetable）

手机竖屏的课程表 / 时间表网页应用。以课程表为底，可以往同一个网格里加其他事件（组会、值班、健身……）。

## 快速开始

```bash
cd app
npm install
npm run dev
```

浏览器打开 <http://localhost:5173/>。

要在手机上看效果：终端启动后会打印一行 `Network:` 开头的局域网地址（形如 `http://192.168.x.x:5173/`），手机连同一个 Wi-Fi 直接访问即可。

> 注意：局域网访问走的是 http 而非 https，属于「非安全上下文」。所以代码里不能用 `crypto.randomUUID()`（此时它是 undefined），ID 生成走的是 `src/domain/id.ts` 里的自建方案。

**`npm run dev` 不带账户同步。** Vite 开发服务器只跑前端，`/api/**` 会返回 index.html，于是启动拉取失败、界面显示「未同步」—— 这是设计好的降级路径（本地优先，断网照常可用），不是故障。要连着 Functions 和 D1 一起调：

```bash
npm run build
npx wrangler d1 execute timetable-accounts --local --file=db/schema.sql   # 只需第一次
npx wrangler pages dev dist --port 8788
```

打开 <http://127.0.0.1:8788/>。本地 D1 是一个独立的 sqlite，和线上库互不影响。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器（含热更新，**不含 Functions**） |
| `npm run build` | 生产构建，产物在 `dist/` |
| `npm run preview` | 本地预览构建产物 |
| `npm run lint` | ESLint 检查，提交前应当零报错 |
| `npm run format` | Prettier 格式化 |

## 功能

- **课表网格**：横向周一~周日，纵向节次。上午 / 下午 / 晚上之间有视觉空档。
- **周次切换**：顶部左右箭头翻周，**也可以直接在网格上左右横划**。每列显示对应日期，到头时停住而不是循环。
- **周次默认「仅当前周」**：新建时周次默认落在**正在看的那一周** —— 课表页给当前翻到的那周，主页给今天所在的周。需要连上几周或全学期时切到「自定义周次」。临时安排（一次组会、一次补考）远比一上一学期的课常见，默认给「全学期」等于每次都要手动改。
- **单双周与不连续周次**：周次存的是「规则」（起止周 + 单/双），不是展开后的周次数组。这样编辑时能原样还原成控件，不会把「第 1-8 周 + 第 11-16 周」这种规则悄悄改掉。
- **两种时间表达**：
  - 课程固定按**节次**（第 3~4 节），不显示具体钟点。
  - 事件可以按节次，也可以按**真实钟点**（如 19:00~20:30），按真实时间比例落在网格上。
- **课间空档里的事件**：节次之间真实存在的课间（第 2 节 09:55 结束、第 3 节 10:15 开始）在固定行高下被压成 0 像素，落在里面的钟点事件（如 09:58~10:05）没有属于自己的位置。这类事件以**虚线浮标**的形式骑在空档边界上，并且**单独切段、不参与普通记录的切段** —— 否则一个 7 分钟的课间事件会在两侧课程上切出一道并不存在的重叠带，把正常课程的颜色也染混。
- **表单全部用自绘控件**：选择器、时间、日期都是应用内自己画的，不用原生 `<select>` / `<input type="time">` / `<input type="date">`。原因是手机浏览器会把它们弹成系统原生界面（iOS 上是全屏列表和表盘），和电脑端完全是两种东西；而且原生 time 控件在窄格里会被截成「15:0」。自绘之后两端表现一致，输入值也一定是合法的。
- **修改功能**（本项目的重点）：点任意课程/事件 → 底部抽屉显示详情 → 点「编辑」改任意字段。也可以点空白格子直接新建，会自动预填那一格的星期与节次。
- **冲突提醒**：保存时若与已有安排重叠，会提示是哪几条，但**不阻止保存**。单双周错开的情况不算冲突。重叠按**真实时间**判断，不是按网格上的像素位置 —— 否则落在课间空档里的事件会误报成和第 3 节冲突。
- **时间冲突在网格上做重叠显示**：两条记录时间撞上时不再并排错开，而是按时间边界**纵向切段**，重叠的那一段用**两者的混合色**（比两侧更浅）+ 一道内描边标出来，并在这一段里显示合并后的名称。两条记录时间**完全相同**时切出来只有一段，名称自然合并成一条。点重叠段会弹出候选列表让你挑一条看详情 —— 重叠段在界面上是一整块，没有这个入口的话第二条就永远点不到了。
- **转场时间**：新建一条安排后，如果它和**紧邻的前一条 / 后一条**之间隔了 30 分钟以内，会问一句要不要补一条灰色的「转场」记录把这段填上（两节课之间要换楼，这段时间在课表上本来是空白，看不出需要移动）。转场就是一条普通的钟点事件，可以照常编辑和删除；编辑已有记录时不会再弹这个提示。
- **配色**：按名称自动分配（同名课程永远同色），也可手动指定；手动选过之后就不再被名称覆盖。
- **自动保存**：改动自动写入浏览器 localStorage，不需要点保存。
- **多账户 + 云端同步**：主页顶部显示当前账户，点「切换」可以换账户或只输一个名字新建账户。每个账户的课表互相独立，换台设备输入同一个账户名就能读回同一份数据。**没有密码。** 详见下面「账户与同步」。
- **太矮的块降级排版**：午休 / 晚休这类跨分组空档在网格上只有 24px，落在里面的钟点事件按比例可能只分到十几甚至几 px；重叠带也可能被切得很窄（两条记录只重合 5 分钟）。块高排不下一行正文（< 23px）时换成 11px 单行小字，再矮到连它都放不下（< 13px）就只留一条色条、不排文字 —— 免得出现「文字被从中间横向切断」的糊块。极矮的块在「主页」的今日安排里仍是一条完整卡片，不会找不到。
- **宽屏不拉伸**：桌面浏览器打开时按手机比例（420px）居中显示，两侧留白。这是个手机竖屏应用，拉满全宽会让七列铺得过开、失去「一屏看完整周」的比例感。

## 账户与同步

### 怎么用

主页顶部有一张账户卡片，显示当前账户名和同步状态。点「切换」弹出弹窗，里面列出云端已有的账户，也可以直接在输入框里打个新名字新建 —— 只输名字，不用密码，不用邮箱。

### 同步策略：本地优先

- **本地永远是主副本。** 每次改动先同步写进 localStorage，与网络无关。网络失败只会让云端落后，不会让本地丢东西，也不会挡住用户继续编辑。
- **启动拉一次。** 打开应用时从服务端取一次；取到就整份替换本地。**取不到（服务端还没有这个账户）而本机有数据时反过来推上去** —— 否则这个账户会永远只活在本机，详见「不能踩的坑」里的幽灵账户。
- **改动后推一次。** 防抖 700ms，连续编辑合并成一次请求，整份覆盖写回。
- **冲突直接覆盖。** 没有版本比对、没有字段合并，后写的那次赢。所以代码里没有任何并发控制 —— 那是刻意省掉的，不是漏掉的。

### 断网与关页面

- 断网时应用照常可用，账户卡片显示「未同步」。
- 推送失败会就地打一个 `pending` 标记（同步写，一定会留下）。下次启动看到这个标记就**先补推、再拉取**，否则远端那份旧数据会把离线时做的编辑盖掉。
- 关页面（`pagehide`）时会同步落盘一次，并补一次推送。补推前先打标记 —— 页面卸载时请求很可能发不出去，标记留下了下次启动才救得回来。

### ⚠️ 安全取舍（重要）

**没有密码 = 没有隐私。** 任何人只要知道账户名，就能：

- 从 `GET /api/accounts` 拿到全部账户名；
- 用 `GET /api/account?name=<账户名>` 读走那个账户的全部数据；
- 用 `PUT` 覆盖它。

这是「只用账户名」这个选择的必然结果，不是实现漏洞。适用场景是**个人自用**：防的是「换台设备要重新录一遍课表」，不是「防别人看」。要真正隔离，必须加一道鉴权（哪怕只是一个共享口令），那就得改 `functions/api/account.js` 和 `src/store/accountsApi.ts` 两处。

## 数据存在哪

### 浏览器 localStorage（主副本）

按账户分开存，键的形状是 `timetable-app:acct:<账户名>:<槽位>`：

| 键 | 内容 |
| --- | --- |
| `timetable-app:account` | 当前账户名 |
| `timetable-app:acct:<账户名>:data` | 该账户的主数据 |
| `timetable-app:acct:<账户名>:backup` | 该账户的上一个可用版本（每次保存前自动挪一份） |
| `timetable-app:acct:<账户名>:pending` | 「有改动还没推上去」的标记 |

读取顺序是「主数据 → 备份 → 兜底」，任何一步坏了都往后退一层，不会白屏。

**所有读写必须经过 `src/store/persistence.ts`**，组件和 reducer 里不允许直接出现 `localStorage`。网络那半边（拉取 / 推送）单独放在 `src/store/accountsApi.ts` —— 本地存储是同步且必须永远成功的，网络是异步且随时会失败的，混在一个模块里很容易写出「因为网络失败所以本地也没存上」。

### 云端（Cloudflare D1）

一张表，两列有意义的数据：

```sql
CREATE TABLE accounts (
  username   TEXT PRIMARY KEY,
  data       TEXT NOT NULL,      -- 整份 AppData 的 JSON
  revision   INTEGER NOT NULL,   -- 被改过几次，只用于显示，不参与并发控制
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**刻意不拆成 accounts + entries + periods + semester 四张表。** 这个应用本来就是「整份读、整份写」，服务端从不解析 `data`，它只是个带名字的 JSON 盒子。拆表只有在「服务端要按条件查记录」时才有价值，而这里拆了只会多出一层 AppData ↔ 多表的映射，是纯粹多出来的出错面。

## 几个不能踩的坑

- **节次存的是数组下标，不是节号。** 默认节次表里「第 15 节」排在「第 11 节」之前（教务系统自己配的顺序），任何按节号数值排序的做法都会把它放错位置。节号只用于显示。
- **不要给事件加 `teacher` / `credit` 字段。** 课程和事件是 discriminated union，靠 `kind` 字段区分，编译器会强制你先判断 `kind` 才能取这些字段。
- **TypeScript 锁在 `~5.9.3`。** `typescript-eslint@8` 的 peerDependencies 是 `typescript >=4.8.4 <6.1.0`，装最新的 7.x 会让 lint 直接起不来。
- **`tsc -b` 有增量缓存，会漏报类型错误。** 实测过一次：`EntryFormSheet` 的 `preset` 类型漏改了 `currentWeek`（把它提成独立 prop 时只改了一半），而 `tsc -b` 因为 `.tsbuildinfo` 还在、直接跳过了检查，报「通过」。改完类型相关的东西，要**删掉 `.tsbuildinfo` 再跑一次全量**，否则问题会一路带到线上：

  ```bash
  find . -maxdepth 2 -name '*.tsbuildinfo' -not -path './node_modules/*' -delete && npx tsc -b
  ```

- **时间一律存 `'HH:mm'` 字符串**，不存 Date 对象，避免时区与夏令时偏移。解析/格式化统一走 `domain/clock.ts`，不要在各处自己 `split(':')`。
- **网格列宽不写死。** 列宽由 CSS 用 flex 平分容器宽度（上下限见 `layout.ts` 的 `MIN_DAY_WIDTH` / `MAX_DAY_WIDTH`），目标是让周一~周日**一屏铺满、不用横向滑动**。`layoutDay` 只算纵向坐标，完全不碰像素宽度 —— 切段切出来的每一段都铺满整列宽（左右各留 `BLOCK_INSET`），所以调列宽不需要动任何布局计算。
- **不要给横划的判定区域加 transform 动画。** 换周时 `.grid-days` 会重挂并播一段动画，**只动 opacity**。任何 `translate` 都会撑大外层滚动容器的 `scrollWidth`（实测 390 → 399），而横划的守卫正是靠它判断「能不能横向滚动」—— 结果是动画那 180ms 内横划被吞掉，表现为连划几下总有一两下不生效。守卫本身也已改成用常量算宽度，不读 `scrollWidth`。
- **课间空档里的钟点事件必须和普通记录分开切段。** 这类块的高度是 `MIN_CLOCK_HEIGHT` 补出来的（它所在的空档在网格上占 0 像素），而它在**真实时间上和相邻课程并不重叠**。一旦让它和普通块一起切段，它会在两侧课程上切出两道并不存在的重叠带，把正常课程的颜色也染混 —— 用户看到的是一节正常的课无故变成三截、颜色还对不上。所以 `layoutDay` 把它们分成两批分别调 `segmentBlocks`，浮块另外用 `centerOnBoundary` 以空档边界为中心摆放，让上下两节各只被压半行。`BlockGeometry.floating` / `PositionedEntry.floating` 就是这个标记。
- **冲突检测必须按真实时间判重叠，不能按像素区间。** 和上一条同源：网格行高固定、课间空档被压成 0 像素，所以「像素上挨着」不等于「时间上重叠」。早先 `findConflicts` 用像素区间判，一个 09:58~10:05 的事件会报「与第 3 节的课（10:15~10:55）时间重叠」—— 而提示文案明确写的就是「时间重叠」，等于在陈述一件不成立的事。现在走 `getRealTimeRange()` 换算成「当天第几分钟」再求半开区间交，端点相接（19:40 结束 / 19:40 开始）不算重叠。**凡是判断「两件事时间上是否冲突」，都要用真实时间，不要复用为渲染服务的像素坐标。**（`transitions.ts` 判断「隔了多久」也复用同一个函数，两处口径必须一致。）

- **重叠切段的边界要过滤浮点碎片。** 切点来自各块的 `top` 和 `top + height`，两条不同记录算出的同一个时刻在浮点下可能差最后几位（实测 0.3 vs 0.30000000000000004），于是会多出一个高度约 1e-17 的碎片分段 —— 渲染出来是个看不见的空 DOM 节点。`MIN_SEGMENT_HEIGHT = 0.5` 就是干这个的，低于半像素的段直接丢掉，不会损失任何信息。

- **重叠带的颜色必须往白色淡化，不能只取平均。** 两条记录**颜色相同时**（同一门课排了两次、或两条都用中性灰），平均之后和原色一模一样，重叠就完全看不出来了 —— 而看不出重叠正是要解决的问题。见 `colors.ts` 的 `blendPaletteColors`：底色取平均后再往白色混 25%（`OVERLAP_LIGHTEN`），文字色只取平均不淡化（底色已经变浅，再把文字调浅会掉到对比度不足）。另外 `--overlap` 还加了一道内描边作为不依赖颜色的兜底信号，用 `inset box-shadow` 而不是 `border`（`border` 会占掉内边距，让本来就只有一两行位置的重叠带更放不下文字）。

- **块高不足一行时文字会被横向切断，必须降级排版。** 正文 12px 字号 × 1.25 行高 = 15px，加上下各 4px 内边距需要 23px；`overflow: hidden` 会把排不下的行**从中间切断**，看起来像渲染坏了，比不显示还糟。阈值是 `layout.ts` 的 `MIN_TEXT_HEIGHT`（23）/ `MIN_TIGHT_HEIGHT`（13），`EntryBlock` 据此打 `--tight` / `--sliver` 标记，样式在 `global.css`。**改字号或内边距时这两个阈值要一起改**，否则降级会漏掉一档。注意这和 `floating` 是两回事：`floating` 是零像素、高度靠 `MIN_CLOCK_HEIGHT` 补出来；这里像素是真实的，只是不够排一行字。

- **「仅当前周」的模式必须从数据推出来，不能存成独立状态。** 见 `WeekRangeEditor`：只有当规则恰好等于「第 currentWeek 周、每周、单段」时才算「仅当前周」。若改成「打开表单就默认进当前周模式」，那么打开一条存在第 4 周的历史记录、而今天在第 12 周时，界面会显示成「仅第 12 周」，用户随手一保存就把记录挪到第 12 周了 —— 数据被静默改错，还很难发现。

- **转场记录不要存「这是转场」的字段。** 它靠标题 `TRANSITION_TITLE = '转场'` 识别。加一个 kind 或 flag 要动 Entry 联合类型、表单、详情、导入校验一整条链路，而收益只是「改标题后仍能认出它是转场」—— 那件事没有实际用途。同理，转场的周次**直接继承新建的那条记录**、不取和邻居的交集：交集在「单双周 vs 每周」这种组合下会碎成一串单周区间（第 1 周、第 3 周、第 5 周…），详情面板里读起来是一长串，比它解决的问题更糟。

- **账户名不能直接拼在 key 的最后一段。** 键的形状是 `timetable-app:acct:<账户名>:data`，账户名在**中间**。写成 `timetable-app:data:<账户名>` 会撞上旧版的备份键 `timetable-app:data:backup` —— 只要有人把账户命名成 `backup`，两边就互相覆盖。

- **切换账户必须原子地换掉「账户名」和「数据」。** 见 `useAccountStore` 的 `rootReducer`：两者放在同一个 reducer state 里。如果拆成两个独立的 state，中间必然有一帧是「名字已经是 B、数据还是 A」，而推送逻辑正是按名字取数据的 —— 它会在那一帧把 A 的课表推到 B 名下。

- **拉取完成前不许推送。** 不设这道闸门的话，每次打开应用都会先用本机旧数据把远端盖掉一次：本机数据先渲染 → 防抖推送发出 → 拉取结果才回来（此时远端已被覆盖）。而且盖完两边就一致了，事后完全查不出发生过什么。

- **闸门关着期间发生的改动必须记一笔，闸门打开时补推。** 这是上面那条的配套：改动不能推（会盖掉远端），但已经落本地了，不记的话闸门打开时没有任何东西会把它叫醒 —— 这次改动永远留在本机，而且因为没打 `pending` 标记，下次启动还会被远端数据盖掉，等于凭空消失。离线时最容易撞上：拉取要等 8 秒超时，这 8 秒里用户完全可能改东西。见 `deferredPush`。

- **每个账户的首次渲染不算「用户改动」。** 首次渲染只是把刚读到的本地数据回写一遍。不排掉它，`deferredPush` 会在每次启动时被误置为 true。见 `primedFor`。

- **不能有「只存在于本机」的账户（幽灵账户）。** 账户列表来自服务端，而推送只在「有改动」时触发 —— 于是一个**有数据、但用户从没编辑过**的账户永远上不了服务端。它一旦被切走就再也列不出来，用户手动输入同名想切回去时会被判成「新建」，而新建会先写一份空数据占位，**本机的课表当场被抹掉**。首次启动的默认账户正好是这个情况：它有种子数据，但用户可能一直没编辑过。两处都要堵，缺一不可：

  - **拉取时发现「服务端没有、本机有」就把它推到服务端**，消灭幽灵状态本身；
  - **重名判断要同时看服务端列表和本机存储** —— 断网时列表是空的，只靠列表会把「切回去」误判成「新建」。这是断网时的兜底，那时前一条走不到（请求失败）。

  验证见 `e2e-account.js` 的「1. 首次启动」和「7b. 离线时手动输入账户名，不能被当成新建」两节。

- **验证脚本里不能直接在应用页面上清 localStorage。** 清完再跳转会触发 `pagehide`，而应用的 `pagehide` 处理器会把 React 当前那份数据同步写回 —— 刚清掉的键立刻被填了回来，「首次启动 / 换设备」这类场景根本走不到。要先跳到一个不加载应用的页面（脚本用的是 `/api/accounts`，它返回 JSON）再清。见 `.workbuddy-ai/scripts/e2e-account.js` 的 `resetStorage`。

- **`.wrangler` 要进 `.gitignore`，也要进 eslint 的 `ignores`。** 它是 wrangler 的本地状态目录（本地 D1 的 sqlite、`pages dev` 编译出来的临时 bundle）。不忽略的话，只要本地开发服务器开着，`npm run lint` 就会对着那些自动生成的文件报几百个错 —— 而它们根本不是我们的代码。

- **`GET /api/account?name=<新账户>` 返回 404 是正常结果，不是错误。** 客户端据此判断「这是个新账户」。因此浏览器控制台里必然会出现一条 `Failed to load resource: 404`，验证脚本要把这条过滤掉，否则「无运行时错误」这条断言永远不过。

## 开发约定

- 提交前 `npm run lint` 和 `npm run build` 都要通过。**`npm run build` 里带 `tsc -b`，但增量缓存会漏报 —— 改过类型相关的东西要按上面那条删缓存重跑。**
- 注释用中文，命名用英文。重点模块（`weeks.ts` / `layout.ts` / `timeAxis.ts` / `useAccountStore.ts`）的注释解释「为什么这么做」，而不只是「做了什么」。
- 新建/编辑表单一律走 `components/entry/EntryFormSheet.tsx` —— 它是全应用唯一的写入口。将来接截图识别或文件导入，那些来源也必须汇到这里。
- 数据写入一律走 `store/reducer.ts` 的 action，存储读写一律走 `store/persistence.ts`。

## 目录结构

```
app/
├─ functions/                Cloudflare Pages Functions（服务端）
│  └─ api/
│     ├─ accounts.js         GET  列出全部账户名
│     └─ account.js          GET  读一个账户 / PUT 整份覆盖写
├─ db/schema.sql             D1 建表语句（改完要 --local 和 --remote 各执行一次）
├─ wrangler.jsonc            Pages 项目配置：构建产物目录 + D1 绑定
├─ src/
│  ├─ types/entry.ts         全部类型定义（改动前先读文件头的三条设计约定）
│  ├─ domain/                纯逻辑，不依赖 React
│  │  ├─ periods.ts          默认节次表、学期默认值
│  │  ├─ date.ts             日期工具（用 UTC 归一化绕开夏令时）
│  │  ├─ weeks.ts            周次规则：展开、包含判断、合并、重叠检测
│  │  ├─ colors.ts           莫兰迪色板、按名称哈希取色
│  │  ├─ layout.ts           网格布局：像素定位、重叠切段、冲突检测
│  │  ├─ transitions.ts      转场时间：找前后相邻空档、造灰色转场记录
│  │  ├─ timeAxis.ts         真实时间 ↔ 像素的分段线性映射
│  │  ├─ clock.ts            'HH:mm' 的解析 / 格式化 / 加分钟 / 转当天分钟数
│  │  └─ entryView.ts        时间的显示文本
│  ├─ store/                 状态与持久化
│  │  ├─ context.ts          context 对象与类型（含同步状态）
│  │  ├─ StoreProvider.tsx   状态提供者
│  │  ├─ useStore.ts         读取状态的 hook
│  │  ├─ reducer.ts          全部数据修改都在这里
│  │  ├─ persistence.ts      **唯一**碰 localStorage 的模块（含启动迁移）
│  │  ├─ accountsApi.ts      云端读写（只发请求，不管状态）
│  │  └─ seed.ts             首次打开时的示例数据
│  ├─ hooks/
│  │  ├─ useAccountStore.ts  账户 + 数据 + 同步三合一（同步策略都在这）
│  │  ├─ useEntryEditor.ts   新建/编辑/删除的交互状态
│  │  └─ useHorizontalSwipe.ts  横划识别
│  ├─ components/
│  │  ├─ common/             SelectField / TimeField / DateField / Icon / BottomSheet
│  │  ├─ account/            主页账户卡片、切换账户弹窗
│  │  ├─ layout/             应用外壳与标签栏
│  │  ├─ timetable/          网格、日列、时间列、周次切换器
│  │  ├─ entry/              详情、表单、重叠段候选列表（EntryFormSheet 是唯一写入口）
│  │  └─ config/             设置面板与节次表编辑器
│  ├─ pages/                 页面（课表页、主页）
│  └─ styles/                CSS 变量与全局样式
```

## 部署

已上线：**https://timetable-e6l.pages.dev**（Cloudflare Pages，项目名 `timetable`，生产分支 `main`）。

当前用 wrangler **手动直传 `dist`，不是 Git 集成** —— `git push` 不会自动上线，改完要重跑：

```bash
npm run build
env -u NODE_OPTIONS npx --yes wrangler@latest pages deploy dist --project-name=timetable --branch=main --commit-dirty=true
```

`wrangler.jsonc` 存在时，`wrangler pages deploy` 会用它作为项目配置（含 D1 绑定），所以部署命令本身不需要额外参数。

⚠️ **`npx` 必须带 `--yes`**：不带的话它会停在 `Ok to proceed? (y)` 等输入，而自动化环境里 stdin 不是终端，表现为「命令永久挂住且没有任何输出」，很容易误判成网络问题。

### 关于 Git 集成

**不要指望事后切过去。** Cloudflare 官方文档明确写着：Direct Upload 项目**不能**改成 Git 集成，只能新建一个项目。

> If you choose Direct Upload, you cannot switch to Git integration later. You will have to create a new project with Git integration.

（这一条推翻了本文件早先的写法 —— 当时写着「在 Settings → Builds & deployments 连上仓库即可」，是错的。）

真要自动化，可选：新建一个 Git 集成的项目并迁移；或者在仓库里加一个 GitHub Action，push 时跑上面的 `wrangler pages deploy`。

### 首次部署前要做的两件事

1. **建库并建表**（只需一次）：

   ```bash
   npx wrangler d1 create timetable-accounts     # 输出里的 database_id 填进 wrangler.jsonc
   npx wrangler d1 execute timetable-accounts --remote --file=db/schema.sql
   ```

2. **确认绑定生效**：`wrangler.jsonc` 里的 `d1_databases[].binding` 必须是 `ACCOUNTS_DB`，和 `functions/api/*.js` 里读的 `env.ACCOUNTS_DB` 对上。绑错了 `GET /api/account` 会返回 `{"error":"binding_missing"}`（不是 500 空响应）—— 看到这个错就直接查绑定。

⚠️ `wrangler.jsonc` 一旦被使用，它就是 Pages 项目配置的**唯一真实来源**：同名字段之后不能再在 Dashboard 里改，改了也不生效。以后加绑定请改这个文件。

### 其它

本应用**没有 URL 路由**（纯 React state 切标签），所以不需要 SPA 回退规则（`_redirects`），静态托管直接可用。将来若引入 history 模式路由，必须补上 `_redirects`。

Pages 对未匹配到静态资源的路径会返回 `200 + index.html`（实测：随便编一个 `/_definitely_not_here_12345` 也是 200、`content-type: text/html`），所以**光靠 HTTP 状态码判断不出某个文件到底存不存在** —— 想确认 `_routes.json`（把静态资源排除在 Functions 调用之外、不占 Functions 额度）有没有生成，得看部署详情，不能 `curl`。

加了 Functions 之后，每个请求默认都会走一遍 Functions（没有匹配的才回落到静态资源）。个人自用完全够用；真要省额度就自己往 `dist/` 里放一份 `_routes.json`：

```json
{ "version": 1, "include": ["/api/*"], "exclude": [] }
```

## 验证脚本

`.workbuddy-ai/scripts/` 下有一组 Playwright 脚本（不进仓库，需要 `playwright`）。跑之前设 `NODE_PATH`：

```bash
NODE_PATH=~/.workbuddy-ai/binaries/node/workspace/node_modules node .workbuddy-ai/scripts/e2e-account.js http://127.0.0.1:8788 webkit
```

| 脚本 | 测什么 |
| --- | --- |
| `e2e-account.js` | 账户与同步：迁移、幽灵账户补建、上传、新建/切换、重名、换设备、离线、离线查重、冲突覆盖、清空与导入也要同步到云端 |
| `probe-account-ui.js` | 账户 UI 几何：三种视口下账户卡片与切换弹窗是否完整可见、长名字会不会把「切换」按钮挤出屏幕、账户多了列表会不会把新建表单顶出屏幕 |
| `e2e-write.js` | 新建 → 详情 → 编辑 → 删除 → 冲突提示 → 刷新持久化 |
| `e2e-overlap.js` | 重叠切段、混合色、候选列表、周次默认值、转场 |
| `e2e-settings.js` | 学期、节次表、导入导出、清空 |
| `e2e-swipe.js` | 网格左右横划换周 |
| `regression.js` | 全应用几何回归（**只量课表页**；主页只截图） |
| `shot-account.js` | 给账户 UI 截图供人工过目（只在本地跑，会建测试账户） |
| `probe-blocks.js` / `probe-boxes.js` | 临时探针，量块坐标用 |

⚠️ `probe-account-ui.js` 会往被测服务端写 21 个压力账户（所以它**拒绝非 localhost 地址**），
跑完要自己清库。`regression.js` 对主页**只截图、不量几何** —— 主页上的账户卡片和弹窗靠
`probe-account-ui.js` 补上。

**只有 `e2e-account.js` 会真的读写云端**，其余脚本都用 `_shared.js` 里的 `blockSync()` 把 `/api/**` 断掉 —— 它们断言的是渲染与交互，前提是「种进去的数据原样还在」，而账户同步会在启动时用云端那份整份替换掉种子数据。断掉之后应用退回纯本地模式，行为与加账户功能之前一致。
