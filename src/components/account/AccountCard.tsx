import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
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
 *
 * **双击账户名可以就地改名**（回车确认、Esc 取消）。改名会同步到云端：
 * 先把数据写到新名字下、成功后再删掉旧名字，所以改名后别的设备用新名字就能读到。
 */
export function AccountCard() {
  const { account } = useStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  /** 非 null 表示正在改名，值是编辑中的草稿 */
  const [draft, setDraft] = useState<string | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  /**
   * 这一次 blur 是「按 Esc 取消」触发的，不要提交。
   *
   * 需要一个标记是因为：Enter 和 Esc 都靠 `blur()` 收尾（避免 Enter 和 blur
   * 各提交一次），而 blur 处理器分不清这次模糊是确认还是取消。
   */
  const skipCommit = useRef(false);

  const offline = account.phase === 'offline';

  const startRename = () => {
    setRenameError(null);
    setDraft(account.name);
  };

  const cancelRename = () => {
    skipCommit.current = false;
    setDraft(null);
    setRenameError(null);
  };

  const commitRename = async () => {
    if (draft === null || renaming) return;
    const next = draft.trim();
    // 没改动或改成空 → 当作取消，不要为一次误触发起请求
    if (!next || next === account.name) {
      cancelRename();
      return;
    }

    setRenaming(true);
    try {
      await account.renameAccount(next);
      setDraft(null);
      setRenameError(null);
    } catch (cause) {
      // 失败时**保持编辑态**并把原因显示出来 —— 直接退回只读态的话，
      // 用户看到名字没变却不知道为什么（最常见的原因是撞名）。
      setRenameError(cause instanceof Error ? cause.message : '改名失败');
    } finally {
      setRenaming(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      // 交给 blur 统一提交，避免 Enter 和随后的 blur 各提交一次
      event.currentTarget.blur();
      return;
    }
    if (event.key === 'Escape') {
      skipCommit.current = true;
      event.currentTarget.blur();
    }
  };

  const handleBlur = () => {
    if (skipCommit.current) {
      cancelRename();
      return;
    }
    void commitRename();
  };

  return (
    <>
      <section className={`account-card${offline ? ' account-card--offline' : ''}`}>
        {/* 用账户名首字当头像：不做上传头像，一个字母圈足够区分两三个账户 */}
        <span className="account-card__avatar" aria-hidden="true">
          {account.name.slice(0, 1)}
        </span>

        <span className="account-card__body">
          {draft === null ? (
            <span
              className="account-card__name"
              // 双击改名。移动端浏览器会把双击手势映射成 dblclick，
              // 所以手机上双击也能进编辑态。
              onDoubleClick={startRename}
              title="双击改名"
            >
              {account.name}
            </span>
          ) : (
            <input
              className="form-input account-card__name-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              aria-label="账户名"
              autoComplete="off"
              enterKeyHint="done"
              // 用户是双击主动进编辑态的，这里聚焦正是他要的，不是「自动抢焦点」
              autoFocus
              disabled={renaming}
            />
          )}

          <span
            className={`account-card__status${renameError ? ' account-card__status--warn' : ''}`}
            role="status"
          >
            {renameError ?? (renaming ? '正在改名…' : syncLabel(account.phase, account.error))}
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
