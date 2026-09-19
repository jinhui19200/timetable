import { useState } from 'react';
import type { SyncPhase } from '../../store/context';
import { useStore } from '../../store/useStore';
import { AccountSwitchDialog } from './AccountSwitchDialog';

/**
 * 同步状态 → 给用户看的一句话。
 *
 * 文案刻意区分「正在读云端」和「正在写云端」：前者是打开应用时的一次性动作，
 * 后者意味着刚做的改动还没落袋，用户对这两件事的耐心完全不同。
 */
function syncLabel(phase: SyncPhase, error: string | null): string {
  switch (phase) {
    case 'pulling':
      return '正在读取云端数据…';
    case 'saving':
      return '保存中…';
    case 'offline':
      return error ? `未同步（${error}）` : '未同步';
    case 'ready':
      return '已同步到云端';
  }
}

/**
 * 主页顶部的账户区块：显示当前账户名、同步状态，以及切换账户的入口。
 *
 * 放在主页而不是单独开一个标签页：账户是「偶尔切一次」的东西，
 * 占一个底部标签位不值得 —— 底部标签应该留给每天都在用的功能。
 * 放在主页顶部还有一个好处：切完账户马上就能看到「今日安排」变了没有，
 * 切错了一眼就知道。
 */
export function AccountCard() {
  const { account } = useStore();
  const [dialogOpen, setDialogOpen] = useState(false);

  const offline = account.phase === 'offline';

  return (
    <>
      <section className={`account-card${offline ? ' account-card--offline' : ''}`}>
        {/* 用账户名首字当头像：不做上传头像，一个字母圈足够区分两三个账户 */}
        <span className="account-card__avatar" aria-hidden="true">
          {account.name.slice(0, 1)}
        </span>

        <span className="account-card__body">
          <span className="account-card__name">{account.name}</span>
          <span className="account-card__status" role="status">
            {syncLabel(account.phase, account.error)}
          </span>
        </span>

        <button
          type="button"
          className="text-button account-card__switch"
          onClick={() => setDialogOpen(true)}
        >
          切换
        </button>
      </section>

      {/*
        只在打开时挂载，而不是传 open 让弹窗自己返回 null。
        两个好处：输入框里的半截名字随关闭自然消失，不需要用 effect 去 setDraft('')；
        弹窗里的「拉账户列表」也只在真正打开时才发请求。
      */}
      {dialogOpen ? <AccountSwitchDialog onClose={() => setDialogOpen(false)} /> : null}
    </>
  );
}
