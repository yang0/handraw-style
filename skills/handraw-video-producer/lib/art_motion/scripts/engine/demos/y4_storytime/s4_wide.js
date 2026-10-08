// S4 大全景（同一个房间拉远到 0.5 倍）：小小的花叔坐在大房间里。口播「我问它：这些……」
// 全景让人显得渺小无助 —— 远景本身就是笑点的铺垫。返修：两段停顿里加「眼睛瞟一下电脑再看镜头」、说「这些」时指电脑。
// 动：口型、眼神（6.2 瞟电脑 → 6.6 回到镜头）、换姿势回弹（talk → point）、吊灯摆、云飘、屏幕光闪、镜头极慢拉远。
(() => {
const S = STORY;
SCENES['s4_wide'] = {
  draw(c, lt, t) {
    const ts = MO.step(t, 24);
    const zoom = 0.53 - 0.03 * MO.quintOut(Math.min(1, lt / 1.65));          // 0.53 → 0.50
    CAM.with(c, { x: 900, y: 470, z: zoom }, c => {
      const st = S.poseAt(S.KEYS_END, ts), al = S.alive(ts, 165);
      S.world(c, t, { pose: st.pose, expr: st.expr, mouth: TOON.mouth(t), blink: S.blinkAt(ts), look: S.lookEnd(ts), squash: st.squash * al.breathe, bob: al.bob, lw: 10 });
    });
  },
};
})();
