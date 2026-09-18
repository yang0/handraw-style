/**
 * 全局收藏：基于 localStorage 与事件委托，处理所有 [data-fav] 星标按钮。
 * 在 Base layout 中导入一次即可全站生效。
 */
const KEY = 'handraw:favorites';

export function readFavorites(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function writeFavorites(list: string[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
}

function syncButton(btn: HTMLElement, on: boolean): void {
  btn.classList.toggle('on', on);
  btn.setAttribute('aria-pressed', String(on));
  // 切换图标
  if (btn.textContent) {
    btn.textContent = on ? '★' : '☆';
  }
}

export function toggleFavorite(number: string): void {
  const set = new Set(readFavorites());
  set.has(number) ? set.delete(number) : set.add(number);
  writeFavorites([...set].sort());
  window.dispatchEvent(new CustomEvent('handraw:fav', { detail: number }));
}

// 初始化：挂载全局委托监听
window.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-fav]');
  if (!btn) return;
  const card = btn.closest<HTMLElement>('[data-number]');
  if (!card) return;
  const num = card.getAttribute('data-number') || '';
  toggleFavorite(num);
});

// 文档加载完成后同步所有星标（含路由懒加载）
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll<HTMLElement>('[data-fav]').forEach((b) => {
    const card = b.closest<HTMLElement>('[data-number]');
    const num = card ? card.getAttribute('data-number') : '';
    syncButton(b, num ? readFavorites().includes(num) : false);
  });
});