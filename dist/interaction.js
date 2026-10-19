export function createInteraction() {
  const state = {x:.66,y:.72,tx:.66,ty:.72,held:false,charge:0,wind:.28,light:.58,theme:'jade',paused:false,capture:false,releaseAge:100,releasePower:0,releaseSerial:0,releaseX:0,releaseZ:-8,worldX:0,worldZ:-8};
  const cursor=document.getElementById('cursor');
  function point(e){state.tx=Math.max(.03,Math.min(.97,e.clientX/innerWidth));state.ty=Math.max(.07,Math.min(.94,e.clientY/innerHeight));cursor.style.transform=`translate(${e.clientX}px,${e.clientY}px)`;}
  function release(){if(state.held){state.releaseAge=0;state.releasePower=state.charge;state.releaseX=state.worldX;state.releaseZ=state.worldZ;state.releaseSerial++;}state.held=false;document.body.classList.remove('holding');}
  addEventListener('pointermove',e=>{if(e.target.id!=='c'&&!state.held){cursor.style.opacity='0';return;}point(e);cursor.style.opacity=e.pointerType==='mouse'?'1':'0';});
  addEventListener('pointerdown',e=>{if(e.target.id!=='c'||e.button!==0)return;point(e);state.held=true;e.target.setPointerCapture(e.pointerId);document.body.classList.add('holding');});
  addEventListener('pointerup',release);addEventListener('pointercancel',release);addEventListener('blur',release);document.addEventListener('pointerleave',()=>{cursor.style.opacity='0';release();});document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
  state.tick=dt=>{const easing=1-Math.exp(-dt*2.7);state.x+=(state.tx-state.x)*easing;state.y+=(state.ty-state.y)*easing;state.charge+=((state.held?1:0)-state.charge)*(1-Math.exp(-dt*(state.held?2.1:1.3)));state.releaseAge+=dt;const needle=document.getElementById('bearing-needle');if(needle)needle.style.transform=`rotate(${(state.x-.5)*100}deg)`;document.body.dataset.charge=state.charge.toFixed(2);document.body.dataset.lightPosition=`${state.x.toFixed(2)},${state.y.toFixed(2)}`;};
  return state;
}
export function lightRay(state,aspect,pitch=-2.2*Math.PI/180,fov=55*Math.PI/180,height=30){const cp=Math.cos(pitch),sp=Math.sin(pitch),t=Math.tan(fov/2),nx=(state.x*2-1)*t*aspect,ny=(1-Math.max(.51,state.y)*2)*t,x=nx,y=sp+ny*cp,z=-cp+ny*sp,len=Math.hypot(x,y,z);state.worldX=x*height/-y;state.worldZ=z*height/-y;return{x:x/len,y:-y/len,z:z/len};}
export function saveBlob(blob){if(!blob){document.dispatchEvent(new Event('sea-save-failed'));return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`无岸-APEIRON-${new Date().toISOString().replaceAll(':','-').slice(0,19)}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);document.dispatchEvent(new Event('sea-saved'));}
