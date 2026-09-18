// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 站点部署在 GitHub Pages 的项目子路径下：
// https://why-qw1ko.github.io/handraw-style/
export default defineConfig({
  site: 'https://why-qw1ko.github.io/handraw-style/',
  base: '/handraw-style/',
  output: 'static',
  integrations: [sitemap()],
  build: {
    assets: '_assets',
  },
});