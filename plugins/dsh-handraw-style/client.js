window.__ModuleLoader__.load({
  id:'dsh-plugin-handraw-style',
  factory(require) {
    const {createElement:h,useState,useEffect,useRef} = require('react');
    const panel='handraw-style';
    const api='/api/handraw-style.';
    const localKey='dsh-handraw-style:workspace:v2';
    const oldLocalKey='dsh-handraw-style:workspace:v1';
    const dbName='dsh-handraw-style-v1'; // Reuse v1 DB so upgrading preserves generated images.
    const subscribers=new Set();
    const catalogs={};
    const classNames={style:'画风',layout:'版式图型',color:'主题色',tone:'光影影调'};
    const groups={
      style:[['FA','社论幽默'],['FB','经典绘本'],['FC','平面艺术'],['FD','当代插画'],['FE','国风工艺'],['FF','黏土纸雕'],['FG','动漫赛璐璐'],['FH','实验媒介'],['FI','写实摄影']],
      layout:[['SC','社媒卡'],['IG','信息图'],['SB','漫画分镜'],['IP','IP设计'],['EC','电商图']],color:[],tone:[],
    };
    let snapshot,hydrated=false,hydratePromise,databasePromise,writeTimer,writeChain=Promise.resolve(),storageError='';
    const job={controller:null,pageId:null};
    const uid=()=>typeof crypto?.randomUUID==='function'?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const freshPage=()=>({id:uid(),theme:'',copy:'',brief:'',scenario:'',audience:'',style:'',style2:'',fusion:false,layout:'',color:'',tone:'',mode:'pure-image',ratio:'3:4',whitespace:'none',layoutVariant:1,aiAssist:false,savedPath:'',
      language:'zh',output:'prompt',styleReference:'auto',lockedFields:[],upload:'',image:'',prompt:'',status:'',error:''});
    const initial=()=>({pages:[freshPage()],active:0,section:'compose',galleryKind:'style',galleryGroup:'all',search:'',density:'medium',savedAt:0});
    function normalize(value) {
      if (!value||!Array.isArray(value.pages)||!value.pages.length)return null;
      const base=initial(),pageBase=freshPage();
      const pages=value.pages.slice(0,24).map(row=>{
        const p={...pageBase,...row,id:row.id||uid(),upload:typeof row.upload==='string'?row.upload:'',image:typeof row.image==='string'?row.image:''};
        if(typeof p.styleReference==='boolean')p.styleReference=p.styleReference?'always':'never';
        if(!['auto','always','never'].includes(p.styleReference))p.styleReference='auto';
        if(!/^(?:\d+(?:\.\d+)?)[：:](?:\d+(?:\.\d+)?)$/.test(p.ratio)||!validRatio(p.ratio))p.ratio='3:4';
        // Existing v3 projects with a scene style were implicitly in dual-style mode.
        // Preserve their meaning; all newly created pages default to a single style.
        p.fusion=row.fusion===true||(row.fusion===undefined&&Boolean(row.style2));
        p.aiAssist=p.aiAssist===true;
        // Existing v4 archives lacked field-level edit tracking. Preserve all
        // non-default legacy selections as deliberate user input.
        p.lockedFields=Array.isArray(row.lockedFields)
          ?row.lockedFields.filter(v=>['style','style2','layout','color','tone','mode','ratio','whitespace','layoutVariant'].includes(v))
          :[...['style','style2','layout','color','tone'].filter(k=>Boolean(row[k])),
            ...(row.ratio&&row.ratio!=='3:4'?['ratio']:[]),
            ...(row.mode&&row.mode!=='pure-image'?['mode']:[]),
            ...(row.whitespace&&row.whitespace!=='none'?['whitespace']:[]),
            ...(row.layoutVariant&&Number(row.layoutVariant)!==1?['layoutVariant']:[])];
        p.savedPath=typeof p.savedPath==='string'?p.savedPath:'';
        if(!['prompt','image'].includes(p.output))p.output=p.image?'image':'prompt';
        if(!['zh','en','both'].includes(p.language))p.language='zh';
        return p;
      });
      const n={...base,...value,pages,active:Math.max(0,Math.min(Math.floor(Number(value.active)||0),pages.length-1))};
      if (!['compose','gallery'].includes(n.section))n.section='compose';
      if (!Object.hasOwn(classNames,n.galleryKind))n.galleryKind='style';
      return n;
    }
    const validRatio=ratio=>{const m=/^(\d+(?:\.\d+)?)[：:](\d+(?:\.\d+)?)$/.exec(String(ratio||''));return !!m&&Number(m[1])>=1&&Number(m[2])>=1&&Number(m[1])<=200&&Number(m[2])<=200;};
    const ratioPresets=[['3:4','小红书竖版 · 3:4'],['2:3','经典竖幅 · 2:3'],['9:16','手机全屏 · 9:16'],['1:1','正方形 · 1:1'],['4:3','文章插图 · 4:3'],['3:2','摄影横版 · 3:2'],['16:9','视频封面 · 16:9'],['21:9','超宽封面 · 21:9'],['2.35:1','公众号宽封面 · 2.35:1'],['5:2','X 文章封面 · 5:2']];
    const light=value=>({...value,pages:value.pages.map(page=>({...page,image:'',upload:''}))});
    const readLocal=()=>{try{return normalize(JSON.parse(localStorage.getItem(localKey)||localStorage.getItem(oldLocalKey)||'null'));}catch{return null;}};
    const getState=()=>snapshot||(snapshot=readLocal()||initial());
    function notify(){for(const callback of [...subscribers])callback(getState());}
    function update(updater,immediate=false){
      const old=getState();
      const next=typeof updater==='function'?updater(old):updater;
      if(!next)return;
      snapshot={...next,savedAt:Math.max(Date.now(),(old.savedAt||0)+1)};
      try{localStorage.setItem(localKey,JSON.stringify(light(snapshot)));}
      catch{storageError='浏览器轻量存储不可用；刷新后设置可能无法恢复。';}
      notify();if(hydrated)scheduleWrite(immediate);
    }
    const setPage=(pageId,patch,immediate=false)=>update(s=>({...s,pages:s.pages.map(p=>p.id===pageId?{...p,...patch}:p)}),immediate);
    function openDB(){
      if(!databasePromise)databasePromise=new Promise((resolve,reject)=>{
        const req=indexedDB.open(dbName,1);
        req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('workspace'))req.result.createObjectStore('workspace');};
        req.onsuccess=()=>{req.result.onversionchange=()=>{req.result.close();databasePromise=null;};resolve(req.result);};
        req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('存储被其他标签页阻塞'));
      }).catch(e=>{databasePromise=null;throw e;});
      return databasePromise;
    }
    async function store(op,value){
      const db=await openDB();
      return new Promise((resolve,reject)=>{
        const tx=db.transaction('workspace',op==='get'?'readonly':'readwrite');
        const req=op==='get'?tx.objectStore('workspace').get('current'):tx.objectStore('workspace').put(value,'current');
        tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      });
    }
    function scheduleWrite(immediate){if(writeTimer)clearTimeout(writeTimer);writeTimer=setTimeout(flushWrite,immediate?0:220);}
    function flushWrite(){
      if(writeTimer)clearTimeout(writeTimer);writeTimer=null;
      if(!hydrated)return writeChain;
      const copy=getState();
      writeChain=writeChain.catch(()=>{}).then(()=>store('put',copy)).catch(()=>{storageError='IndexedDB 保存失败：文字仍尝试保留，图片请及时下载。';notify();});
      return writeChain;
    }
    function mergeMedia(current,stored){
      const byId=new Map(stored.pages.map(p=>[p.id,p]));
      return {...current,pages:current.pages.map(p=>{const old=byId.get(p.id);return old?{...p,image:p.image||old.image||'',upload:p.upload||old.upload||''}:p;})};
    }
    function hydrate(){
      if(hydratePromise)return hydratePromise;
      hydratePromise=(async()=>{
        let saved;
        try{saved=normalize(await store('get'));}catch{storageError='IndexedDB 无法读取，成图跨刷新恢复不可用。';}
        const current=getState();
        if(saved)snapshot=(saved.savedAt||0)>(current.savedAt||0)?saved:mergeMedia(current,saved);
        snapshot={...getState(),pages:getState().pages.map(p=>({...p,status:p.status==='generating'&&!job.controller?'interrupted':p.status}))};
        hydrated=true;notify();scheduleWrite(false);
      })();return hydratePromise;
    }
    window.addEventListener('pagehide',flushWrite);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushWrite();});
    async function request(path,data,signal){
      const response=await fetch(api+path,{signal,...(data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})});
      if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.error||`接口错误 HTTP ${response.status}`);}
      return response.json();
    }
    const thumb=(kind,item)=>api+'thumb?'+new URLSearchParams({kind,id:item.id});
    const pageDesign=p=>({theme:p.theme,copy:p.copy,brief:p.brief,scenario:p.scenario,audience:p.audience,
      style:p.style,style2:p.fusion===true?p.style2:'',fusion:p.fusion===true,layout:p.layout,color:p.color,tone:p.tone,mode:p.mode,ratio:p.ratio,
      whitespace:p.whitespace,layoutVariant:p.layoutVariant,language:p.language,lockedFields:p.lockedFields||[],referenceUpload:Boolean(p.upload),explicitStyle:Boolean(p.style||(p.fusion&&p.style2))});
    const sizeFor=p=>{const m=/^(\d+(?:\.\d+)?)[：:](\d+(?:\.\d+)?)$/.exec(p.ratio||'');if(!m)return '1024x1536';const r=Number(m[1])/Number(m[2]);return Math.abs(r-1)<0.01?'1024x1024':r>1?'1536x1024':'1024x1536';};
    async function generate(page){
      if(job.controller)throw new Error('已有一张图片正在生成。');
      if(!page.theme.trim())throw new Error('直接生图需要画面主题。');
      if(page.customRatio!==undefined&&!validRatio(page.customRatio))throw new Error('自定义画幅应为正数比例，例如 7:10 或 2.35:1。');
      const controller=new AbortController();job.controller=controller;job.pageId=page.id;
      setPage(page.id,{status:'generating',output:'image',error:''},true);
      try{
        const result=await request('generate',{design:pageDesign(page),aiAssist:page.aiAssist===true,upload:page.upload,size:sizeFor(page),styleReference:page.styleReference},controller.signal);
        const newest=getState().pages.find(p=>p.id===page.id);
        if(newest){const selected={};for(const key of ['style','style2','layout','color','tone','mode','ratio','whitespace','layoutVariant'])if(!(newest.lockedFields||[]).includes(key)&&result.design?.[key]!==undefined)selected[key]=result.design[key];
          setPage(page.id,{...selected,image:result.image,savedPath:result.savedPath,prompt:result.prompt,status:'done',error:''},true);}
        flushWrite();
      }catch(error){setPage(page.id,{status:controller.signal.aborted?'interrupted':'error',error:controller.signal.aborted?'已取消任务。':error.message},true);}
      finally{if(job.controller===controller){job.controller=null;job.pageId=null;}notify();}
    }
    const el=(tag,props,...children)=>h(tag,props,...children);
    const btn=(label,click,props={})=>el('button',{type:'button',onClick:click,...props},label);
    const selectedLabels={style:'画风',style2:'场景／环境画风',layout:'版式图型',color:'主题色',tone:'影调'};
    const css=`
.hd2{--ink:#282e35;--mute:#77818c;--line:#dfe5e9;--paper:#fff;--wash:#f6f8f9;--accent:#1e716b;--accent-soft:#e5f2ef;--gold:#a8753e;height:100%;min-height:100%;overflow:auto;color:var(--ink);background:var(--wash);font:14px/1.55 system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color-scheme:light}
.hd2 *{box-sizing:border-box}.hd2 button,.hd2 input,.hd2 textarea,.hd2 select{font:inherit;color:inherit}.hd2 button{cursor:pointer}.hd2 button:disabled{opacity:.45;cursor:not-allowed}.hd2 button:focus-visible,.hd2 input:focus-visible,.hd2 textarea:focus-visible,.hd2 select:focus-visible{outline:3px solid #87c6bd;outline-offset:2px}
.hd2 .stack{display:grid;gap:12px}.hd2 .pagecontents{display:flex;align-items:center;gap:9px;min-width:0}.hd2 .pickcontent{display:flex;align-items:center;gap:8px;min-width:0}.hd2 h1,.hd2 h2,.hd2 h3,.hd2 p{margin:0}.hd2 h1{font-size:22px;letter-spacing:-.04em;line-height:1.25}.hd2 h2{font-size:17px;letter-spacing:-.015em}.hd2 h3{font-size:14px}.hd2 .muted,.hd2 small{font-size:12px;color:var(--mute)}
.hd2 .top{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:14px clamp(16px,2.5vw,34px);background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:8;flex-wrap:wrap}
.hd2 .brand{display:flex;align-items:center;gap:12px}.hd2 .brandmark{display:grid;place-items:center;border-radius:12px;width:42px;height:42px;background:#e0efe9;font-size:24px;color:#1f7062}.hd2 .brand small{display:block;margin-top:2px}
.hd2 .nav{display:flex;gap:5px;align-items:center;border:1px solid var(--line);padding:4px;border-radius:12px;background:#f7f9fa}.hd2 .nav button{border:0;background:transparent;border-radius:9px;padding:8px 14px;font-weight:600;color:#626f77}.hd2 .nav button.active{background:white;color:#175e58;box-shadow:0 1px 5px #0019221a}.hd2 .topright{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.hd2 .repo-link{font-size:12px;color:#246960;text-decoration:none;border-bottom:1px solid #a3c8c0;white-space:nowrap}.hd2 .repo-link:hover{text-decoration:underline}
.hd2 .button{border:1px solid #d7e0e2;background:#fff;border-radius:10px;padding:9px 14px;min-height:38px;transition:background .12s,border-color .12s;white-space:normal;text-align:center}.hd2 .button:hover:not(:disabled){border-color:#6caaa3;background:#f2faf8}.hd2 .button.primary{background:var(--accent);color:#fff;border-color:var(--accent);font-weight:700}.hd2 .button.primary:hover:not(:disabled){background:#185b56}.hd2 .button.soft{background:var(--accent-soft);color:#17665e;border-color:#bdd9d2}.hd2 .button.ghost{background:transparent;border-color:transparent;color:#4b5b63}.hd2 .button.danger{color:#a94738;border-color:#ebcec8}.hd2 .button.icon{width:38px;padding:6px}.hd2 .button.small{font-size:12px;min-height:32px;padding:5px 10px}
.hd2 .main{max-width:1650px;margin:0 auto;padding:25px clamp(14px,2.4vw,34px) 55px}.hd2 .heading{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:17px}.hd2 .heading .eyebrow{color:#1b736a;font-size:11px;letter-spacing:.12em;font-weight:800;text-transform:uppercase;margin-bottom:5px}.hd2 .heading p{margin-top:5px;color:var(--mute)}
.hd2 .compose{display:grid;grid-template-columns:200px minmax(370px,.9fr) minmax(400px,1.16fr);gap:16px;align-items:start}.hd2 .card{min-width:0;background:white;border:1px solid var(--line);border-radius:17px;padding:19px;box-shadow:0 3px 17px rgba(35,52,70,.025)}.hd2 .sticky{position:sticky;top:110px}.hd2 .rail{display:grid;gap:9px}.hd2 .rail .page{width:100%;display:flex;gap:10px;align-items:center;text-align:left;border:1px solid #e5ebec;background:#fff;border-radius:11px;padding:9px}.hd2 .rail .page.selected{background:var(--accent-soft);border-color:#8fc1b6}.hd2 .rail .page .page-no{width:32px;height:32px;flex:none;border-radius:8px;background:#e8edf0;display:grid;place-items:center;color:#56636a;font-weight:800}.hd2 .rail .page.selected .page-no{background:#1e716b;color:#fff}.hd2 .rail .page .name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hd2 .rail .page .status{display:block;color:#809099;font-size:11px}.hd2 .minihead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:11px}.hd2 .rail small{line-height:1.7}
.hd2 .form{display:grid;gap:14px}.hd2 .field{display:grid;gap:5px}.hd2 .field>span{font-size:12px;font-weight:700;color:#485962}.hd2 input[type=text],.hd2 input[type=password],.hd2 input:not([type]),.hd2 textarea,.hd2 select{width:100%;min-width:0;border:1px solid #d8e0e4;border-radius:10px;background:#fff;padding:10px 11px;outline:none}.hd2 textarea{resize:vertical;min-height:105px;line-height:1.65}.hd2 textarea.theme{min-height:148px;font-size:14px}.hd2 textarea.smalltext{min-height:64px}.hd2 input:focus,.hd2 textarea:focus,.hd2 select:focus{border-color:#6bada4}.hd2 .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.hd2 .split{display:grid;grid-template-columns:1fr 1fr;gap:10px}.hd2 .divider{height:1px;background:var(--line);margin:2px 0}.hd2 .sectiontitle{display:flex;justify-content:space-between;align-items:baseline;gap:8px}.hd2 .sectiontitle .muted{font-weight:400}
.hd2 .seg{display:flex;gap:4px;padding:4px;border-radius:12px;background:#f1f4f5}.hd2 .seg button{border:0;background:transparent;border-radius:9px;padding:9px 13px;flex:1;font-weight:650;color:#677680}.hd2 .seg button.selected{background:white;color:#1c6761;box-shadow:0 2px 6px #15272f12}
.hd2 .pickgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.hd2 .pick{min-width:0;display:flex;align-items:center;gap:8px;border:1px dashed #c9d5d7;background:#fafcfc;border-radius:11px;text-align:left;padding:8px;min-height:76px}.hd2 .pick:hover{border-color:#74afa5;background:#f2faf8}.hd2 .pick .pickimg{display:grid;place-items:center;width:56px;height:60px;flex:none;border-radius:7px;overflow:hidden;background:#edf1f3}.hd2 .pick .pickimg img{display:block;width:100%;height:100%;object-fit:contain}.hd2 .pick .pickmeta{min-width:0;display:grid;gap:1px}.hd2 .pick .pickmeta strong{font-size:12px;color:#346359}.hd2 .pick .pickmeta span{font-size:11px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.hd2 .clear{border:0;background:transparent;color:#d16756;font-size:11px;text-decoration:underline;padding:2px}
.hd2 .filebox{display:flex;align-items:center;gap:10px;border:1px dashed #cad8da;border-radius:12px;padding:8px;background:#fafdfe}.hd2 .filebox img{width:78px;height:78px;object-fit:contain;background:#eef2f3;border-radius:8px}.hd2 .filebox .text{min-width:0;flex:1}.hd2 .filebox .text strong{display:block;font-size:12px}.hd2 .filebox input{display:none}.hd2 .details{border:1px solid var(--line);border-radius:11px;padding:12px}.hd2 .details summary{cursor:pointer;font-weight:700;color:#51636c}.hd2 .details .inner{display:grid;gap:11px;padding-top:12px}
.hd2 .delivery{display:grid;gap:15px}.hd2 .deliverytop{display:flex;justify-content:space-between;gap:12px;align-items:center}.hd2 .note{font-size:12px;color:#677c83}.hd2 .resultarea{border:1px solid #e2e8e9;border-radius:15px;min-height:475px;background:linear-gradient(145deg,#f3f7f6,#eef1f3);display:grid;place-items:center;overflow:hidden;padding:18px}.hd2 .resultarea img{width:100%;height:100%;max-height:660px;max-width:100%;object-fit:contain;display:block;cursor:zoom-in}.hd2 .resultempty{padding:45px 16px;max-width:340px;text-align:center;display:grid;gap:10px;justify-items:center}.hd2 .resultempty .illustration{font-size:40px}.hd2 .resultempty strong{font-size:16px}.hd2 .resultempty span{font-size:12px;color:var(--mute)}
.hd2 .promptout{border:1px solid #e0e6e8;border-radius:12px;background:#fbfcfd;padding:14px;white-space:pre-wrap;overflow:auto;overflow-wrap:anywhere;max-height:660px;min-height:145px;line-height:1.8;font-size:13px;user-select:text}.hd2 .promptout.big{min-height:390px}.hd2 .actionrow{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.hd2 .actionrow .primary{flex:1}.hd2 .state{font-size:12px;color:#286b63}.hd2 .error{font-size:12px;color:#a63838;overflow-wrap:anywhere}.hd2 .toast{position:sticky;bottom:14px;z-index:15;background:#e6f3f0;color:#155b54;border:1px solid #a9cec4;max-width:880px;margin:15px auto 0;padding:10px 14px;border-radius:11px;box-shadow:0 5px 22px #0001}
.hd2 .gallery-shell{display:grid;gap:14px}.hd2 .gfilters{display:flex;flex-wrap:wrap;gap:7px;align-items:center}.hd2 .gfilters .gfilter{width:auto;text-align:left;border:1px solid #d8e2e2;background:white;border-radius:999px;padding:7px 13px;display:inline-flex;gap:7px}.hd2 .gfilters .gfilter.selected{background:var(--accent-soft);border-color:#91c5b8;color:#1c6b63;font-weight:750}.hd2 .gallerycontent{min-width:0}.hd2 .gallerybar{display:flex;gap:10px;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-bottom:13px}.hd2 .gallerybar input{max-width:340px;flex:1}.hd2 .assetgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(204px,1fr));align-items:start;gap:16px}.hd2 .assetgrid.dense{grid-template-columns:repeat(auto-fill,minmax(143px,1fr));gap:12px}.hd2 .assetgrid.large{grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px}
.hd2 .assetcard{position:relative;min-width:0;border:1px solid #dce5e7;border-radius:15px;background:#fff;overflow:hidden;box-shadow:0 2px 10px #284c5210}.hd2 .assetcard.selected{border-color:var(--accent);box-shadow:0 0 0 2px #54a89a66}.hd2 .assetcard .select{display:block;width:100%;border:0;padding:0;background:none;text-align:left}.hd2 .asset-visual{width:100%;aspect-ratio:4/5;background:#edf1f2;display:grid;place-items:center;padding:11px;overflow:hidden}.hd2 .asset-visual img{display:block;width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain;object-position:center}.hd2 .asset-info{padding:11px 12px;display:grid;gap:3px;min-height:77px}.hd2 .asset-info strong{font-size:12px;color:#2b6662}.hd2 .asset-info span{font-size:13px;font-weight:650;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.hd2 .asset-info small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hd2 .expand{position:absolute;right:12px;top:12px;background:#ffffffea;border:1px solid #d3dfdf;border-radius:8px;padding:6px 10px;font-size:12px;color:#234c4a;box-shadow:0 2px 7px #0002}.hd2 .assetbadge{position:absolute;top:12px;left:12px;padding:4px 8px;border-radius:7px;background:#1e716b;color:white;font-size:11px;font-weight:700}

.hd2 .overlay{position:fixed;inset:0;background:rgba(12,19,27,.86);z-index:30;display:flex;align-items:center;justify-content:center;padding:20px}.hd2 .lightbox{width:min(95vw,1450px);height:min(94vh,1100px);display:flex;flex-direction:column;gap:12px}.hd2 .lighttools{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;color:white}.hd2 .lighttools .button{background:#ffffff20;color:white;border-color:#ffffff66}.hd2 .lighttools .button.primary{background:#d7f0e9;color:#175f56}.hd2 .lightstage{background:#111a22;flex:1;min-height:0;position:relative;overflow:auto;border-radius:13px}.hd2 .lightstage img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:contain;object-position:center;transform-origin:center center}.hd2 .overlay.settings .lightbox{height:auto;max-width:560px;background:white;padding:20px;border-radius:17px}.hd2 .overlay.settings .lighttools{color:#253e43}.hd2 .overlay.settings .lighttools .button{color:#263c41;background:#fff;border-color:#d3dfe1}
.hd2 .ai-switch{display:flex;align-items:flex-start;gap:10px;padding:13px;border:1px solid #c3ded8;background:#f2faf7;border-radius:12px;cursor:pointer}.hd2 .ai-switch input{width:18px;height:18px;margin-top:2px;accent-color:#17675d;flex:none}.hd2 .ai-switch strong{display:block}.hd2 .ai-switch small{display:block;line-height:1.6;margin-top:3px}
.hd2 .hostpath{padding:11px;border:1px solid #dce5e7;border-radius:10px;background:#fafcfc;display:grid;gap:5px}.hd2 .hostpath code{overflow-wrap:anywhere;user-select:text;font-size:12px;color:#356660}
.hd2 .overlay.picker{background:#162b33b8;z-index:40}.hd2 .pickerbox{display:flex;flex-direction:column;width:min(94vw,1150px);max-height:93vh;min-height:460px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 25px 100px #00192255}.hd2 .pickerhead,.hd2 .pickerfooter{padding:14px 20px;display:flex;gap:12px;justify-content:space-between;align-items:center;background:#fff;border-bottom:1px solid var(--line);flex-wrap:wrap}.hd2 .pickerfooter{border-top:1px solid var(--line);border-bottom:0}.hd2 .pickerbody{min-height:0;overflow:auto;padding:16px 20px;background:#f7fafb}.hd2 .pickercontrols{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin-bottom:15px}.hd2 .pickercontrols input{max-width:330px;flex:1}.hd2 .pickercard{border:2px solid #d8e1e3;border-radius:12px;background:#fff;padding:8px;text-align:left;display:grid;gap:7px;min-width:0}.hd2 .pickercard[aria-pressed=true]{border-color:#1e716b;background:#eaf6f2}.hd2 .pickercard img{width:100%;height:180px;object-fit:contain;background:#f0f4f4;border-radius:7px}.hd2 .pickercard strong{font-size:12px}.hd2 .pickercard small{display:block;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hd2 .pickergrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(162px,1fr));gap:11px}.hd2 .pickergrid.large{grid-template-columns:repeat(auto-fill,minmax(225px,1fr))}.hd2 .pickergrid.large img{height:240px}.hd2 .overlay.viewer{z-index:60}.hd2 .pickertabs{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:15px}.hd2 .pickertab{padding:7px 13px;border-radius:999px;border:1px solid #cfdbde;background:#fff;color:#465b61;white-space:nowrap;min-height:34px}.hd2 .pickertab:hover{border-color:#69a79e;background:#f3faf7}.hd2 .pickertab.active{border-color:#1e716b;background:#e5f2ef;color:#14564f;font-weight:750}.hd2 .fusion-switch{display:flex;gap:10px;align-items:flex-start;background:#f4f8f8;border:1px solid #d8e7e5;border-radius:11px;padding:10px 12px;cursor:pointer}.hd2 .fusion-switch input{width:18px;height:18px;margin-top:2px;accent-color:#1e716b;flex:none}.hd2 .fusion-switch strong,.hd2 .fusion-switch small{display:block}.hd2 .fusion-switch small{line-height:1.5;margin-top:2px}

@media(max-width:1300px){.hd2 .compose{grid-template-columns:160px minmax(340px,.85fr) minmax(350px,1.1fr)}.hd2 .card{padding:14px}.hd2 .pickgrid{grid-template-columns:1fr 1fr}}
@media(max-width:1060px){.hd2 .compose{grid-template-columns:160px minmax(0,1fr)}.hd2 .delivery{grid-column:2}.hd2 .sticky{position:static}}
@media(max-width:740px){.hd2 .compose{display:flex;flex-direction:column}.hd2 .compose>*{width:100%}.hd2 .rail .pages{display:flex;gap:8px;overflow:auto}.hd2 .rail .page{min-width:145px}.hd2 .main{padding:15px}.hd2 .gallery-shell{display:block}.hd2 .gfilters{display:flex;flex-wrap:nowrap;overflow-x:auto;white-space:nowrap;margin-bottom:15px;padding-bottom:5px}.hd2 .gfilters .gfilter{width:auto;white-space:nowrap;flex:none}.hd2 .pickertabs{flex-wrap:nowrap;overflow-x:auto;padding-bottom:6px}.hd2 .pickertab{flex:none}.hd2 .assetgrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.hd2 .assetgrid.large{grid-template-columns:repeat(2,minmax(0,1fr))}.hd2 .assetgrid.dense{grid-template-columns:repeat(3,minmax(0,1fr))}.hd2 .asset-info{padding:8px}.hd2 .top{position:static}.hd2 .nav{order:3;width:100%;justify-content:space-around}.hd2 .nav button{flex:1;padding:7px 6px}.hd2 .resultarea{min-height:330px}}

/* v0.5: DSH sidebars narrow the plugin's CONTENT BOX, not the viewport.
   Use container queries and zero-minimum grids to keep long titles inside cards. */
.hd2{width:100%;max-width:100%;min-width:0;overflow-x:hidden;overflow-y:auto}
.hd2 .main{width:100%;max-width:1650px;min-width:0;container-name:workbench;container-type:inline-size}
.hd2 .compose{width:100%;min-width:0;max-width:100%;grid-template-columns:minmax(160px,205px) minmax(0,1fr);gap:16px}
.hd2 .compose > *, .hd2 .form, .hd2 .delivery, .hd2 .rail{min-width:0;max-width:100%}
.hd2 .delivery{grid-column:2;position:static}
.hd2 .rail{width:100%;min-width:0;overflow:hidden;align-content:start;position:static}
.hd2 .rail .pages{min-width:0;max-width:100%;width:100%;display:grid;gap:8px}
.hd2 .rail .page{min-width:0;max-width:100%;width:100%;overflow:hidden;display:flex;flex-wrap:nowrap}
.hd2 .rail .pagecontents{flex:1 1 0;display:flex;width:100%;max-width:100%;min-width:0;overflow:hidden}
.hd2 .rail .page .name{display:block;flex:1 1 0;max-width:100%;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.hd2 .rail .page .status{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hd2 .rail .minihead{min-width:0;max-width:100%;flex-wrap:wrap}
.hd2 .rail small,.hd2 .card p,.hd2 .card .note{overflow-wrap:anywhere}
.hd2 .form .split{grid-template-columns:repeat(2,minmax(0,1fr))}
.hd2 .field{min-width:0;max-width:100%}
.hd2 .field textarea,.hd2 .field input,.hd2 .field select{max-width:100%}
.hd2 .pickgrid{grid-template-columns:repeat(2,minmax(0,1fr))}
.hd2 .pick{max-width:100%;overflow:hidden}
.hd2 .pick .pickcontent{width:100%;min-width:0}
.hd2 .pick .pickmeta{min-width:0;overflow:hidden}
@container workbench (min-width:1320px){
 .hd2 .compose{grid-template-columns:minmax(180px,210px) minmax(0,1fr) minmax(0,1.14fr)}
 .hd2 .delivery{grid-column:auto;position:sticky;top:110px}
 .hd2 .rail{position:sticky;top:110px}
}
@container workbench (max-width:760px){
 .hd2 .compose{display:flex;flex-direction:column;gap:12px}
 .hd2 .compose>*{width:100%;min-width:0;max-width:100%}
 .hd2 .rail{overflow:visible}
 .hd2 .rail .pages{display:flex;flex-wrap:nowrap;overflow-x:auto;gap:8px;padding-bottom:5px}
 .hd2 .rail .page{flex:0 0 150px;max-width:200px}
 .hd2 .delivery{grid-column:auto}
 .hd2 .pickgrid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@container workbench (max-width:480px){
 .hd2 .form .split{grid-template-columns:minmax(0,1fr)}
 .hd2 .pickgrid{grid-template-columns:minmax(0,1fr)}
 .hd2 .card{padding:12px}
 .hd2 .deliverytop{flex-wrap:wrap}
 .hd2 .seg{flex-wrap:wrap}
}
`;
    function Studio(){
      const [state,setState]=useState(()=>({...getState()}));
      const [lists,setLists]=useState(()=>({...catalogs}));
      const [settings,setSettings]=useState(null);
      const [config,setConfig]=useState({baseUrl:'https://api.openai.com/v1/',model:'gpt-image-2',key:''});
      const [settingsOpen,setSettingsOpen]=useState(false);
      const [loading,setLoading]=useState(false);
      const [notice,setNotice]=useState('');
      const [viewer,setViewer]=useState(null);
      const [picker,setPicker]=useState(null);
      const uploadRef=useRef(null);
      const isAlive=useRef(true);
      useEffect(()=>{
        isAlive.current=true;
        const fn=value=>{if(isAlive.current)setState({...value});};
        subscribers.add(fn);hydrate().catch(()=>{});
        const controller=new AbortController();
        Object.keys(classNames).forEach(kind=>{
          if(catalogs[kind])return;
          request('catalog?kind='+kind,undefined,controller.signal).then(rows=>{
            catalogs[kind]=rows;if(isAlive.current)setLists(p=>({...p,[kind]:rows}));
          }).catch(error=>{if(!controller.signal.aborted&&isAlive.current)setNotice('画廊读取失败：'+error.message);});
        });
        request('settings',undefined,controller.signal).then(s=>{
          if(!isAlive.current)return;setSettings(s);setConfig({baseUrl:s.baseUrl,model:s.model,key:''});
        }).catch(e=>{if(!controller.signal.aborted&&isAlive.current)setNotice('接口配置读取失败：'+e.message);});
        return()=>{isAlive.current=false;subscribers.delete(fn);controller.abort();flushWrite();};
      },[]);
      useEffect(()=>{
        if(!viewer)return;
        const key=e=>{if(e.key==='Escape')setViewer(null);};
        window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
      },[viewer]);
      const page=state.pages[state.active]||state.pages[0];
      const setUI=patch=>update(s=>({...s,...patch}));
      const edit=patch=>{const locks=['style','style2','layout','color','tone','mode','ratio','whitespace','layoutVariant'];
        const touched=Object.keys(patch).filter(key=>locks.includes(key));
        setPage(page.id,{...patch,lockedFields:[...new Set([...(page.lockedFields||[]),...touched])],prompt:''});};
      const openGallery=kind=>setUI({section:'gallery',galleryKind:kind,search:'',galleryGroup:'all'});
      const openPicker=target=>setPicker({target,kind:target==='style2'?'style':target,selected:page[target]||'',search:'',group:'all',density:'standard'});
      const go=s=>setUI({section:s});
      const call=async fn=>{setNotice('');setLoading(true);try{await fn();}catch(error){if(isAlive.current)setNotice(error.message);}finally{if(isAlive.current)setLoading(false);}};
      const download=(url,name)=>{
        const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
      };
      const copy=()=>{
        if(!page.prompt){setNotice('请先生成提示词。');return;}
        navigator.clipboard.writeText(page.prompt).then(()=>setNotice('提示词已复制到剪贴板。')).catch(()=>setNotice('复制失败，请手动选择提示词文本。'));
      };
      const pickerLabel=target=>target==='style'&&page.fusion?'角色／主体画风':selectedLabels[target];
      const commitPicker=()=>{if(!picker)return;edit({[picker.target]:picker.selected});setNotice(picker.selected?`已选用 ${pickerLabel(picker.target)}：${picker.selected}`:`已清除${pickerLabel(picker.target)}`);setPicker(null);};
      const copyImage=async()=>{if(!page.image)return;try{if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw new Error('不支持图片剪贴板');const blob=await(await fetch(page.image)).blob();await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);setNotice('图片已复制，可粘贴到支持图片的应用。');}catch{setNotice('当前浏览器不支持复制图片，请使用「保存 PNG」。');}};
      const pickPreview=(target)=>{
        const kind=target==='style2'?'style':target;
        const item=(lists[kind]||[]).find(row=>row.id===page[target]);
        return el('div',{className:'stack'},
          btn(el('span',{className:'pickcontent'},
              el('span',{className:'pickimg'},item?el('img',{src:thumb(kind,item),alt:item.name}):'+'),
              el('span',{className:'pickmeta'},el('strong',null,pickerLabel(target)),el('span',null,item?`${item.id} · ${item.name}`:'点击弹窗选择'))),
            ()=>openPicker(target),{className:'pick',title:'选择'+pickerLabel(target)}),
          item&&btn('取消此项',()=>edit({[target]:''}),{className:'clear'}));
      };
      const uploadFile=file=>call(async()=>{
        if(!file)return;
        if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw new Error('请上传不超过 8 MB 的 PNG、JPG 或 WebP 图片。');
        const value=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});
        edit({upload:value});setNotice('已加入主体参考图，生成时将尽量保留主体特征。');
      });
      const preview=()=>call(async()=>{
        const p=getState().pages.find(x=>x.id===page.id);if(!p)return;
        if(p.customRatio!==undefined&&!validRatio(p.customRatio))throw new Error('自定义画幅应为正数比例，例如 7:10 或 2.35:1。');
        const design=pageDesign(p),signature=JSON.stringify({design,aiAssist:p.aiAssist===true});
        const response=await request('prompt',{design,aiAssist:p.aiAssist===true});
        const newest=getState().pages.find(x=>x.id===p.id);
        if(!newest||JSON.stringify({design:pageDesign(newest),aiAssist:newest.aiAssist===true})!==signature){setNotice('参数在生成提示词时发生了变化，请重新生成。');return;}
        const selected={};for(const key of ['style','style2','layout','color','tone','mode','ratio','whitespace','layoutVariant'])if(!(newest.lockedFields||[]).includes(key)&&response.design?.[key]!==undefined)selected[key]=response.design[key];
        setPage(p.id,{...selected,prompt:response.prompt,output:'prompt',status:'prompt',error:''},true);
      });
      const createImage=()=>call(()=>generate({...getState().pages.find(x=>x.id===page.id)}));
      const status=page.status==='generating'?'正在生图（切换面板不会取消）':page.status==='interrupted'?'上次生成已中断':page.status==='error'?'上次生成失败':page.image?'已保存成图':'未生成图片';
      const choosePage=index=>setUI({active:index});
      const addPage=()=>{if(state.pages.length>=24){setNotice('最多保留 24 页。');return;}update(s=>({...s,pages:[...s.pages,freshPage()],active:s.pages.length,section:'compose'}));};
      const duplicate=()=>{if(state.pages.length>=24)return;update(s=>{const source=s.pages[s.active];return {...s,pages:[...s.pages,{...source,id:uid(),image:'',prompt:'',status:'',error:''}],active:s.pages.length};});};
      const removePage=()=>{
        if(page.status==='generating'){setNotice('当前页正在生图，完成后再删除。');return;}
        update(s=>s.pages.length===1?{...s,pages:[freshPage()],active:0}:{...s,pages:s.pages.filter(p=>p.id!==page.id),active:Math.max(0,Math.min(s.active,s.pages.length-2))});
      };
      const pageRail=el('aside',{className:'card rail sticky'},
        el('div',{className:'minihead'},el('h2',null,'作品页面'),btn('＋ 新建',addPage,{className:'button small soft'})),
        el('div',{className:'pages'},state.pages.map((p,i)=>btn(
          el('span',{className:'pagecontents'},
            el('span',{className:'page-no'},String(i+1).padStart(2,'0')),
            el('span',{className:'name'},p.theme.trim().slice(0,16)||'未命名创作',el('span',{className:'status'},p.image?'已有成图':p.prompt?'已有提示词':p.status==='generating'?'生成中':'待创作'))),
          ()=>choosePage(i),{key:p.id,className:'page'+(i===state.active?' selected':'')}))),
        el('div',{className:'row'},btn('复制当前页',duplicate,{className:'button small'}),btn('删除',removePage,{className:'button small danger'})),
        el('div',{className:'divider'}),
        el('small',null,storageError||'自动保存已启用：参数保存在浏览器本地，图片写入 IndexedDB。'),
        el('small',null,'在左侧切换其他 DSH 插件后，回来仍可接着编辑。'));
      const editor=el('section',{className:'card form'},
        el('div',{className:'sectiontitle'},el('h2',null,'创作设置'),el('span',{className:'muted'},'01 / 定义画面')),
        el('label',{className:'field'},el('span',null,'画面主题'),el('textarea',{className:'theme',value:page.theme,placeholder:'描述你真正想画的内容。例如：雨天车站，一只橘猫等待末班电车，画面温暖又安静……',onChange:e=>edit({theme:e.target.value})})),
        el('label',{className:'field'},el('span',null,'画面文案（图文模式）'),el('textarea',{className:'smalltext',value:page.copy,placeholder:'可留空，模型会根据主题设计文案',onChange:e=>edit({copy:e.target.value})})),
        el('div',{className:'split'},
          el('label',{className:'field'},el('span',null,'画面模式'),el('select',{value:page.mode,onChange:e=>edit({mode:e.target.value})},
            el('option',{value:'pure-image'},'纯图'),el('option',{value:'graphic-text'},'图文一体'))),
          el('label',{className:'field'},el('span',null,'画幅比例'),el('select',{value:page.customRatio!==undefined?'custom':ratioPresets.some(([v])=>v===page.ratio)?page.ratio:'custom',onChange:e=>edit({ratio:e.target.value==='custom'?'3:4':e.target.value,customRatio:e.target.value==='custom'?'':undefined})},
            ...ratioPresets.map(([v,t])=>el('option',{key:v,value:v},t)),el('option',{value:'custom'},'自定义比例…')))),
        (!ratioPresets.some(([v])=>v===page.ratio)||page.customRatio!==undefined)&&el('label',{className:'field'},el('span',null,'自定义比例（例如 7:10、2.35:1）'),el('input',{value:page.customRatio??page.ratio,placeholder:'7:10',onChange:e=>edit({customRatio:e.target.value,ratio:validRatio(e.target.value)?e.target.value:page.ratio})})),
        page.customRatio!==undefined&&!validRatio(page.customRatio)&&el('small',{className:'error',role:'alert'},'请填写有效比例，如 7:10。输入有效后才能生成。'),
        page.layout&&!page.layout.startsWith('EC-')&&el('small',null,'已选图型会自动启用图文一体模式，与原 Skill 的版式规则一致。'),
        page.layout?.startsWith('EC-')&&el('small',null,'电商图型使用专门规则，不拼接通用图文模式后缀。'),
        el('div',{className:'divider'}),
        el('div',{className:'sectiontitle'},el('h2',null,'视觉素材'),el('span',{className:'muted'},'弹窗选用，画廊只供浏览')),
        el('label',{className:'fusion-switch'},
          el('input',{type:'checkbox',checked:page.fusion===true,onChange:e=>edit({fusion:e.target.checked})}),
          el('span',null,el('strong',null,'风格融合'),el('small',null,page.fusion?'已启用：角色／主体画风与场景／环境画风分别选择、分别生效。':'默认使用单一画风；勾选后再分别设置角色与场景画风。'))),
        el('div',{className:'pickgrid'},...(page.fusion?['style','style2']:['style']).concat(['layout','color','tone']).map(pickPreview)),
        el('details',{className:'details'},el('summary',null,'高级组合：留白与 SC-021 类型'),el('div',{className:'inner'},
          el('label',{className:'field'},el('span',null,'留白控制'),el('select',{value:page.whitespace,onChange:e=>edit({whitespace:e.target.value})},
            ...[['none','无附加要求'],['moderate','大量留白'],['high','极简留白，仅保留必要场景']].map(([v,t])=>el('option',{key:v,value:v},t)))),
          page.layout==='SC-021'&&el('label',{className:'field'},el('span',null,'SC-021 艺术转译类型'),el('select',{value:page.layoutVariant,onChange:e=>edit({layoutVariant:Number(e.target.value)})},
            ...['跨界续绘','撕纸第二世界','越界破框','微缩浮岛','记忆图谱','悬浮落地','正负形咬合'].map((v,i)=>el('option',{value:i+1,key:i},`0${i+1} · ${v}`)))))),
        el('div',{className:'divider'}),
        el('div',{className:'sectiontitle'},el('h2',null,'主体参考图'),el('span',{className:'muted'},'可选 / 8 MB 以内')),
        el('div',{className:'filebox'},
          page.upload&&el('img',{src:page.upload,alt:'上传的主体参考图',onClick:()=>setViewer({src:page.upload,title:'上传参考图',zoom:1})}),
          el('div',{className:'text'},el('strong',null,page.upload?'主体图片已添加':'给主体一张照片，让画风更有依据'),
            el('div',{className:'row'},btn(page.upload?'替换图片':'上传图片',()=>uploadRef.current?.click(),{className:'button small'}),
              page.upload&&btn('移除',()=>edit({upload:''}),{className:'button small danger'}))),
          el('input',{type:'file',ref:uploadRef,accept:'image/png,image/jpeg,image/webp',onChange:e=>{const file=e.target.files?.[0];if(file)uploadFile(file);e.target.value='';}})),
        el('details',{className:'details'},el('summary',null,'更多提示词参数'),el('div',{className:'inner'},
          el('label',{className:'field'},el('span',null,'业务场景'),el('input',{value:page.scenario,placeholder:'公众号封面 / 旅游海报 / 社交图文',onChange:e=>edit({scenario:e.target.value})})),
          el('label',{className:'field'},el('span',null,'目标受众'),el('input',{value:page.audience,placeholder:'例如：年轻旅行者',onChange:e=>edit({audience:e.target.value})})),
          el('label',{className:'field'},el('span',null,'补充画面要求'),el('textarea',{className:'smalltext',value:page.brief,placeholder:'比如：构图居中，主体右侧留标题空间',onChange:e=>edit({brief:e.target.value})})),
          el('label',{className:'field'},el('span',null,'提示词语言'),el('select',{value:page.language,onChange:e=>edit({language:e.target.value})},
            el('option',{value:'zh'},'中文'),el('option',{value:'en'},'English'),el('option',{value:'both'},'中英双语'))),
          el('label',{className:'field'},el('span',null,'生图时画风参考图策略'),el('select',{value:page.styleReference,onChange:e=>edit({styleReference:e.target.value})},
            el('option',{value:'auto'},'自动（参考模型能力）'),el('option',{value:'always'},'始终发送参考图'),el('option',{value:'never'},'仅提示词，不发送画风图'))))));
      const delivery=el('section',{className:'card delivery sticky'},
        el('div',{className:'deliverytop'},el('div',null,el('h2',null,'选择交付方式'),el('p',{className:'note'},'同一套风格与版式，决定输出提示词还是直接生图')),
          el('span',{className:'state'},page.output==='image'?status:'可随时复制提示词')),
        el('label',{className:'ai-switch'},el('input',{type:'checkbox',checked:page.aiAssist===true,onChange:e=>edit({aiAssist:e.target.checked})}),el('span',null,el('strong',null,'AI 辅助设计（使用 DSH 默认模型）'),el('small',null,'勾选：DSH 默认模型只从原 Skill 现有画风、图型、主题色、影调和固定画幅等选项中推荐缺失参数，再由 Skill 原规则拼接最终提示词；不会改写主题、生成小作文或覆盖手选参数。不勾选：直接拼接。'))),
        el('div',{className:'seg',role:'group','aria-label':'交付方式'},
          btn('📝 生成提示词',()=>setPage(page.id,{output:'prompt'}),{className:page.output==='prompt'?'selected':''}),
          btn('✦ 直接生图',()=>setPage(page.id,{output:'image'}),{className:page.output==='image'?'selected':''})),
        page.output==='prompt'?
          el('div',{className:'stack'},
            page.prompt?el('div',{className:'promptout big'},page.prompt):el('div',{className:'resultarea'},
              el('div',{className:'resultempty'},el('div',{className:'illustration'},'✎'),el('strong',null,'拼好视觉语言，再送去生图'),el('span',null,'在创作设置中打开弹窗挑选画风、图型和配色；点击下方按钮得到完整可复制的提示词。未填写主题也可以先生成模板。'))),
            el('div',{className:'actionrow'},btn(loading?'正在拼接…':'生成完整提示词',preview,{className:'button primary',disabled:loading}),
              page.prompt&&btn('复制提示词',copy,{className:'button soft'})),
            page.prompt&&el('small',null,page.aiAssist?'DSH 只负责选择有效参数，提示词由原 Skill 拼接器生成。':'提示词直接来自仓库原始元数据和图型模板。')):
          el('div',{className:'stack'},
            page.image?el('div',{className:'resultarea'},el('img',{src:page.image,alt:'完整生成结果',title:'点击查看完整图片',onClick:()=>setViewer({src:page.image,title:'生成结果',zoom:1})})):
              el('div',{className:'resultarea'},el('div',{className:'resultempty'},el('div',{className:'illustration'},'▧'),el('strong',null,page.status==='generating'?'正在生成图片…':'这里显示完整的成图'),
                el('span',null,'预览不会裁切图片。生成后点击放大查看，或者保存原始 PNG。'))),
            page.error&&el('p',{className:'error',role:'alert'},page.error),
            el('div',{className:'actionrow'},btn(job.controller?'生成中…':'直接生成图片',createImage,{className:'button primary',disabled:loading||Boolean(job.controller)||!page.theme.trim()||(page.customRatio!==undefined&&!validRatio(page.customRatio))}),
              page.image&&btn('复制图片',copyImage,{className:'button soft'}),
              page.image&&btn('保存 PNG',()=>download(page.image,'handraw-'+page.id+'.png'),{className:'button soft'})),
            page.savedPath&&el('div',{className:'hostpath'},el('strong',null,'图片已保存在 DSH Host（绝对路径）'),el('code',null,page.savedPath),btn('复制路径',()=>navigator.clipboard.writeText(page.savedPath).then(()=>setNotice('保存路径已复制。')).catch(()=>setNotice('无法复制，请手动选中路径。')),{className:'button small'}),el('small',null,'此路径是 DSH Host 保存的位置，不是浏览器下载文件夹。')),
            el('small',null,settings?.configured?'已配置生图接口，调用可能产生服务费用。':'需要先在右上角配置兼容 GPT Image 的图像接口。'),
            sizeFor(page)!==(page.ratio==='1:1'?'1024x1024':page.ratio==='3:2'?'1536x1024':page.ratio==='2:3'?'1024x1536':'')&&el('small',null,`所选 ${page.ratio} 会写入提示词。图像接口仅支持 1024×1024、1024×1536、1536×1024，实际调用将使用最接近的横/竖尺寸。`),
            page.prompt&&el('details',{className:'details'},el('summary',null,'查看最终生图提示词'),el('div',{className:'promptout'},page.prompt),btn('复制',copy,{className:'button small'}))),
        el('small',null,'成图会同时保存到 DSH Host 的 generated 目录，并缓存到当前浏览器的 IndexedDB。图像与参考图仅在你主动生图时提交到所配置的图片接口。'));
      const list=lists[state.galleryKind]||[];
      const groupOptions=groups[state.galleryKind].length?groups[state.galleryKind]:[...new Set(list.map(item=>item.group))].map(name=>[name,name]);
      const filterText=state.search.trim().toLowerCase();
      const filtered=list.filter(item=>(state.galleryGroup==='all'||item.group===state.galleryGroup||item.id.startsWith(state.galleryGroup+'-')) &&
        (!filterText||[item.id,item.name,item.nameEn,item.author,item.group,item.prompt].filter(Boolean).join(' ').toLowerCase().includes(filterText)));
      // All matching cards are present; <img loading=lazy> avoids downloading invisible thumbnails.

      const gallery=el('div',null,
        el('div',{className:'heading'},
          el('div',null,el('div',{className:'eyebrow'},'VISUAL LIBRARY'),el('h1',null,'手绘风素材画廊'),
            el('p',null,'画廊仅供浏览、放大和查找编号。如需选用，请回创作台点击相应素材的选择框。')),
          btn('返回创作台',()=>go('compose'),{className:'button primary'})),
        el('div',{className:'row',style:{marginBottom:'16px'}},
          ...Object.keys(classNames).map(kind=>btn(`${classNames[kind]} · ${lists[kind]?.length??'…'}`,
            ()=>setUI({galleryKind:kind,galleryGroup:'all',search:''}),
            {key:kind,className:'button'+(state.galleryKind===kind?' soft':'')}))),

        el('div',{className:'gallery-shell'},
          el('nav',{className:'gfilters','aria-label':'画廊分类标签'},
            btn('全部素材',()=>setUI({galleryGroup:'all'}),{className:'gfilter'+(state.galleryGroup==='all'?' selected':'')}),
            ...groupOptions.map(([code,title])=>btn(el('span',null,code+' · '+title),()=>setUI({galleryGroup:code}),{
              key:code,className:'gfilter'+(state.galleryGroup===code?' selected':'')}))),
          el('section',{className:'gallerycontent'},
            el('div',{className:'gallerybar'},
              el('div',{className:'row'},el('strong',null,`共 ${filtered.length} 项`),el('span',{className:'muted'},'仅浏览，不会改动当前创作选项')),
              el('div',{className:'row'},el('input',{type:'text',value:state.search,placeholder:'搜索编号、名称、视觉特征',onChange:e=>setUI({search:e.target.value})}),
                btn('小图',()=>setUI({density:'dense'}),{className:'button small'+(state.density==='dense'?' soft':'')}),
                btn('标准',()=>setUI({density:'medium'}),{className:'button small'+(state.density==='medium'?' soft':'')}),
                btn('大图',()=>setUI({density:'large'}),{className:'button small'+(state.density==='large'?' soft':'')}))),
            el('div',{className:'assetgrid'+(state.density==='medium'?'':state.density==='dense'?' dense':' large')},
              ...filtered.map(item=>el('article',{className:'assetcard',key:item.id},
                btn(el('div',null,el('div',{className:'asset-visual'},el('img',{src:thumb(state.galleryKind,item),loading:'lazy',alt:`${item.id} ${item.name}`})),
                  el('div',{className:'asset-info'},el('strong',null,item.id),el('span',null,item.name),
                    el('small',null,item.author||item.nameEn||item.group))),
                  ()=>setViewer({src:thumb(state.galleryKind,item),title:`${item.id} · ${item.name}`,zoom:1}),{className:'select',title:'放大浏览 '+item.name}),
                btn('查看大图',()=>setViewer({src:thumb(state.galleryKind,item),title:`${item.id} · ${item.name}`,zoom:1}),{className:'expand','aria-label':'查看完整大图 '+item.id})))),
            !list.length&&el('div',{className:'card'},'正在读取完整素材索引…'),
            list.length&&!filtered.length&&el('div',{className:'card'},'没有匹配的素材，可以尝试切换分类或清空搜索。'))));
      const compose=el('div',null,
        el('div',{className:'heading'},
          el('div',null,el('div',{className:'eyebrow'},'CREATE / 手绘风工作台'),el('h1',null,'把画风变成你的作品'),
            el('p',null,'先选画风与排版，再选择「只要提示词」或「直接出图」。两条路径共用同一份创作参数。')),
          btn('浏览素材画廊（仅查看）',()=>openGallery('style'),{className:'button soft'})),
        el('div',{className:'compose'},pageRail,editor,delivery));
      const overlay=viewer&&el('div',{className:'overlay viewer',onMouseDown:e=>{if(e.target===e.currentTarget)setViewer(null);}},
        el('div',{className:'lightbox',role:'dialog','aria-label':'图片完整预览'},
          el('div',{className:'lighttools'},el('div',null,el('strong',null,viewer.title),el('span',{style:{marginLeft:10,fontSize:'12px'}},'默认完整适应窗口，不裁剪图片')),
            el('div',{className:'row'},btn('－',()=>setViewer(v=>({...v,zoom:Math.max(1,v.zoom/1.3)})),{className:'button small',disabled:viewer.zoom<=1}),
              el('span',null,Math.round(viewer.zoom*100)+'%'),btn('＋',()=>setViewer(v=>({...v,zoom:Math.min(3,v.zoom*1.3)})),{className:'button small'}),
              btn('适应',()=>setViewer(v=>({...v,zoom:1})),{className:'button small'}),
              btn('关闭 Esc',()=>setViewer(null),{className:'button small'}))),
          el('div',{className:'lightstage'},el('img',{src:viewer.src,alt:viewer.title,style:{transform:`scale(${viewer.zoom})`}}))));
      const pickerList=picker?(lists[picker.kind]||[]):[];
      const pickerGroups=picker?(groups[picker.kind].length?groups[picker.kind]:[...new Set(pickerList.map(row=>row.group))].map(g=>[g,g])):[];
      const pickerFiltered=pickerList.filter(row=>(picker.group==='all'||row.group===picker.group||row.id.startsWith(picker.group+'-'))&&(!picker.search||[row.id,row.name,row.nameEn,row.author,row.prompt].filter(Boolean).join(' ').toLowerCase().includes(picker.search.trim().toLowerCase())));
      const pickerModal=picker&&el('div',{className:'overlay picker',onMouseDown:e=>{if(e.target===e.currentTarget)setPicker(null);}},
        el('div',{className:'pickerbox',role:'dialog','aria-modal':true,'aria-label':'选择'+pickerLabel(picker.target)},
          el('div',{className:'pickerhead'},el('div',null,el('h2',null,'选择'+pickerLabel(picker.target)),el('small',null,'单击卡片暂选，确认后回显到创作台；浏览画廊不会改变选择。')),
            btn('关闭',()=>setPicker(null),{className:'button small'})),
          el('div',{className:'pickerbody'},
            el('div',{className:'pickercontrols'},
              el('input',{value:picker.search,placeholder:'搜索编号、名称、画风特征…',autoFocus:true,onChange:e=>setPicker(v=>({...v,search:e.target.value}))}),
              btn(picker.density==='large'?'标准缩略图':'大图缩略图',()=>setPicker(v=>({...v,density:v.density==='large'?'standard':'large'})),{className:'button small'}),
              el('span',{className:'muted'},'匹配 '+pickerFiltered.length+' 项 · 全部显示')),
            el('nav',{className:'pickertabs','aria-label':'素材分类二级导航'},
              btn('全部',()=>setPicker(v=>({...v,group:'all'})),{className:'pickertab'+(picker.group==='all'?' active':''),'aria-pressed':picker.group==='all'}),
              ...pickerGroups.map(([id,title])=>btn(id+' · '+title,()=>setPicker(v=>({...v,group:id})),{key:id,className:'pickertab'+(picker.group===id?' active':''),'aria-pressed':picker.group===id}))),
            el('div',{className:'pickergrid'+(picker.density==='large'?' large':'')},...pickerFiltered.map(item=>
              el('div',{className:'pickercard',key:item.id},
                btn(el('img',{src:thumb(picker.kind,item),loading:'lazy',alt:item.id+' '+item.name}),()=>setPicker(v=>({...v,selected:item.id})),{className:'pickercard',style:{borderColor:picker.selected===item.id?'#1e716b':'transparent',padding:0},'aria-pressed':picker.selected===item.id,title:'暂选 '+item.name}),
                el('strong',null,item.id+' · '+item.name),
                el('small',null,item.author||item.nameEn||''),
                el('div',{className:'row'},btn(picker.selected===item.id?'✓ 已暂选':'选此项',()=>setPicker(v=>({...v,selected:item.id})),{className:'button small'+(picker.selected===item.id?' soft':'')}),
                  btn('放大',()=>setViewer({src:thumb(picker.kind,item),title:item.id+' · '+item.name,zoom:1}),{className:'button small'}))))),
            !pickerList.length&&el('p',{className:'muted'},'正在读取素材…'),
            pickerList.length&&!pickerFiltered.length&&el('p',{className:'muted'},'当前标签没有匹配的素材。')),
          el('div',{className:'pickerfooter'},el('span',{className:'state'},'待确认：'+(picker.selected||'未选择')),
            el('div',{className:'row'},btn('清除',()=>setPicker(v=>({...v,selected:''})),{className:'button danger'}),btn('取消',()=>setPicker(null),{className:'button'}),btn('确认选用并返回',commitPicker,{className:'button primary'})))));
      const configModal=settingsOpen&&el('div',{className:'overlay settings',onMouseDown:e=>{if(e.target===e.currentTarget)setSettingsOpen(false);}},
        el('div',{className:'lightbox',role:'dialog','aria-label':'图像接口设置'},
          el('div',{className:'lighttools'},el('h2',null,'图像接口设置'),btn('关闭',()=>setSettingsOpen(false),{className:'button small'})),
          el('label',{className:'field'},el('span',null,'Base URL'),el('input',{value:config.baseUrl,onChange:e=>setConfig(p=>({...p,baseUrl:e.target.value})),placeholder:'https://api.openai.com/v1/'})),
          el('label',{className:'field'},el('span',null,'模型 ID'),el('input',{value:config.model,onChange:e=>setConfig(p=>({...p,model:e.target.value})),placeholder:'gpt-image-2'})),
          el('label',{className:'field'},el('span',null,settings?.configured?'新 API Key（留空保留原值）':'API Key'),el('input',{type:'password',autoComplete:'off',value:config.key,onChange:e=>setConfig(p=>({...p,key:e.target.value}))})),
          el('p',{className:'muted'},'API Key 只保存在本机 DSH Host，不会写入浏览器作品存档。提示词生成不需要 API Key。'),
          btn(loading?'正在保存…':'保存接口设置',()=>call(async()=>{
            const data=await request('settings',config);if(!isAlive.current)return;
            setSettings(data);setConfig(p=>({...p,key:''}));setSettingsOpen(false);setNotice('接口设置已保存。');
          }),{className:'button primary',disabled:loading})));
      return el('div',{className:'hd2'},el('style',null,css),
        el('header',{className:'top'},el('div',{className:'brand'},el('div',{className:'brandmark'},'✎'),
            el('div',null,el('strong',null,'手绘风工作台'),el('small',null,'DSH 插件 · 基于 handraw-style Skill'))),
          el('nav',{className:'nav','aria-label':'功能导航'},...[
            ['compose','创作台'],['gallery','素材画廊（浏览）']].map(([section,label])=>btn(label,()=>go(section),{key:section,className:state.section===section?'active':''}))),
          el('div',{className:'topright'},el('a',{className:'repo-link',href:'https://github.com/yang0/handraw-style',target:'_blank',rel:'noopener noreferrer',title:'打开 handraw-style 项目仓库'},'github.com/yang0/handraw-style'),el('span',{className:'muted'},settings?.configured?'● 生图接口已就绪':'○ 提示词功能可直接使用'),
            btn('接口设置',()=>setSettingsOpen(true),{className:'button small'}))),
        el('main',{className:'main'},state.section==='gallery'?gallery:compose,
          notice&&el('div',{className:'toast',role:'status'},notice)),pickerModal,overlay,configModal);
    }
    function apply(ctx){
      ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:panel},Studio));
      ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register(
        {name:'sidebar.panellist',id:panel,order:70,label:()=> '手绘风工作台'},
        ({size=20})=>h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,'aria-hidden':true},
          h('path',{d:'m3 16 4 4 13-13-4-4L3 16Z'}),h('path',{d:'m13 6 4 4'}))));
    }
    return {name:panel,inject:['slots'],apply};
  },
});
