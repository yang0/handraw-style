import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, relative, extname, sep } from 'node:path';
import { repositoryRoot } from './catalog.js';

const galleryDir = 'skills/handdraw-style-prompter/gallery/';
const prefix = '/api/handraw-style.legacy?file=';
const pageNames = new Set(['index.html', 'layouts.html', 'colors.html', 'assets.html', 'tutorials.html']);
const otherNames = new Set(['index-thumbnails.js', 'layouts-thumbnails.js', 'local-navigation.js', 'personal-library.js']);
const imageTypes = {'.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.gif':'image/gif'};
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const localUrl = path => prefix + encodeURIComponent(path);

export function galleryFilePath(value, root = repositoryRoot) {
  if (typeof value !== 'string' || value.length > 260 || value.includes('\\') || value.includes('\0')) throw fail('无效的画廊路径。');
  const file = value || galleryDir + 'index.html';
  // Explicit allowlists instead of serving arbitrary files from the repository.
  if (file.startsWith(galleryDir)) {
    const name = file.slice(galleryDir.length);
    if (!pageNames.has(name) && !otherNames.has(name)) throw fail('不支持的画廊文件。', 404);
  } else if (file.startsWith('images/')) {
    if (!/^images\/(?:individual|layouts|colors|characters|tones|custom|tutorials)\/(?:[\w-]+\/)*[\w-]+\.(?:webp|png|jpe?g|svg|gif|js)$/i.test(file)) throw fail('不支持的素材文件。', 404);
    // The personal library is optional, but no arbitrary JS in the images tree.
    if (file.endsWith('.js') && file !== 'images/custom/custom_assets.js') throw fail('不支持的脚本。', 404);
  } else throw fail('不支持的文件类型。', 404);
  const abs = resolve(root, file);
  if (relative(root, abs).startsWith('..'+sep)) throw fail('非法路径。');
  return { file, abs };
}

const BRIDGE = `<script>
(function () {
  document.addEventListener('click', function (event) {
    var link = event.target && event.target.closest && event.target.closest('a[href]');
    var href = link && link.getAttribute('href') || '';
    var target = /^(index|layouts|colors|assets|tutorials)\.html(?:\?(.*))?$/.exec(href);
    if (target) {
      event.preventDefault();
      location.assign('/api/handraw-style.legacy?file=' + encodeURIComponent('skills/handdraw-style-prompter/gallery/' + target[1] + '.html') + (target[2] ? '&' + target[2] : ''));
      return;
    }
    var card = event.target && event.target.closest && event.target.closest('[data-number], [data-id]');
    if (!card) return;
    var id = card.getAttribute('data-number') || card.getAttribute('data-id') || '';
    var kind = /^F[A-I]-\\d{3}$/.test(id) ? 'style' : /^(?:SC|IG|SB|IP|EC)-\\d{3}$/.test(id) ? 'layout' : /^C-\\d{2}$/.test(id) ? 'color' : '';
    if (kind && window.parent !== window) window.parent.postMessage({ source:'handraw-style-legacy-v2', kind:kind, id:id }, location.origin);
  }, true);
})();
</script>`;

export function rewriteLegacyHtml(html) {
  // Resolve the original ../../../images/* paths without copying or rewriting the upstream gallery on disk.
  let output = html.replaceAll('../../../images/', localUrl('images/'));
  // The query value is intentionally a path prefix for image URLs; the server decodes the full value.
  output = output.replace(/(href|src)=(['"])(?:\.\/)?(index|layouts|colors|assets|tutorials)\.html(\?[^'"]*)?\2/g,
    (_, attr, quote, name, query='') => `${attr}=${quote}${localUrl(galleryDir + name + '.html')}${query ? '&' + query.slice(1) : ''}${quote}`);
  output = output.replace(/(href|src)=(['"])(?:\.\/)?(index-thumbnails|layouts-thumbnails|local-navigation|personal-library)\.js\2/g,
    (_, attr, quote, name) => `${attr}=${quote}${localUrl(galleryDir + name + '.js')}${quote}`);
  // A gallery image URL embedded in a string is transformed too; e.g. the tutorial assembler's catalogs.
  output = output.replace(/<\/body>/i, `<style>.style-card img,.layout-card img,.color-card img,.picker-card img{object-fit:contain!important;object-position:center!important}</style>${BRIDGE}</body>`);
  return output;
}

export async function legacyResponse(file, root = repositoryRoot) {
  const target = galleryFilePath(file, root);
  const realRoot = await realpath(root);
  let real;
  try { real = await realpath(target.abs); }
  catch (error) { if (error.code === 'ENOENT') throw fail('画廊资源未找到。', 404); throw error; }
  if (real !== realRoot && !real.startsWith(realRoot + sep)) throw fail('资源不属于本仓库。', 403);
  const info = await stat(real);
  if (!info.isFile() || info.size > 12 * 1024 * 1024) throw fail('画廊资源超出支持范围。', 413);
  const ext = extname(target.file).toLowerCase();
  if (ext === '.html') {
    const html = rewriteLegacyHtml(await readFile(real, 'utf8'));
    return new Response(html, { headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'} });
  }
  const mime = ext === '.js' ? 'text/javascript; charset=utf-8' : imageTypes[ext];
  if (!mime) throw fail('不支持的画廊资源。', 404);
  return new Response(await readFile(real), {headers:{'Content-Type':mime,'Cache-Control':'private, max-age=86400','X-Content-Type-Options':'nosniff'}});
}
