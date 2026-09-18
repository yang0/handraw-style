/**
 * 全局复制：事件委托处理所有 [data-copy] 按钮。
 * 在 Base layout 中导入一次即可全站生效。
 */
async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through */
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

window.addEventListener('click', async (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-copy]');
  if (!btn) return;
  const text = btn.getAttribute('data-copy') || '';
  const original = btn.textContent || '';
  const ok = await copyText(text);
  btn.textContent = ok ? '已复制 ✓' : '复制失败';
  if (btn.getAttribute('data-copy') !== null && btn.getAttribute('data-copy') !== '') {
    setTimeout(() => {
      if (btn.hasAttribute('data-copy')) btn.textContent = original;
    }, 1400);
  }
});