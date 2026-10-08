// Project adapter: editable generated assets, semantic palette roles, original neutral presenter.
// This adapter changes composition and explicit colors; it does not invent native renderers for style IDs.
(() => {
const HD=window.HANDRAW={};
HD.colorMap={};
HD.installPalette=p=>{
 const roles={ink:['#0a0503','#171716','#1b1b1f'],accent:['#ef7226','#b8433f'],paper:['#fbfbfb','#e4ddcf','#eeedeb','#f6f4ee']};
 HD.colorMap={...(p?.color_map||{})};for(const [role,keys] of Object.entries(roles))if(p?.[role])for(const key of keys)HD.colorMap[key]=p[role];
};
for(const key of ['fillStyle','strokeStyle']){
 const d=Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype,key);
 Object.defineProperty(CanvasRenderingContext2D.prototype,key,{get:d.get,set(v){if(typeof v==='string')v=HD.colorMap[v.toLowerCase()]||v;d.set.call(this,v);},configurable:true});
}
HD.init=async ctx=>{
 const h=ctx.spec.handdraw||{};HD.installPalette(h.render?.palette);ctx.HDIMG={};
 const images=new Set();const collect=x=>{if(Array.isArray(x))x.forEach(collect);else if(x&&typeof x==='object')for(const[k,v]of Object.entries(x)){if(k==='binding')continue;if(k==='image'&&typeof v==='string')images.add(v);else collect(v);}};collect(h);
 await Promise.all([...images].map(url=>new Promise((res,rej)=>{const im=new Image();im.onload=()=>{ctx.HDIMG[url]=im;res()};im.onerror=()=>rej(new Error('Handdraw layer missing'));im.src=url;})));
 if(h.voice_envelope)window.VO_ENV=h.voice_envelope;
};
HD.image=(c,im,r,W,H,source)=>{
 const[x,y,w,h]=r;const sw=source?.[2]||im.width,sh=source?.[3]||im.height,s=Math.min(w*W/sw,h*H/sh);const dw=sw*s,dh=sh*s;
 if(source)c.drawImage(im,...source,x*W+(w*W-dw)/2,y*H+(h*H-dh)/2,dw,dh);else c.drawImage(im,x*W+(w*W-dw)/2,y*H+(h*H-dh)/2,dw,dh);
};
HD.background=(c,t,ctx)=>{const b=ctx.spec.handdraw?.background;if(!b?.image)return false;HD.image(c,ctx.HDIMG[b.image],b.region||[0,0,1,1],ctx.W,ctx.H,b.source_rect);return true;};
HD.layers=(c,t,ctx)=>{
 for(const layer of ctx.spec.handdraw?.layers||[]){
  if(t<(layer.at||0)||t>=(layer.end??ctx.dur))continue;
  let r=[...(layer.region||[.05,.15,.25,.65])],alpha=layer.alpha??1;
  const keys=layer.keyframes||[];
  if(keys.length){let a=keys[0],b=a;for(const k of keys){if(k.at<=t)a=k;if(k.at>=t){b=k;break}b=k}const q=a===b?0:MO.smooth(U.clamp((t-a.at)/(b.at-a.at)));for(let i=0;i<4;i++)r[i]=U.lerp((a.region||r)[i],(b.region||r)[i],q);alpha=U.lerp(a.alpha??alpha,b.alpha??alpha,q);}
  let im=ctx.HDIMG[layer.image],source=layer.source_rect;
  for(const frame of layer.frames||[])if(t>=frame.at){im=ctx.HDIMG[frame.image||layer.image];source=frame.source_rect||source;}
  c.save();c.globalAlpha=alpha;HD.image(c,im,r,ctx.W,ctx.H,source);c.restore();
 }
};
// Original geometric traveler. No source author hat/glasses/identity appearance.
HD.presenter=(c,o)=>{
 const R=o.s||100,x=o.x||0,y=o.y||0,sq=o.squash||1,p=o.pose||TOON.POSES.rest,ink='#26364a';
 c.save();c.translate(x,y);c.scale(1/Math.sqrt(sq),sq);c.lineCap='round';c.lineJoin='round';c.lineWidth=Math.max(3,R*.035);c.strokeStyle=ink;
 const ellipse=(x,y,rx,ry,color)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();c.stroke();};
 for(const sx of [-1,1]){c.beginPath();c.moveTo(sx*R*.22,-R*.54);c.lineTo(sx*R*.28,-R*.08);c.stroke();ellipse(sx*R*.28,-R*.04,R*.18,R*.07,'#f7eee0');}
 c.fillStyle='#d4a154';c.beginPath();c.roundRect(-R*.48,-R*1.55,R*.96,R*1.08,R*.2);c.fill();c.stroke();
 const hand=(sx,v)=>{const a=[sx*R*.4,-R*1.35],b=[a[0]+v[0]*R*.52,a[1]+v[1]*R*.52];c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();ellipse(...b,R*.1,R*.09,'#f2ccae');return[x+b[0]/Math.sqrt(sq),y+b[1]*sq]};
 const hl=hand(-1,p.l),hr=hand(1,p.r);const hy=-R*2.12+(o.bob||0);
 ellipse(0,hy,R*.61,R*.66,'#f2ccae');c.fillStyle=ink;c.beginPath();c.moveTo(-R*.62,hy);c.bezierCurveTo(-R*.8,hy-R*.9,R*.63,hy-R*.93,R*.6,hy-R*.05);c.lineTo(R*.35,hy-R*.4);c.lineTo(-R*.45,hy-R*.23);c.closePath();c.fill();
 c.fillStyle=ink;for(const sx of[-1,1]){c.beginPath();c.ellipse(sx*R*.21,hy+R*.05,R*.042,o.blink?R*.012:R*.067,0,0,7);c.fill();}
 c.beginPath();c.ellipse(0,hy+R*.28,R*.10,R*(o.mouth?.08:.022),0,0,Math.PI*2);c.fill();
 c.strokeStyle='#357f78';c.lineWidth=R*.045;c.beginPath();c.moveTo(-R*.4,-R*1.46);c.lineTo(R*.4,-R*.58);c.stroke();ellipse(R*.34,-R*.8,R*.19,R*.23,'#357f78');c.restore();return{hl,hr,head:[x,y+hy*sq]};
};
TOON.bean=HD.presenter;
})();
