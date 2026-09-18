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

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器（含热更新） |
| `npm run build` | 生产构建，产物在 `dist/` |
| `npm run preview` | 本地预览构建产物 |
| `npm run lint` | ESLint 检查，提交前应当零报错 |
| `npm run format` | Prettier 格式化 |

## 功能

- **课表网格**：横向周一~周日，纵向节次。上午 / 下午 / 晚上之间有视觉空档。
- **周次切换**：顶部左右箭头翻周，每列显示对应日期。到头时按钮禁用而不是循环。
- **单双周与不连续周次**：周次存的是「规则」（起止周 + 单/双），不是展开后的周次数组。这样编辑时能原样还原成控件，不会把「第 1-8 周 + 第 11-16 周」这种规则悄悄改掉。
- **两种时间表达**：
  - 课程固定按**节次**（第 3~4 节），不显示具体钟点。
  - 事件可以按节次，也可以按**真实钟点**（如 19:00~20:30），按真实时间比例落在网格上。
- **修改功能**（本项目的重点）：点任意课程/事件 → 底部抽屉显示详情 → 点「编辑」改任意字段。也可以点空白格子直接新建，会自动预填那一格的星期与节次。
- **冲突提醒**：保存时若与已有安排重叠，会提示是哪几条，但**不阻止保存**。单双周错开的情况不算冲突。
- **配色**：按名称自动分配（同名课程永远同色），也可手动指定；手动选过之后就不再被名称覆盖。
- **自动保存**：改动自动写入浏览器 localStorage，不需要点保存。

## 目录结构

```
app/
├─ src/
│  ├─ types/entry.ts        全部类型定义（改动前先读文件头的三条设计约定）
│  ├─ domain/               纯逻辑，不依赖 React
│  │  ├─ periods.ts         默认节次表、学期默认值
│  │  ├─ date.ts            日期工具（用 UTC 归一化绕开夏令时）
│  │  ├─ weeks.ts           周次规则：展开、包含判断、合并、重叠检测
│  │  ├─ colors.ts          莫兰迪色板、按名称哈希取色
│  │  ├─ layout.ts          网格布局：像素定位、分道、冲突检测
│  │  ├─ timeAxis.ts        真实时间 ↔ 像素的分段线性映射
│  │  └─ entryView.ts       时间的显示文本
│  ├─ store/                状态与持久化
│  │  ├─ context.ts         context 对象与类型
│  │  ├─ StoreProvider.tsx  状态提供者
│  │  ├─ useStore.ts        读取状态的 hook
│  │  ├─ reducer.ts         全部数据修改都在这里
│  │  ├─ persistence.ts     **唯一**的数据读写出口
│  │  └─ seed.ts            首次打开时的示例数据
│  ├─ hooks/                自定义 hook
│  ├─ components/           组件（common / layout / timetable / entry）
│  ├─ pages/                页面（课表页、主页）
│  └─ styles/               CSS 变量与全局样式
```

## 数据存在哪

浏览器 localStorage，两个 key：

- `timetable-app:data` —— 主数据
- `timetable-app:data:backup` —— 上一次可用版本（每次保存前自动挪一份）

读取顺序是「主数据 → 备份 → 示例数据」，任何一步坏了都往后退一层，不会白屏。

**所有读写必须经过 `src/store/persistence.ts`**，组件和 reducer 里不允许直接出现 `localStorage`。这样将来把存储换成云端 API（计划是 Cloudflare Workers + D1）时，只需要改这一个文件。

## 几个不能踩的坑

- **节次存的是数组下标，不是节号。** 默认节次表里「第 15 节」排在「第 11 节」之前（教务系统自己配的顺序），任何按节号数值排序的做法都会把它放错位置。节号只用于显示。
- **不要给事件加 `teacher` / `credit` 字段。** 课程和事件是 discriminated union，靠 `kind` 字段区分，编译器会强制你先判断 `kind` 才能取这些字段。
- **TypeScript 锁在 `~5.9.3`。** `typescript-eslint@8` 的 peerDependencies 是 `typescript >=4.8.4 <6.1.0`，装最新的 7.x 会让 lint 直接起不来。
- **时间一律存 `'HH:mm'` 字符串**，不存 Date 对象，避免时区与夏令时偏移。

## 开发约定

- 提交前 `npm run lint` 和 `npm run build` 都要通过。
- 注释用中文，命名用英文。重点模块（`weeks.ts` / `layout.ts` / `timeAxis.ts`）的注释解释「为什么这么做」，而不只是「做了什么」。
- 新建/编辑表单一律走 `components/entry/EntryFormSheet.tsx` —— 它是全应用唯一的写入口。将来接截图识别或文件导入，那些来源也必须汇到这里。

## 部署

计划部署到 Cloudflare Pages。构建配置：

- 构建命令：`npm run build`
- 输出目录：`dist`
- 环境变量：`NODE_VERSION` **必须显式设置**（如 `22`）。Cloudflare 的默认 Node 版本变更过几次，不设置会遇到 "Node version not supported"。
