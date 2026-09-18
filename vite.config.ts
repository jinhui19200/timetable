import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite 配置。
 *
 * server.host 设为 '0.0.0.0'：允许手机通过局域网 IP 访问开发服务器，
 * 便于在真机（手机竖屏）上验证手势与布局。若只想本机访问，改成 '127.0.0.1'。
 */
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
