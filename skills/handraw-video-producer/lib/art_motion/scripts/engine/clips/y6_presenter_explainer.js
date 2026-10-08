// Project parameterization of presenter-led explanation; uses original geometric or supplied handdraw frames.
CLIPS.y6_presenter_explainer={
 fonts:['PuHui-Bold','PuHui-Medium'],safe:true,
 draw(c,t,ctx){
  const{W,H,u,box,data,cues}=ctx;
  if(!ctx.alpha){c.fillStyle='#f6f4ee';c.fillRect(0,0,W,H);}
  const active=cues.filter(q=>q.at<=t).at(-1);const stage=active?.data?.pose||'talk';
  if(!ctx.spec.handdraw?.layers?.some(x=>x.role==='presenter')){
   const pose=TOON.POSES[stage]||TOON.POSES.talk;
   HANDRAW.presenter(c,{x:ctx.portrait?W*.28:W*.23,y:box.y+box.h*.88,s:160*u,pose,mouth:ctx.spec.handdraw?.voice_envelope?TOON.mouth(t):0,expr:'talk'});
  }
  const x=ctx.portrait?box.x+box.w*.48:box.x+box.w*.45,w=ctx.portrait?box.w*.48:box.w*.5;
  const text=active?.sub||active?.text||data.title||'';
  const fitted=TY.fit(c,text,w,48*u,'PuHui-Bold',{maxLines:5,min:.65});
  c.font=`${fitted.size}px "PuHui-Bold"`;c.fillStyle='#26364a';c.textAlign='left';
  fitted.lines.forEach((line,i)=>c.fillText(line,x,box.y+box.h*.18+i*fitted.size*1.35));
  if(active?.image){const im=ctx.IMG[active.image];const r=CLIP.fit(im.width,im.height,x,box.y+box.h*.43,w,box.h*.43);c.drawImage(im,r.x,r.y,r.w,r.h);}
 }
};
