import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';

// The plugin must live at <handraw-style>/plugins/dsh-handraw-style.
// Canonical metadata and images remain in the parent repository: no duplicated assets.
export const repositoryRoot = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const allowed = new Set(['style', 'layout', 'color', 'tone']);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

export function createCatalog(root = repositoryRoot) {
  const refs = join(root, 'skills/handdraw-style-prompter/references');
  const cache = new Map();
  const read = async name => JSON.parse(await readFile(join(refs, name), 'utf8'));
  async function load(kind) {
    if (kind === 'style') {
      const rows = await read('styles.json');
      return rows.map(row => {
        if (!/^(?:FA|FB|FC|FD|FE|FF|FG|FH|FI)-\d{3}$/.test(row.number)) throw fail('风格编号异常。', 500);
        const image = `individual/${row.number.slice(0, 2)}/${row.number}.webp`;
        return { id: row.number, group: row.number.slice(0, 2), name: row.generation_name,
          author: row.reference || '', prompt: row.traits || '', image, thumb: image };
      });
    }
    if (kind === 'tone') {
      const rows = await read('tones.json');
      return rows.map(row => {
        if (!/^T-\d{2}$/.test(row.id)) throw fail('影调编号异常。', 500);
        return { id: row.id, group: row.category_zh || '影调', name: row.name_zh,
          nameEn: row.name_en, prompt: row.desc_zh, promptEn: row.desc_en,
          image: `tones/${row.id}.webp`, thumb: `tones/${row.id}.webp` };
      });
    }
    if (kind === 'color') {
      const rows = await read('colors.json');
      return rows.map(row => {
        if (!/^C-\d{2}$/.test(row.id)) throw fail('主题色编号异常。', 500);
        const image = `colors/${row.id}.webp`;
        return { id: row.id, group: row.category_zh || '主题色', name: row.name_zh,
          nameEn: row.name_en, prompt: row.prompt_zh, promptEn: row.prompt_en, image, thumb: image };
      });
    }
    const rows = await read('layouts.json');
    return Promise.all(rows.map(async row => {
      if (!/^(?:SC|IG|SB|IP|EC)-\d{3}$/.test(row.id)) throw fail('图型编号异常。', 500);
      const image = String(row.image || '').split('/images/')[1];
      if (!image || !/^layouts\/[\w-]+\/[\w-]+\.webp$/.test(image)) throw fail('图型图片路径异常。', 500);
      const raw = await readFile(join(refs, 'layouts', row.id + '.md'), 'utf8');
      const parts = raw.split('<!-- en -->');
      const prompt = parts[0].replace('<!-- zh -->', '').trim();
      if (!prompt) throw fail('图型提示词为空：' + row.id, 500);
      return { id: row.id, group: row.id.slice(0, 2), name: row.name,
        nameEn: row.name_en, prompt, promptEn: (parts[1] || '').trim(), image, thumb: image };
    }));
  }
  return async function catalog(kind) {
    if (!allowed.has(kind)) throw fail('未知素材类别。');
    if (!cache.has(kind)) cache.set(kind, load(kind).catch(error => { cache.delete(kind); throw error; }));
    return cache.get(kind);
  };
}

export function resolveImage(root, item) {
  if (!item || !/^(?:individual\/(?:FA|FB|FC|FD|FE|FF|FG|FH|FI)\/|colors\/|tones\/|layouts\/[\w-]+\/)[\w-]+\.webp$/.test(item.image))
    throw fail('不支持的图片路径。');
  return join(root, 'images', item.image);
}
