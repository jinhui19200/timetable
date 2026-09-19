import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { bootstrapStorage } from './store/persistence';
import './styles/tokens.css';
import './styles/global.css';

// 必须在渲染之前：这一步会定下当前账户名、把旧版数据迁进默认账户。
// 放进组件里做会有两个问题 —— StrictMode 下会跑两遍，而且会晚于第一次读取数据。
bootstrapStorage();

const container = document.getElementById('root');
if (!container) throw new Error('找不到 #root 挂载点');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
