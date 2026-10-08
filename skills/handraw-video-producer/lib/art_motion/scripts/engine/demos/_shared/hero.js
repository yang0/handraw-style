// Local original presenter, using the imported demo placement contract.
window.HERO={mode:()=>"A",geo:(c,x,y,h,o={})=>HANDRAW.presenter(c,{x,y,s:h/2.85,pose:o.point===false?TOON.POSES.rest:TOON.POSES.point}),y1:(c,t)=>{HERO.geo(c,470,900,440);return true;},y2:(c,t)=>{HERO.geo(c,1500,1040,560);return true;},y3:(c,x,y,h,t)=>{HERO.geo(c,x,y,h);return true;}};
