import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useStore } from '../../store/useStore';
import { CloseIcon } from '../common/Icon';

/** 账户名长度上限，和服务端 functions/api/account.js 里的 MAX_USERNAME_LENGTH 保持一致。 */
const MAX_NAME_LENGTH = 24;

/** 相对时间。列表里「3 天前」比完整日期更容易扫读。 */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;

  return iso.slice(0, 10);
}

/**
 * 切换账户弹窗。
 *
 * 由 AccountCard 在打开时才挂载，所以没有 open prop —— 组件挂载即「打开」。
 * 这样输入框里的半截名字会在关闭时随组件一起消失，不需要额外写一个
 * 「关闭时清空草稿」的 effect（那正是 React 明确劝阻的用法）。
 *
 * 两个动作放在同一个弹窗里，因为用户的心智是同一个 ——「我要去另一个账户」，
 * 至于那个账户已经存在还是需要现建，对他来说只是输入框里打了个新名字而已。
 * 拆成「切换」和「新建」两个入口反而要先想一下「我这个算哪种」。
 *
 * 没有密码：用户明确选了只做账户名。所以这里不做任何鉴权 UI ——
 * 输入一个别人用过的名字，就直接进他的账户。这是刻意的取舍，见 README。
 */
export function AccountSwitchDialog({ onClose }: { onClose: () => void }) {
  const { account } = useStore();
  /**
   * 单独解构出来，依赖它而不是依赖整个 account。
   *
   * refreshList 是稳定引用（内部 useCallback 空依赖），所以下面的 effect 只会跑一次；
   * 若直接依赖 account 对象，那个对象在每次数据变化时都会重建（useMemo 的依赖里有 state），
   * 于是用户每改一条课，弹窗都会重拉一次账户列表。
   */
  const { refreshList } = account;
  const [draft, setDraft] = useState('');

  // 拉一次云端账户列表：用户很可能刚在另一台设备上建了账户。
  useEffect(() => {
    refreshList();
  }, [refreshList]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const trimmed = draft.trim();
  const tooLong = trimmed.length > MAX_NAME_LENGTH;
  const hasSlash = /[/\\]/.test(trimmed);
  const duplicate = account.list.some((item) => item.username === trimmed);
  const isCurrent = trimmed.length > 0 && trimmed === account.name;
  const canSubmit = trimmed.length > 0 && !tooLong && !hasSlash && !isCurrent;

  /** 当前账户可能还没上传过（新建后一直没加课），列表里补一行，别让用户以为它不见了。 */
  const rows = account.list.some((item) => item.username === account.name)
    ? account.list
    : [{ username: account.name, revision: 0, updatedAt: '' }, ...account.list];

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    // 重名就走切换。createAccount 内部也会再拦一道，这里提前分流是为了
    // 不必依赖那边的兜底 —— 万一以后有人改了那个 hook，这里仍然是安全的。
    if (duplicate) account.switchAccount(trimmed);
    else account.createAccount(trimmed);
    onClose();
  };

  const hint = (() => {
    if (tooLong) return { text: `账户名最多 ${MAX_NAME_LENGTH} 个字`, warn: true };
    if (hasSlash) return { text: '账户名里不能有斜杠', warn: true };
    if (isCurrent) return { text: '这就是当前账户', warn: false };
    if (duplicate) return { text: '已有同名账户，确定后会切到它', warn: true };
    return { text: '只输一个名字就能建，不用密码', warn: false };
  })();

  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <div
        className="dialog dialog--account"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="切换账户"
      >
        <div className="account-dialog__head">
          <span className="account-dialog__title">切换账户</span>
          <button
            type="button"
            className="account-dialog__close"
            onClick={onClose}
            aria-label="关闭"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <p className="account-dialog__label">选择账户</p>

        {account.listLoading && account.list.length === 0 ? (
          <p className="account-dialog__hint">正在读取云端账户…</p>
        ) : (
          <ul className="account-list">
            {rows.map((item) => {
              const current = item.username === account.name;
              return (
                <li key={item.username}>
                  <button
                    type="button"
                    className={`account-list__item${current ? ' account-list__item--current' : ''}`}
                    disabled={current}
                    onClick={() => {
                      account.switchAccount(item.username);
                      onClose();
                    }}
                  >
                    <span className="account-list__avatar" aria-hidden="true">
                      {item.username.slice(0, 1)}
                    </span>
                    <span className="account-list__name">{item.username}</span>
                    <span className="account-list__meta">
                      {current ? '当前' : relativeTime(item.updatedAt)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="account-dialog__label">新建账户</p>

        <form className="account-dialog__form" onSubmit={handleSubmit}>
          <input
            className="form-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="输入账户名"
            aria-label="账户名"
            autoComplete="off"
            enterKeyHint="done"
          />
          <p className={`account-dialog__hint${hint.warn ? ' account-dialog__hint--warn' : ''}`}>
            {hint.text}
          </p>
          <div className="dialog__actions">
            <button
              type="submit"
              className="dialog__button dialog__button--primary"
              disabled={!canSubmit}
            >
              {duplicate ? '切换到此账户' : '新建并切换'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
