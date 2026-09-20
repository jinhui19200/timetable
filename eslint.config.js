import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

/**
 * ESLint 扁平配置（flat config）。
 *
 * 规则集刻意保持精简：只开「能抓到真 bug」的推荐规则，不开 stylistic 那一套。
 * 格式问题交给 Prettier，两边都管会互相打架，也会让 `npm run lint` 报一堆噪音。
 *
 * 版本约束：typescript-eslint 8.x 的 peerDependencies 是 `typescript >=4.8.4 <6.1.0`，
 * 所以 package.json 里 TypeScript 锁在 ~5.9.3，不能用最新的 7.x，否则 lint 直接起不来。
 */
export default tseslint.config(
  // `.wrangler` 是 wrangler 的本地状态目录（本地 D1 的 sqlite、`pages dev` 编译出来的
  // 临时 bundle）。不忽略的话，只要本地开发服务器开着，`npm run lint` 就会对着
  // 那些自动生成的文件报几百个错 —— 而它们根本不是我们的代码。
  { ignores: ['dist', 'node_modules', '.wrangler'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  // ⚠️ 必须走 configs.flat：插件同时导出了旧式 eslintrc 配置（configs.recommended-latest）
  // 和扁平配置（configs.flat.recommended-latest）。取错那个会报
  // 「plugins 被定义为字符串数组」，因为旧格式里 plugins 是字符串数组而不是对象。
  reactHooks.configs.flat['recommended-latest'],

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-refresh': reactRefresh,
    },
    rules: {
      // 允许文件同时导出组件和常量（比如 TabKey 类型），否则每次都要拆文件
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // 未使用变量报错，但允许下划线开头的占位参数
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // 工程配置文件跑在 Node 环境，不是浏览器
  {
    files: ['*.config.{js,ts}', 'vite.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Cloudflare Pages Functions 跑在 Workers 运行时里 —— 既不是浏览器也不是 Node。
  // 不单独声明 globals 的话，Response / URL / fetch 会被 no-undef 全报成未定义变量，
  // 而它们在这个环境里本来就是全局的。
  {
    files: ['functions/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.worker, ...globals.es2022 },
    },
  },
);
