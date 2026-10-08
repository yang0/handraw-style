// S1 中景：花叔坐在桌后对镜头讲。口播「我第一次让AI帮我写代码，」
// 动：口型（口播包络，一拍二）、说话点头、呼吸、换姿势回弹（talk → point）、眼神跟手、眨眼、窗外云、镜头慢推＋微漂。
// 房间、桌子、笔记本都在 world.js（S4/S5 同一个房间换镜头）。
(() => {
const S = STORY;
const KEYS = [[0, 'talk', 'happy'], [1.12, 'point', 'talk']];
SCENES['s1_desk'] = {
  draw(c, lt, t) {
    const ts = MO.step(t, 24);                                     // 角色按 24fps（Flash 默认帧率）走，镜头按 60fps 平滑
    const zoom = 1.01 + 0.035 * MO.expoOut(Math.min(1, lt / 2.0)) + 0.03 * (1 - MO.expoOut(Math.min(1, lt / 0.5)));   // 开场 1.04→1.01 落定，再慢推 3.5%
    const [dx, dy] = CAM.drift(t, 4, 1);
    CAM.with(c, { x: 900 + dx, y: 520 + dy, z: zoom }, c => {
      const st = S.poseAt(KEYS, ts), al = S.alive(ts, 165);
      S.world(c, t, { pose: st.pose, expr: st.expr, mouth: TOON.mouth(t), blink: S.blinkAt(ts), look: ts > 1.12 ? [1, 0] : [0, 0], squash: st.squash * al.breathe, bob: al.bob, tilt: ts > 1.12 ? 0.05 : -0.03 });
    });
  },
};
})();
