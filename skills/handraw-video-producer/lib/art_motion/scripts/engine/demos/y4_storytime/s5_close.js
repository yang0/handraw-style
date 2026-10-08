// S5 近景（跳近：同机位直接切到 1.9 倍）：「贴哪儿？」——摊手、眉毛内端抬高、头顶「？」弹出，然后定住 0.95s 给笑。
// 返修：第一版把这句放在全景里，脸只有 110px 高，表情看不清，「？」出来 0.4s 片子就完了。
(() => {
const S = STORY;
SCENES['s5_close'] = {
  draw(c, lt, t) {
    const ts = MO.step(t, 24);
    const zoom = 1.9 + 0.08 * MO.quintOut(Math.min(1, lt / 1.5));           // 跳近后极慢再推 4%
    CAM.with(c, { x: 870, y: 470, z: zoom }, c => {
      const st = S.poseAt(S.KEYS_END, ts), al = S.alive(ts, 165);
      const info = S.world(c, t, { pose: st.pose, expr: st.expr, mouth: TOON.mouth(t), blink: S.blinkAt(ts, [8.3]), look: S.lookEnd(ts), squash: st.squash * al.breathe, bob: al.bob, tilt: ts >= 7.45 ? -0.07 : 0, browUp: ts >= 7.45 ? 0.04 : 0 });
      // 「？」：问完那一刻弹出（过冲 30%），之后 ±3° 轻晃
      const q = MO.at(t, 7.80, 0.26);
      if (q > 0) { c.save(); c.translate(info.head[0] + 165 * 1.4, info.head[1] - 165 * 0.5); c.rotate(0.14 + 0.05 * Math.sin(t * 6)); TOON.mark(c, '？', 0, 0, q, 120); c.restore(); }
    });
  },
};
})();
