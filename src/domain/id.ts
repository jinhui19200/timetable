/**
 * 记录 id 生成。
 *
 * ⚠️ 这里刻意不用 crypto.randomUUID()：它只在「安全上下文」可用，
 * 也就是 https 或 localhost。而本项目的开发服务器按计划监听 0.0.0.0，
 * 手机是通过 http://192.168.x.x:5173 访问的 —— 那是非安全上下文，
 * crypto.randomUUID 会直接是 undefined，新建课程时就会报错。
 * 所以优先用 randomUUID，拿不到就回退到时间戳 + 随机串。
 */

/** 生成一个带前缀的唯一 id。 */
export function createId(prefix = 'entry'): string {
  const webCrypto = globalThis.crypto;
  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return `${prefix}-${webCrypto.randomUUID()}`;
  }
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}
