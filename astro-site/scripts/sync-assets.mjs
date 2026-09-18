/**
 * 把仓库根目录的“唯一数据源”同步进 astro-site：
 *   - handdraw-style-prompter/references/styles.json  → src/data/styles.json
 *   - images/                                         → public/images/
 *
 * 这些产物在 .gitignore 中，不会重复存储进仓库；构建/开发前执行，
 * 保证站点始终复用根目录的最新数据和图片。
 */
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ASTRO = dirname(dirname(fileURLToPath(import.meta.url)));

const STYLES_SRC = resolve(ASTRO, '..', 'handdraw-style-prompter', 'references', 'styles.json');
const STYLES_DST = resolve(ASTRO, 'src', 'data', 'styles.json');
const IMAGES_SRC = resolve(ASTRO, '..', 'images');
const IMAGES_DST = resolve(ASTRO, 'public', 'images');

mkdirSync(dirname(STYLES_DST), { recursive: true });
cpSync(STYLES_SRC, STYLES_DST, { force: true });
console.log('synced', STYLES_DST);

mkdirSync(IMAGES_DST, { recursive: true });
cpSync(IMAGES_SRC, IMAGES_DST, { recursive: true, force: true });
console.log('synced', IMAGES_DST);