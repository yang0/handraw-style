import test from 'node:test';
import assert from 'node:assert/strict';
import {galleryFilePath, rewriteLegacyHtml} from '../gallery.js';

test('legacy gallery allowlist blocks traversal and privileged files',()=>{
  assert.match(galleryFilePath('skills/handdraw-style-prompter/gallery/tutorials.html').abs,/tutorials\.html$/);
  assert.match(galleryFilePath('images/layouts/social-cards/SC-001.webp').abs,/SC-001\.webp$/);
  assert.throws(()=>galleryFilePath('../../.dsh/token'),/不支持的/);
  assert.throws(()=>galleryFilePath('skills/handdraw-style-prompter/gallery/../../SKILL.md'),/不支持的/);
  assert.throws(()=>galleryFilePath('images/custom/malicious.js'),/脚本/);
  assert.throws(()=>galleryFilePath('images/individual/FA/FA-001.webp\0'),/无效的/);
});

test('original gallery links and image sources rewrite to the local DSH host',()=>{
  const html='<html><body><a href="tutorials.html?asset=CH-001">拼装器</a><img src="../../../images/individual/FA/FA-001.webp"><script src="index-thumbnails.js"></script></body></html>';
  const converted=rewriteLegacyHtml(html);
  assert.match(converted,/handraw-style\.legacy\?file=images%2Findividual\/FA\/FA-001\.webp/);
  assert.match(converted,/file=skills%2Fhanddraw-style-prompter%2Fgallery%2Ftutorials\.html&asset=CH-001/);
  assert.match(converted,/index-thumbnails\.js/);
  assert.match(converted,/handraw-style-legacy-v2/);
  const src=converted.match(/src="([^"]+FA-001\.webp)"/)?.[1];
  assert.equal(new URL(src,'http://example.test').searchParams.get('file'),'images/individual/FA/FA-001.webp');
});

test('legacy endpoint can serve a complete HTML gallery and image through its allowlist',async()=>{
  const {mkdtemp,mkdir,writeFile,rm}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');
  const {join}=await import('node:path');
  const {legacyResponse}=await import('../gallery.js');
  const root=await mkdtemp(join(tmpdir(),'handraw-legacy-'));
  try{
    const gallery=join(root,'skills/handdraw-style-prompter/gallery');
    const images=join(root,'images/colors');
    await mkdir(gallery,{recursive:true});await mkdir(images,{recursive:true});
    await writeFile(join(gallery,'index.html'),'<html><body><a href="tutorials.html">拼装</a><img src="../../../images/colors/C-01.webp"></body></html>');
    await writeFile(join(images,'C-01.webp'),Buffer.from([0x52,0x49,0x46,0x46]));
    const html=await legacyResponse('skills/handdraw-style-prompter/gallery/index.html',root);
    assert.match(html.headers.get('content-type'),/text\/html/);
    assert.match(await html.text(),/object-fit:contain!important/);
    const image=await legacyResponse('images/colors/C-01.webp',root);
    assert.equal(image.headers.get('content-type'),'image/webp');
    assert.equal((await image.arrayBuffer()).byteLength,4);
    await assert.rejects(legacyResponse('skills/handdraw-style-prompter/references/styles.json',root),/不支持的/);
  }finally{await rm(root,{recursive:true,force:true});}
});
