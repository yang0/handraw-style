// 口播对位：TM.cue('s03', '2007年') = 「2007年」这几个字开始被念出的时刻（本段局部秒，lt）。
// TM.end('s03', '2007年') = 这几个字念完的时刻。TM.dur('s03') 段长；TM.vo('s03') = [口播开始, 口播结束]（局部秒）。
// 键必须是该段字幕文本里的原样子串（第一次出现）；写错了会 console.error 并让渲染失败。
window.TM = (() => {
  const seg = id => { const s = TIMING.seg[id]; if (!s) throw new Error('TIMING 没有段 ' + id); return s; };
  function find(id, key, which) {
    const s = seg(id), i = s.text.indexOf(key);
    if (i < 0) { console.error(`TM: 段 ${id} 的字幕里没有「${key}」`); return 0; }
    const j = which === 'end' ? i + key.length - 1 : i;
    return which === 'end' ? s.charEnd[j] : s.charStart[j];
  }
  return {
    cue: (id, key) => find(id, key, 'start'),
    end: (id, key) => find(id, key, 'end'),
    dur: id => seg(id).dur,
    vo: id => [seg(id).voStart, seg(id).voEnd],
    text: id => seg(id).text,
  };
})();
