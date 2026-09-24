import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CATS, PARTS, STEPS } from "./data.js";

const state = {cat:"cpu", selected:{}, q:"", mode:"pick", orderMode:"free", cableStyle:"managed", step:-1, current:"", installed:new Set(), log:[], cableReport:[]};
const $ = id => document.getElementById(id);
const fmtDim = p => p.dim && (p.dim.w||p.dim.h||p.dim.d) ? `尺寸 ${p.dim.w}×${p.dim.h}×${p.dim.d} mm` : "無獨立體積";
const formRank = f => ({mATX:1,ATX:2,EATX:3}[f]||2);
function partBlocked(p){
  const s=state.selected;
  if (p.cat==="cpu" && s.mobo && p.socket!==s.mobo.socket) return "插槽不符";
  if (p.cat==="mobo" && s.cpu && p.socket!==s.cpu.socket) return "插槽不符";
  if (p.cat==="ram" && s.mobo && p.type!==s.mobo.ram) return "記憶體世代不符";
  if (p.cat==="mobo" && s.case && formRank(p.form)>formRank(s.case.form)) return "板型大過機箱";
  if (p.cat==="gpu" && s.case && (p.dim?.d||p.length)>s.case.gpuMax) return "顯卡過長";
  if (p.cat==="cooler" && s.case && (p.dim?.h)>s.case.coolMax) return "散熱器超高";
  if (p.cat==="psu" && s.case && p.dim?.d>s.case.psuMax) return "電源過深";
  return null;
}
function analyze(){
  const s=state.selected, issues=[];
  if (s.cpu && s.mobo && s.cpu.socket!==s.mobo.socket) issues.push({lv:"bad",t:"插槽不相容"});
  if (s.ram && s.mobo && s.ram.type!==s.mobo.ram) issues.push({lv:"bad",t:"記憶體世代不符"});
  if (s.mobo && s.case && formRank(s.mobo.form)>formRank(s.case.form)) issues.push({lv:"bad",t:"板型大過機箱"});
  if (s.gpu && s.case && (s.gpu.dim?.d||0)>s.case.gpuMax) issues.push({lv:"bad",t:"顯卡過長"});
  if (s.cooler && s.case && s.cooler.dim.h>s.case.coolMax) issues.push({lv:"bad",t:"散熱超高"});
  if (s.psu && s.case && s.psu.dim.d>s.case.psuMax) issues.push({lv:"bad",t:"電源過深"});
  const load=(s.cpu?.tdp||0)+(s.gpu?.tdp||0)+((s.cpu||s.gpu||s.mobo)?70:0);
  if (s.psu && load>s.psu.watt) issues.push({lv:"bad",t:`負載 ${load}W 高過電源`});
  else if (s.gpu && s.psu && s.psu.watt<s.gpu.recPsu) issues.push({lv:"warn",t:`低過建議整機 ${s.gpu.recPsu}W`});
  (state.cableReport||[]).forEach(r=>issues.push({lv:r.ok?"ok":"warn",t:r.text}));
  const hardBad=issues.some(i=>i.lv==="bad");
  const complete=CATS.every(([k])=>s[k]);
  if (complete && !hardBad) issues.unshift({lv:"ok",t:"硬性相容通過（模擬）"});
  return {issues, load, price:Object.values(s).reduce((n,p)=>n+p.price,0), hardBad, complete};
}
function renderUI(){
  $("cats").innerHTML=CATS.map(([id,l])=>`<button data-id="${id}" class="${state.cat===id?"active":""}">${l}</button>`).join("");
  const q=state.q.trim().toLowerCase();
  $("parts").innerHTML=PARTS.filter(p=>p.cat===state.cat && (!q||(p.name+p.note).toLowerCase().includes(q))).map(p=>{
    const blocked=partBlocked(p), sel=state.selected[p.cat]?.id===p.id;
    return `<article class="card ${sel?"selected":""} ${blocked?"blocked":""}" data-id="${p.id}"><h3>${p.name}</h3><div class="meta">$${p.price}${blocked?" · "+blocked:""}<br>${fmtDim(p)}<br>${p.note}</div></article>`;
  }).join("");
  const a=analyze();
  $("totalPrice").textContent="$"+a.price;
  $("totalWatt").textContent=a.load+" W";
  $("psuHead").textContent=state.selected.psu&&a.load? (state.selected.psu.watt-a.load)+" W":"—";
  $("compatLabel").textContent=a.hardBad?"不相容":a.complete?"可開機（模擬）":"未完成";
  $("compatLabel").style.color=a.hardBad?"var(--bad)":a.complete?"var(--ok)":"var(--warn)";
  $("issues").innerHTML=a.issues.map(i=>`<div class="issue ${i.lv}">${i.t}</div>`).join("");
  const map={case:"prep",mobo:"bench",cpu:"cpu",ram:"ram",ssd:"ssd",psu:"psu",cooler:"cooler",gpu:"gpu"};
  $("build").innerHTML=CATS.map(([k,l])=>{
    const p=state.selected[k], sid=map[k], on=sid&&state.installed.has(sid);
    const btn=(state.mode==="asm"&&p&&sid)?`<button data-install="${sid}">${on?"卸下":"安裝"}</button>`:"";
    return `<div class="row"><div><b>${l}${on?" · 已裝":""}</b><div class="meta">${p?p.name:"未選"}</div></div><div>${p?`$${p.price} ${btn} <button data-rm="${k}">移除</button>`:""}</div></div>`;
  }).join("")+(state.mode==="asm"?`<div class="row"><div><b>入箱／接線／合蓋</b></div><div><button data-install="moboIn">主板入箱</button><button data-install="cables">接線</button><button data-install="post">合蓋 POST</button></div></div>`:"");
  $("stepsBar").innerHTML=STEPS.map((st,i)=>`<span class="${state.installed.has(st.id)?"done":state.step===i?"now":""}" data-step="${st.id}">${i+1} ${st.title.replace(/^\d+\.\s*/,"")}</span>`).join("");
  ["modeFree","modeGuide","cableManaged","cableMessy"].forEach(id=>{const el=$(id); if(el) el.classList.toggle("on",(id==="modeFree"&&state.orderMode==="free")||(id==="modeGuide"&&state.orderMode==="guide")||(id==="cableManaged"&&state.cableStyle==="managed")||(id==="cableMessy"&&state.cableStyle==="messy"));});
  const st=STEPS.find(x=>x.id===state.current)||STEPS[state.step];
  if(state.mode!=="asm"){ $("stepTitle").textContent="未開始裝機"; $("stepText").textContent="擇零件後撲開始。自由順序可撲步驟或右邊安裝。"; }
  else if(st){ $("stepTitle").textContent=st.title; $("stepText").textContent=(state.log.at(-1)||"")+st.text; }
}
const canvas=$("view3d");
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x07090e);
const camera=new THREE.PerspectiveCamera(42,1,10,4000); camera.position.set(420,280,520);
const orbit=new OrbitControls(camera,canvas); orbit.enableDamping=true; orbit.target.set(40,200,80);
scene.add(new THREE.AmbientLight(0x8896aa,0.55));
const key=new THREE.DirectionalLight(0xfff4e5,1.1); key.position.set(600,900,400); scene.add(key);
scene.add(new THREE.GridHelper(1600,16,0x243044,0x161c26));
const mat=(c,m=0.4,r=0.4)=>new THREE.MeshStandardMaterial({color:c,metalness:m,roughness:r});
function addBox(parent,w,h,d,color,x,y,z){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color)); m.position.set(x,y,z); parent.add(m); return m; }
const bench=new THREE.Mesh(new THREE.BoxGeometry(700,16,450),mat(0x3a2a1c,0.05,0.8)); bench.position.set(-420,8,-40); scene.add(bench);
const nodes={}; const group=n=>{const g=new THREE.Group(); nodes[n]=g; scene.add(g); return g;};
const wipe=g=>{while(g.children.length)g.remove(g.children[0]);};
const caseG=group("case"), psu=group("psu"), mobo=group("mobo"), cpu=group("cpu"), ram=group("ram"), ssd=group("ssd"), cooler=group("cooler"), gpu=group("gpu"), cables=group("cables");
let glass=null;
function rebuildMeshes(){
  const s=state.selected, STEEL=0.8, cs=s.case?.dim||{w:225,h:465,d:430};
  wipe(caseG); const W=cs.w,H=cs.h,D=cs.d;
  addBox(caseG,W,H,STEEL,0x2a3344,0,H/2,-D/2+STEEL/2);
  addBox(caseG,STEEL,H,D,0x2a3344,-W/2+STEEL/2,H/2,0);
  addBox(caseG,W,STEEL,D,0x1c2430,0,STEEL/2,0);
  addBox(caseG,W,STEEL,D,0x2a3344,0,H-STEEL/2,0);
  glass=new THREE.Mesh(new THREE.BoxGeometry(4,H-20,D-30), new THREE.MeshPhysicalMaterial({color:0x99c2e8,transparent:true,opacity:0.12,roughness:0.05}));
  glass.position.set(W/2,H/2,0); caseG.add(glass); caseG.position.set(80,0,0); caseG.visible=false;
  const pd=s.psu?.dim||{w:150,h:86,d:140}; wipe(psu); addBox(psu,pd.w,pd.h,pd.d,0xc9a227,0,0,0);
  psu.userData.home=new THREE.Vector3(80,pd.h/2+STEEL,D/2-pd.d/2-10);
  psu.userData.bench=new THREE.Vector3(-420,pd.h/2+16,80);
  const md=s.mobo?.dim||{w:305,h:1.6,d:244}; wipe(mobo); addBox(mobo,md.w,md.h,md.d,0x3b2460,0,0,0);
  const cd=s.cpu?.dim||{w:40,h:8,d:40}; wipe(cpu); addBox(cpu,cd.w,cd.h,cd.d,0x9db7ff,0,0,0);
  cpu.userData.offset=new THREE.Vector3(-md.w/2+80,md.h/2+cd.h/2+8,-md.d/2+70);
  const rd=s.ram?.dim||{w:7,h:35,d:135}; wipe(ram); addBox(ram,rd.w,rd.h,rd.d,0x2ec7b0,-6,0,0); addBox(ram,rd.w,rd.h,rd.d,0x2ec7b0,6,0,0);
  ram.userData.offset=new THREE.Vector3(-md.w/2+140,md.h/2+rd.h/2,-md.d/2+80);
  const sd=s.ssd?.dim||{w:22,h:2.38,d:80}; wipe(ssd); addBox(ssd,sd.w,sd.h,sd.d,0x3cb36a,0,0,0);
  ssd.userData.offset=new THREE.Vector3(-md.w/2+90,md.h/2+sd.h/2,md.d/2-50);
  const kd=s.cooler?.dim||{w:125,h:155,d:110}; wipe(cooler); addBox(cooler,kd.w,kd.h,kd.d,0x4aa8c4,0,0,0);
  cooler.userData.home=new THREE.Vector3(80-md.w/2+80,20+md.h+kd.h/2,-20);
  cooler.userData.bench=new THREE.Vector3(-420,16+kd.h/2,-40);
  const gd=s.gpu?.dim||{w:40,h:112,d:242}; wipe(gpu);
  if(gd.d){ addBox(gpu,gd.h,gd.w,gd.d,0xd45a3a,0,0,0); addBox(gpu,18,gd.w,8,0x888888,gd.h/2+4,0,-gd.d/2+4); }
  gpu.userData.home=new THREE.Vector3(80,20+md.h+(gd.w||40)/2+18,20);
  gpu.userData.bench=new THREE.Vector3(-280,16+(gd.w||40)/2,120);
  wipe(cables); cables.visible=false; layoutIdle();
}
function rebuildCables(){
  wipe(cables); state.cableReport=[];
  if(!state.installed.has("cables")&&!state.installed.has("post")) return;
  const s=state.selected, managed=state.cableStyle==="managed";
  const cs=s.case?.dim||{w:225,h:465,d:430}, md=s.mobo?.dim||{w:305,d:244}, pd=s.psu?.dim||{w:150,h:86,d:140}, gd=s.gpu?.dim||{w:40,h:112,d:242};
  const spec=s.psu?.id==="corsair-1000"?{atx:610,eps:750,gpu:650,src:"RM1000x LTT Labs"}:{atx:600,eps:650,gpu:650,src:"典型 ATX 線長"};
  const exit=new THREE.Vector3(psu.position.x,psu.position.y+8,psu.position.z-pd.d/2);
  const behindX=80-cs.w/2+12, shroudY=pd.h+18;
  const ends={atx:new THREE.Vector3(mobo.position.x+md.w/2-18,mobo.position.y+10,mobo.position.z+30),eps:new THREE.Vector3(mobo.position.x-md.w/2+36,mobo.position.y+10,mobo.position.z-md.d/2+28),gpu:new THREE.Vector3(gpu.position.x,gpu.position.y+20,gpu.position.z+(gd.d||200)/4),io:new THREE.Vector3(80,cs.h-40,cs.d/2-20)};
  const route=end=>managed?[exit.clone(), new THREE.Vector3(exit.x,shroudY,exit.z-20), new THREE.Vector3(behindX,shroudY,(exit.z+end.z)/2), new THREE.Vector3(behindX,end.y,end.z), end.clone()]:[exit.clone(), new THREE.Vector3((exit.x+end.x)/2+30,Math.min(exit.y,end.y)+80,(exit.z+end.z)/2), end.clone()];
  [["24-pin ATX",route(ends.atx),5.5,spec.atx,state.installed.has("moboIn")],["CPU EPS",route(ends.eps),4.2,spec.eps,state.installed.has("moboIn")],["GPU 供電",route(ends.gpu),4.8,spec.gpu,state.installed.has("gpu")&&s.gpu?.dim?.d],["前面板",route(ends.io),2.2,500,true]].forEach(([name,pts,r,len,need])=>{
    if(!need) return;
    const curve=new THREE.CatmullRomCurve3(pts);
    cables.add(new THREE.Mesh(new THREE.TubeGeometry(curve,48,r,7,false),mat(0x1a1a1a,0.3,0.6)));
    const path=Math.round(curve.getLength());
    state.cableReport.push({ok:path<=len,text:`${name} 路徑約 ${path}mm，資料線長 ${len}mm（${spec.src}）`});
  });
  cables.visible=true;
}
const benchMoboPos=()=>new THREE.Vector3(-420,24,-40);
const caseMoboPos=()=>{const md=state.selected.mobo?.dim||{d:244}; const cs=state.selected.case?.dim||{d:430}; return new THREE.Vector3(80,22,-cs.d/2+md.d/2+20);};
function layoutIdle(){ const bp=benchMoboPos(); mobo.position.copy(bp); cpu.position.copy(bp).add(cpu.userData.offset||new THREE.Vector3()); ram.position.copy(bp).add(ram.userData.offset||new THREE.Vector3()); ssd.position.copy(bp).add(ssd.userData.offset||new THREE.Vector3()); if(psu.userData.bench) psu.position.copy(psu.userData.bench); if(cooler.userData.bench) cooler.position.copy(cooler.userData.bench); if(gpu.userData.bench) gpu.position.copy(gpu.userData.bench); Object.values(nodes).forEach(n=>n.visible=false); }
function applyInstalled(){ const inCase=state.installed.has("moboIn"), pos=inCase?caseMoboPos():benchMoboPos(); caseG.visible=state.mode==="asm"||state.installed.has("prep"); mobo.visible=state.installed.has("bench")||inCase; cpu.visible=state.installed.has("cpu"); ram.visible=state.installed.has("ram"); ssd.visible=state.installed.has("ssd"); psu.visible=state.installed.has("psu"); cooler.visible=state.installed.has("cooler"); gpu.visible=state.installed.has("gpu") && !!(state.selected.gpu?.dim?.d); if(glass){ const W=state.selected.case?.dim?.w||225; glass.position.x=state.installed.has("post")?W/2:W/2+80; } mobo.position.copy(pos); cpu.position.copy(pos).add(cpu.userData.offset||new THREE.Vector3()); ram.position.copy(pos).add(ram.userData.offset||new THREE.Vector3()); ssd.position.copy(pos).add(ssd.userData.offset||new THREE.Vector3()); if(state.installed.has("psu")) psu.position.copy(psu.userData.home); if(state.installed.has("cooler")) cooler.position.copy(inCase?cooler.userData.home:cooler.userData.bench); if(gpu.visible) gpu.position.copy(gpu.userData.home); rebuildCables(); }
function canInstall(id){ const s=state.selected, has=x=>state.installed.has(x), st=STEPS.find(x=>x.id===id); if(st?.need && !s[st.need] && id!=="gpu") return {ok:false,msg:`未擇 ${st.need}`}; if(["cpu","ram","ssd","cooler"].includes(id)&&!s.mobo) return {ok:false,msg:"要先有主板"}; if(id==="moboIn"&&!has("prep")) return {ok:false,msg:"要先開箱"}; if(id==="psu"&&!has("prep")) return {ok:false,msg:"要先開箱"}; if(id==="gpu"&&s.gpu?.dim?.d&&!has("moboIn")) return {ok:false,msg:"獨顯要主板已入箱"}; if(id==="cables"&&!has("moboIn")&&!has("psu")) return {ok:false,msg:"未有入箱主板或電源"}; return {ok:true}; }
function installStep(id){ if(state.installed.has(id)){ state.installed.delete(id); applyInstalled(); renderUI(); return; } const chk=canInstall(id); if(!chk.ok){ state.log.push(chk.msg); state.current=id; renderUI(); return; } if(["cpu","ram","ssd","cooler","bench"].includes(id)) state.installed.add("bench"); if(["psu","moboIn","gpu"].includes(id)) state.installed.add("prep"); state.installed.add(id); state.current=id; applyInstalled(); renderUI(); }
function fit(){ const r=canvas.getBoundingClientRect(); renderer.setSize(r.width,Math.max(r.height,420),false); camera.aspect=r.width/Math.max(r.height,420); camera.updateProjectionMatrix(); }
window.addEventListener("resize",fit); new ResizeObserver(fit).observe(canvas.parentElement); fit(); rebuildMeshes();
$("cats").onclick=e=>{const b=e.target.closest("button"); if(b){state.cat=b.dataset.id; renderUI();}};
$("parts").onclick=e=>{const c=e.target.closest(".card"); if(!c)return; const p=PARTS.find(x=>x.id===c.dataset.id); const why=partBlocked(p); if(why){alert(why);return;} state.selected[p.cat]=p; rebuildMeshes(); renderUI(); applyInstalled();};
$("build").onclick=e=>{const i=e.target.closest("[data-install]"); if(i){ if(state.mode!=="asm") $("startAsm").click(); installStep(i.dataset.install); return;} const r=e.target.closest("[data-rm]"); if(r){ delete state.selected[r.dataset.rm]; rebuildMeshes(); renderUI();}};
$("stepsBar").onclick=e=>{const sp=e.target.closest("[data-step]"); if(!sp)return; if(state.mode!=="asm") $("startAsm").click(); state.current=sp.dataset.step; state.step=STEPS.findIndex(x=>x.id===sp.dataset.step); if(state.orderMode==="free") installStep(sp.dataset.step); else renderUI();};
$("modeFree").onclick=()=>{state.orderMode="free"; renderUI();};
$("modeGuide").onclick=()=>{state.orderMode="guide"; renderUI();};
$("cableManaged").onclick=()=>{state.cableStyle="managed"; applyInstalled(); renderUI();};
$("cableMessy").onclick=()=>{state.cableStyle="messy"; applyInstalled(); renderUI();};
$("q").oninput=e=>{state.q=e.target.value; renderUI();};
$("clear").onclick=()=>{state.selected={}; state.installed.clear(); rebuildMeshes(); renderUI();};
const pick=id=>PARTS.find(p=>p.id===id);
$("presetMid").onclick=()=>{state.selected={case:pick("nzxt-h5"),psu:pick("atx-psu-140"),mobo:pick("b850-tomahawk"),cpu:pick("r5-9600x"),cooler:pick("tr-pa120"),ram:pick("ddr5-32"),ssd:pick("p310-1"),gpu:pick("rx9060xt")}; rebuildMeshes(); renderUI();};
$("presetHigh").onclick=()=>{state.selected={case:pick("fractal-xl"),psu:pick("corsair-1000"),mobo:pick("x870e"),cpu:pick("r7-9800x3d"),cooler:pick("arctic-36"),ram:pick("ddr5-32"),ssd:pick("sn7100-2"),gpu:pick("rtx5080fe")}; rebuildMeshes(); renderUI();};
$("startAsm").onclick=()=>{if(!state.selected.case){alert("最少要擇機箱");return;} state.mode="asm"; state.step=0; state.current="prep"; state.installed.clear(); layoutIdle(); caseG.visible=true; renderUI();};
$("nextStep").onclick=()=>{if(state.mode!=="asm"){$("startAsm").click();return;} const next=STEPS.find(st=>!state.installed.has(st.id)); if(!next){renderUI();return;} installStep(next.id);};
$("prevStep").onclick=()=>{const done=[...state.installed]; if(!done.length){state.mode="pick"; renderUI(); return;} state.installed.delete(done.at(-1)); applyInstalled(); renderUI();};
$("resetAsm").onclick=()=>{state.mode="pick"; state.installed.clear(); layoutIdle(); renderUI();};
(function tick(){ orbit.update(); renderer.render(scene,camera); requestAnimationFrame(tick); })();
renderUI();
