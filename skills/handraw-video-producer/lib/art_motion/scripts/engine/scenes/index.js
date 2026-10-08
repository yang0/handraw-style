// 按 id 加载 scenes/<id>.js；按 transition.type 自动加载 transitions/<type>.js（同步 XHR，保证 engine 启动前全部注册）。
// 任何一个场景缺文件、语法错、没注册，或转场名在 TRANSITIONS 和 transitions/ 里都找不到 → 记进 window.__bootErrors，
// 引擎拒绝启动，render.py/qa.py 直接报错退出。
// （迁移测试 B 踩过：以前缺场景会画「待实现」占位照常渲，整段 1.2 秒灰底，靠帧差 0.0% 才发现；转场名写错会静默退成交叉淡化。）
(() => {
  window.SCENES = window.SCENES || {}; window.__bootErrors = [];
  const load = (url) => { const x = new XMLHttpRequest(); x.open('GET', url, false); try { x.send(); } catch (err) { return { err: `请求失败 ${err}` }; }
    if (x.status !== 200) return { err: `${url} 不存在 (HTTP ${x.status})` };
    try { (0, eval)(x.responseText + `\n//# sourceURL=${url}`); } catch (err) { return { err: `${url} 执行出错 ${err && err.stack || err}` }; } return {}; };
  // 片子可以先加载自己的共用脚本（window.SCENE_LIBS，按顺序），场景文件目录 window.SCENE_DIR（默认 scenes）。
  // 共用脚本里已经注册了 SCENES[id] 的段落，不再找单独的场景文件（demos/ 的示范片就是这么组织的）。
  for (const f of window.SCENE_LIBS || []) { const r = load(f); if (r.err) __bootErrors.push(`共用脚本 ${r.err}`); }
  const dir = window.SCENE_DIR || 'scenes';
  for (const e of ERAS) {
    if (!e.draw) {                                          // eras 里内联了 draw 的段落不需要文件
      const r = SCENES[e.id] ? {} : load(`${dir}/${e.id}.js`);
      if (r.err) { __bootErrors.push(`${e.id}: ${r.err}`); continue; }
      const sc = SCENES[e.id];
      if (!sc || typeof sc.draw !== 'function') { __bootErrors.push(`${e.id}: 文件里没有 SCENES['${e.id}'] = { draw(c, lt, t) }`); continue; }
      e.draw = sc.draw; if (sc.init) e.init = sc.init;
    }
    const ty = e.transition && e.transition.type;
    if (ty && !TRANSITIONS[ty]) {                            // 项目自己的转场：放 transitions/<type>.js，往 TRANSITIONS 上挂同名函数
      const r = load(`transitions/${ty}.js`);
      if (r.err || !TRANSITIONS[ty]) __bootErrors.push(`${e.id}: 转场「${ty}」不在 transitions.js 里，也没有 transitions/${ty}.js（${r.err || '文件里没注册 TRANSITIONS.' + ty}）`);
    }
  }
})();
