import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createCatalog, repositoryRoot, resolveImage } from './catalog.js';
import { shouldAttachStyleReference } from './prompt.js';
import { hostModel, resolvePrompt } from './assist.js';

export const inject = ['connection'];
const catalog = createCatalog();
const defaults = { model: 'gpt-image-2', baseUrl: 'https://api.openai.com/v1/', size: '1024x1536', quality: 'medium' };
const configDir = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'handraw-style');
const configPath = join(configDir, 'image-api.json');
const fail = (status, message) => Object.assign(new Error(message), { status });
const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });

function gateway(baseUrl) {
  let url;
  try { url = new URL(String(baseUrl || defaults.baseUrl).replace(/\/*$/, '/')); }
  catch { throw fail(400, '请输入完整的接口 Base URL。'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
      url.username || url.password || url.search || url.hash ||
      /\/(?:images\/(?:edits|generations)|chat\/completions)\/$/.test(url.pathname)) {
    throw fail(400, '远程接口需要 HTTPS，本机可使用 HTTP；请输入 /v1 等 API 根地址。');
  }
  return url;
}

async function loadConfig() {
  let saved = {};
  try { saved = JSON.parse(await readFile(configPath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  return { ...defaults, ...saved, key: saved.key || process.env.OPENAI_API_KEY || '' };
}

async function saveConfig(body) {
  const old = await loadConfig();
  const model = String(body.model || old.model).trim();
  if (!/^[a-zA-Z0-9._-]{1,80}$/.test(model)) throw fail(400, '模型 ID 不合法。');
  const baseUrl = gateway(body.baseUrl === undefined ? old.baseUrl : body.baseUrl).href;
  const newKey = typeof body.key === 'string' ? body.key.trim() : '';
  if (newKey && (!/^[\x21-\x7e]{8,512}$/.test(newKey))) throw fail(400, 'API Key 格式无效。');
  const oldOrigin = gateway(old.baseUrl).origin;
  if (new URL(baseUrl).origin !== oldOrigin && !newKey && old.key) throw fail(400, '更换接口域名时请一并输入新 API Key。');
  const key = body.clearKey ? '' : newKey || old.key;
  await mkdir(configDir, { recursive: true, mode: 0o700 });
  const temporary = join(configDir, `${randomUUID()}.tmp`);
  await writeFile(temporary, JSON.stringify({ model, baseUrl, key }), { mode: 0o600, flag: 'wx' });
  await rename(temporary, configPath);
  return { model, baseUrl, configured: Boolean(key) };
}

async function readJson(request, maxBytes = 15 * 1024 * 1024) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw fail(415, '请求须为 JSON。');
  if (Number(request.headers.get('content-length') || 0) > maxBytes) throw fail(413, '请求体过大。');
  const chunks = [];
  let total = 0;
  if (!request.body) throw fail(400, '请求体为空。');
  for await (const chunk of request.body) {
    total += chunk.length;
    if (total > maxBytes) throw fail(413, '请求体过大。');
    chunks.push(chunk);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch { throw fail(400, '无效 JSON。'); }
}

function decodeImage(data) {
  if (!data) return null;
  const matched = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(data);
  if (!matched || matched[2].length > 11_200_000) throw fail(400, '上传图片须为 8 MB 内的 PNG、JPG 或 WebP。');
  const bytes = Buffer.from(matched[2], 'base64');
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw fail(400, '上传图片大小无效。');
  return new Blob([bytes], { type: matched[1] });
}

async function generate(body, host, signal) {
  const config = await loadConfig();
  if (!config.key) throw fail(400, '先在接口设置中填写 API Key。');
  const design = body.design;
  if (!design || typeof design !== 'object') throw fail(400, '缺少创作参数。');
  if (typeof design.theme !== 'string' || !design.theme.trim()) throw fail(400, '直接生图需要填写画面主题。');
  const compiled = await resolvePrompt({ ...design, referenceUpload: Boolean(body.upload) }, body.aiAssist === true, catalog, host, signal);
  const size = ['1024x1024', '1024x1536', '1536x1024'].includes(body.size) ? body.size : defaults.size;
  const quality = ['low', 'medium', 'high'].includes(body.quality) ? body.quality : defaults.quality;
  const images = [];
  const uploaded = decodeImage(body.upload);
  if (uploaded) images.push({ blob: uploaded, role: '用户上传的主体图：保留其独特身份、结构和外形，按指定画风重新绘制。' });
  for (const [styleKey, styleId] of [['style',compiled.design.style],['style2',compiled.design.fusion===true?compiled.design.style2:'']]) {
    if (!styleId || !await shouldAttachStyleReference(styleId, config.model, catalog, body.styleReference || 'auto')) continue;
    const style = (await catalog('style')).find(row => row.id === styleId);
    if (!style) throw fail(400, '所选画风不可用。');
    const bytes = await readFile(resolveImage(repositoryRoot, style));
    images.push({ blob: new Blob([bytes], { type: 'image/webp' }), role: styleKey === 'style'
      ? (compiled.design.fusion===true
        ? '角色/主体画风参考图：只参考角色的线条、笔触、造型和媒介，不得照抄示例中的人物、服装、动作、场景或文字；不能控制背景场景画风。'
        : '单一画风参考图：只参考笔触、线条、造型媒介和色彩语言，作用于整张画面；不得照抄示例人物、服装、场景或文字。')
      : '场景/环境画风参考图：只参考背景的笔触、材质、空间与色彩语言，不得照搬示例中的主体、服装、构图、场景或文字；不能替换角色造型。' });
  }
  const prompt = [compiled.prompt, ...images.map((image, i) => `参考图 ${i + 1}：${image.role}`)].join('\n\n');
  const endpoint = new URL(images.length ? 'images/edits' : 'images/generations', gateway(config.baseUrl));
  const headers = { Authorization: `Bearer ${config.key}` };
  let payload;
  if (images.length) {
    payload = new FormData();
    for (const [key, value] of Object.entries({ model: config.model, size, quality, prompt })) payload.append(key, value);
    images.forEach(({ blob }, i) => payload.append('image[]', blob, `reference-${i + 1}.${blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg'}`));
  } else {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify({ model: config.model, size, quality, prompt });
  }
  const result = await fetch(endpoint, {
    method: 'POST', headers, body: payload, redirect: 'error',
    signal: AbortSignal.any([signal, AbortSignal.timeout(300000)]),
  });
  if (!result.ok) {
    const raw = await result.text().catch(() => '');
    let message = '';
    try { const error = JSON.parse(raw); message = error?.error?.message || error?.message || ''; }
    catch { message = raw.startsWith('<') ? '' : raw; }
    throw fail(502, `生图接口返回 HTTP ${result.status}${message ? '：' + String(message).slice(0, 250) : ''}`);
  }
  const bodyJson = await result.json();
  const encoded = bodyJson?.data?.[0]?.b64_json;
  if (typeof encoded !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(encoded) || encoded.length > 32_000_000)
    throw fail(502, '生图接口未返回有效的 b64_json 图片。');
  // Save to an actual host-side absolute path; never pretend to know the browser download path.
  const dir = resolve(configDir, 'generated');
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const savedPath = resolve(dir, `handraw-${randomUUID()}.png`);
  await writeFile(savedPath, Buffer.from(encoded,'base64'), { mode:0o600, flag:'wx' });
  return { image:'data:image/png;base64,' + encoded, savedPath, prompt:compiled.prompt, design:compiled.design, aiAssisted:compiled.aiAssisted, mode:compiled.mode };
}

export function apply(ctx) {
  const lifetime = new AbortController();
  ctx.effect(() => () => lifetime.abort());
  let busy = false;
  function route(name, methods, fn) {
    ctx.effect(() => ctx.connection.fetch.register({
      path: '/api/handraw-style.' + name, methods,
      requestBody: name === 'generate' ? 'streaming' : 'buffered',
      async fetch(request) {
        try {
          const signal = AbortSignal.any([request.signal, lifetime.signal]);
          return await fn(request, new URL(request.url).searchParams, signal);
        } catch (error) {
          const message = error.status ? error.message : error.name === 'TimeoutError'
            ? '请求超时。' : '请求失败，请检查 DSH Host 或接口配置。';
          return json({ error: message }, error.status || 502);
        }
      },
    }));
  }
  route('catalog', ['GET'], async (_, query) => {
    const rows = await catalog(query.get('kind'));
    return json(rows.map(({ image, promptEn, ...row }) => ({ ...row, hasImage: Boolean(image) })));
  });
  route('thumb', ['GET'], async (_, query) => {
    const kind = query.get('kind');
    const item = (await catalog(kind)).find(row => row.id === query.get('id'));
    if (!item) throw fail(404, '素材不存在。');
    const buffer = await readFile(resolveImage(repositoryRoot, item));
    return new Response(buffer, { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'private, max-age=86400' } });
  });
  route('prompt', ['POST'], async (request, _, signal) => {
    const body = await readJson(request, 32 * 1024);
    return json(await resolvePrompt(body.design || body, body.aiAssist === true, catalog, hostModel(ctx), signal));
  });
  route('settings', ['GET', 'POST'], async request => {
    if (request.method === 'POST') return json(await saveConfig(await readJson(request, 4096)));
    const settings = await loadConfig();
    return json({ model: settings.model, baseUrl: gateway(settings.baseUrl).href, configured: Boolean(settings.key) });
  });
  route('generate', ['POST'], async (request, _, signal) => {
    if (busy) throw fail(409, '已有图片正在生成，请等当前任务完成。');
    busy = true;
    try { return json(await generate(await readJson(request), hostModel(ctx), signal)); }
    finally { busy = false; }
  });
}
