import { supabase } from './supabase.js';
import { compat, PLANETS } from './soul.js';
import { createAvatarSvg } from './avatar-data.js';
import { initSoulConnections, createSoulLikeButton, sharedInterests } from './soul-connection.js';

const canvas = document.getElementById('connectPlanetCanvas');
if (canvas) {
  const ctx = canvas.getContext('2d');
  const wrap = document.getElementById('planet3dWrap');
  const layer = document.getElementById('planet3dAvatarLayer');
  const status = document.getElementById('planet3dStatus');
  const count = document.getElementById('planet3dCount');
  const radarText = document.getElementById('planet3dRadarText');
  const card = document.getElementById('planet3dMemberCard');
  const cardAvatar = document.getElementById('planet3dCardAvatar');
  const cardName = document.getElementById('planet3dCardName');
  const cardScore = document.getElementById('planet3dCardScore');
  const cardTags = document.getElementById('planet3dCardTags');
  const cardActions = document.getElementById('planet3dCardActions');
  let w=0,h=0,dpr=1,rotY=.25,rotX=-.12,zoom=1,drag=null,points=[],me=null,user=null,raf=0,selected=null,scanTimer=0,autoRotate=!reducedMotion(),searchTerm='',interestFilter='';
  function reducedMotion(){return matchMedia('(prefers-reduced-motion: reduce)').matches;}
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const searchInput=document.getElementById('planet3dSearch');
  const interestSelect=document.getElementById('planet3dInterestFilter');
  const filterCount=document.getElementById('planet3dFilterCount');
  const rotateToggle=document.getElementById('planet3dRotateToggle');
  if(reduced&&rotateToggle){rotateToggle.textContent='▶ Tiếp tục xoay';rotateToggle.setAttribute('aria-pressed','false');}
  const palette=['#9d7bff','#51d9ff','#ff83d0','#ffc46b'];
  // SVG overlay giữ các đường liên kết nhìn thấy được cả khi WebGL thay Canvas 2D.
  const connectionSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  connectionSvg.classList.add('planet3d-connection-lines');
  connectionSvg.setAttribute('aria-hidden','true');
  connectionSvg.setAttribute('preserveAspectRatio','none');
  wrap.insertBefore(connectionSvg,layer);
  const randSphere=n=>Array.from({length:n},(_,i)=>{const y=1-2*(i+.5)/n,r=Math.sqrt(1-y*y),a=Math.PI*(3-Math.sqrt(5))*i;return{x:Math.cos(a)*r,y,z:Math.sin(a)*r};});
  const stars=randSphere(220);
  const svgUrl=data=>{const svg=createAvatarSvg(data,'Avatar thành viên Connect');const raw=new XMLSerializer().serializeToString(svg);return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(raw)}`;};
  function resize(){const r=wrap.getBoundingClientRect();w=r.width;h=Math.max(340,Math.min(570,w*.82));dpr=Math.min(devicePixelRatio||1,2);canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0);}
  new ResizeObserver(resize).observe(wrap);resize();
  function project(p){let x=p.x*Math.cos(rotY)-p.z*Math.sin(rotY),z=p.x*Math.sin(rotY)+p.z*Math.cos(rotY),y=p.y*Math.cos(rotX)-z*Math.sin(rotX);z=p.y*Math.sin(rotX)+z*Math.cos(rotX);const R=Math.min(w*.37,h*.39)*zoom,k=R/(1.75-z*.38);return{x:w/2+x*k,y:h/2+y*k,z,R,k};}
  function makeNodes(){layer.replaceChildren();points.forEach((p,i)=>{const node=document.createElement('button');node.type='button';node.className='planet3d-avatar-node';node.setAttribute('aria-label',`Xem hồ sơ ${p.profile.display_name||'thành viên Connect'}`);node.dataset.index=String(i);const img=document.createElement('img');img.alt='';if(p.profile.avatar_data){img.src=svgUrl(p.profile.avatar_data);}else{node.classList.add('is-fallback');node.textContent=(p.profile.display_name||'C').trim().charAt(0).toLocaleUpperCase('vi-VN');}if(p.profile.avatar_data)node.appendChild(img);const dot=document.createElement('i');dot.className='planet3d-presence-dot';dot.hidden=true;node.appendChild(dot);node.addEventListener('click',()=>selectMember(p));layer.appendChild(node);p.node=node;});}
  function draw(){ctx.clearRect(0,0,w,h);const cx=w/2,cy=h/2,R=Math.min(w*.37,h*.39)*zoom;const glow=ctx.createRadialGradient(cx,cy,8,cx,cy,R*1.9);glow.addColorStop(0,'rgba(79,105,255,.25)');glow.addColorStop(1,'rgba(25,12,68,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
    stars.forEach((p,i)=>{const q=project(p);ctx.globalAlpha=.18+(i%5)*.09;ctx.fillStyle=i%7===0?'#6beaff':'#d9d0ff';ctx.beginPath();ctx.arc(q.x,q.y,(i%3)*.35+.45,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;
    // Quỹ đạo hologram
    for(let j=0;j<3;j++){ctx.strokeStyle=`rgba(${j===1?'70,205,255':'157,103,255'},${.24-j*.045})`;ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(cx,cy,R*(1.22+j*.12),R*(.35+j*.045),-.22+j*.2,0,Math.PI*2);ctx.stroke();}
    const sphere=ctx.createRadialGradient(cx-R*.35,cy-R*.4,R*.04,cx,cy,R);sphere.addColorStop(0,'rgba(92,126,255,.82)');sphere.addColorStop(.42,'rgba(38,58,166,.94)');sphere.addColorStop(.82,'rgba(17,24,83,.98)');sphere.addColorStop(1,'rgba(8,12,46,1)');ctx.fillStyle=sphere;ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.fill();ctx.save();ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.clip();
    // Các mảng lục địa được chiếu theo tọa độ cầu, xoay cùng tinh cầu.
    const spherePoint=(lat,lon)=>{const a=lat*Math.PI/180,b=lon*Math.PI/180;return{x:Math.cos(a)*Math.sin(b),y:Math.sin(a),z:Math.cos(a)*Math.cos(b)};};
    const landShapes=[
      [[68,-150],[58,-125],[48,-130],[38,-118],[25,-108],[18,-96],[8,-82],[18,-72],[32,-78],[42,-64],[53,-70],[62,-88]],
      [[12,-80],[4,-74],[-8,-76],[-20,-68],[-34,-62],[-52,-70],[-45,-54],[-25,-48],[-8,-60]],
      [[58,-10],[68,12],[60,42],[48,55],[38,38],[32,18],[42,-4]],
      [[35,8],[28,28],[12,42],[-5,38],[-20,30],[-34,18],[-28,4],[-8,-2],[12,8]],
      [[55,60],[66,95],[58,130],[48,150],[35,138],[22,118],[8,105],[5,82],[22,68],[38,78]],
      [[-10,112],[-18,132],[-30,150],[-42,145],[-38,120],[-24,112]],
      [[72,-45],[80,-25],[76,-5],[65,-18]]
    ];
    landShapes.forEach((shape,index)=>{
      const projected=shape.map(([lat,lon])=>project(spherePoint(lat,lon)));
      if(projected.every(point=>point.z<-.18))return;
      ctx.beginPath();projected.forEach((point,i)=>i?ctx.lineTo(point.x,point.y):ctx.moveTo(point.x,point.y));ctx.closePath();
      ctx.fillStyle=index%2?'rgba(65,190,160,.72)':'rgba(70,205,174,.78)';
      ctx.strokeStyle='rgba(128,255,232,.66)';ctx.lineWidth=1.3;ctx.shadowColor='#4cebdc';ctx.shadowBlur=9;ctx.fill();ctx.stroke();ctx.shadowBlur=0;
    });
    // Lưới kinh tuyến và vĩ tuyến phủ nhẹ trên bề mặt.
    ctx.strokeStyle='rgba(130,222,255,.19)';ctx.lineWidth=1;for(let i=-2;i<=2;i++){ctx.beginPath();ctx.ellipse(cx,cy,R*Math.max(.12,Math.cos(i*.38)),R,i*.22,0,Math.PI*2);ctx.stroke();}for(let i=-2;i<=2;i++){ctx.beginPath();ctx.ellipse(cx,cy,R,R*Math.max(.12,Math.cos(i*.38)),0,0,Math.PI*2);ctx.stroke();}
    const land=ctx.createRadialGradient(cx-R*.2,cy-R*.15,0,cx,cy,R);land.addColorStop(0,'rgba(68,174,255,.18)');land.addColorStop(1,'rgba(38,73,190,0)');ctx.fillStyle=land;ctx.fillRect(cx-R,cy-R,R*2,R*2);ctx.restore();ctx.globalAlpha=1;
    ctx.strokeStyle='rgba(103,221,255,.9)';ctx.shadowBlur=22;ctx.shadowColor='#4abfff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;
    points.forEach(p=>{const q=project(p),node=p.node;if(!node)return;const visible=q.z>-.58&&!p.filtered;node.hidden=!visible;if(!visible)return;const size=(p===selected?58:44)*(0.72+Math.max(0,q.z)*.28);node.style.width=`${size}px`;node.style.height=`${size}px`;node.style.left=`${q.x}px`;node.style.top=`${q.y}px`;node.style.zIndex=String(Math.round((q.z+1)*100));node.style.opacity=String(.55+Math.max(0,q.z)*.45);node.classList.toggle('is-selected',p===selected);});
    // Vẽ liên kết sở thích trên SVG độc lập để không bị lớp WebGL che mất.
    connectionSvg.setAttribute('viewBox',`0 0 ${Math.max(1,w)} ${Math.max(1,h)}`);
    connectionSvg.replaceChildren();
    if(selected){
      const origin=project(selected);
      points.forEach(other=>{
        if(other===selected||other.filtered||!other.node||other.node.hidden)return;
        const common=sharedInterests(selected.profile.interests,other.profile.interests);
        if(!common.length)return;
        const target=project(other);if(target.z<-.58)return;
        const glow=document.createElementNS('http://www.w3.org/2000/svg','line');
        glow.setAttribute('x1',origin.x);glow.setAttribute('y1',origin.y);glow.setAttribute('x2',target.x);glow.setAttribute('y2',target.y);
        glow.setAttribute('stroke','#42dfff');glow.setAttribute('stroke-width',String(3+Math.min(common.length,3)));glow.setAttribute('stroke-opacity','.13');glow.setAttribute('stroke-linecap','round');
        const line=document.createElementNS('http://www.w3.org/2000/svg','line');
        line.setAttribute('x1',origin.x);line.setAttribute('y1',origin.y);line.setAttribute('x2',target.x);line.setAttribute('y2',target.y);
        line.setAttribute('stroke','#8beaff');line.setAttribute('stroke-width',String(1+Math.min(common.length,3)*.45));line.setAttribute('stroke-opacity','.72');line.setAttribute('stroke-dasharray','4 7');
        connectionSvg.append(glow,line);
      });
    }
    if(autoRotate&&!reduced&&!drag&&!document.hidden)rotY+=.0017;
    if(!document.hidden)raf=requestAnimationFrame(draw);
  }
  function selectMember(p){if(!p||p.filtered)return;selected=p;const profile=p.profile;card.hidden=false;cardAvatar.replaceChildren();if(profile.avatar_data)cardAvatar.appendChild(createAvatarSvg(profile.avatar_data,`Avatar của ${profile.display_name||'thành viên'}`));else{const fallback=document.createElement('span');fallback.textContent=(profile.display_name||'C').trim().charAt(0).toLocaleUpperCase('vi-VN');cardAvatar.appendChild(fallback);}cardName.textContent=profile.display_name||'Thành viên Connect';cardScore.textContent=p.score==null?'✦ Hoàn thành Soul Quiz để xem tương hợp':`✦ ${p.score}% tương hợp`;cardTags.replaceChildren();(profile.interests||[]).slice(0,4).forEach(tag=>{const el=document.createElement('span');el.textContent=tag;cardTags.appendChild(el);});cardActions.replaceChildren();if(user&&profile.id!==user.id){const common=sharedInterests(me?.interests,profile.interests);createSoulLikeButton(profile.id,p.score||0,common,cardActions);const connect=document.createElement('a');connect.className='planet3d-connect-link';connect.href='match.html';connect.textContent='Soul Match ↗';cardActions.appendChild(connect);}else if(!user){const login=document.createElement('a');login.className='planet3d-connect-link';login.href='login.html';login.textContent='Đăng nhập để kết nối';cardActions.appendChild(login);}wrap.classList.add('has-selection');}
  async function load(){status.textContent='Đang đồng bộ hồ sơ công khai…';const {data:auth,error:authError}=await supabase.auth.getUser();if(authError)console.warn('Auth status:',authError.message);user=auth?.user||null;if(user){const {data:mine}=await supabase.from('profiles').select('id,display_name,planet,soul_scores,interests,zodiac').eq('id',user.id).maybeSingle();me=mine;if(me)initSoulConnections(user.id,me);}
    let query=supabase.from('profiles').select('id,display_name,city,planet,soul_scores,interests,zodiac,avatar_data').eq('is_visible',true).limit(60);if(user)query=query.neq('id',user.id);const {data,error}=await query;if(error){console.error('Planet profiles:',error);status.textContent='Không thể tải hồ sơ công khai. Hãy kiểm tra chính sách RLS Supabase.';return;}const rows=data||[];points=rows.map((profile,i)=>({...randSphere(1)[0],profile,color:palette[i%palette.length],score:me?.planet&&profile.planet?compat(me,profile):null}));count.textContent=String(points.length);status.textContent=`${points.length} hồ sơ công khai trong vũ trụ Connect`;radarText.textContent=me?.planet?'Sẵn sàng quét các hồ sơ có độ tương hợp cao.':'Đăng nhập và hoàn thành Soul Quiz để cá nhân hóa Soul Match.';if(!points.length){status.textContent='Chưa có hồ sơ công khai khác để hiển thị.';radarText.textContent='Hãy hoàn thiện hồ sơ và bật Chia sẻ hồ sơ công khai trong trang Hồ sơ, hoặc mời bạn bè tham gia Connect.';}distribute();makeNodes();populateInterests();applyFilters();}
  function distribute(){const vectors=randSphere(Math.max(points.length,1));points=points.map((p,i)=>({...vectors[i],...p}));}
  function normalize(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('vi-VN').trim();}
  function applyFilters(){const q=normalize(searchTerm);let shown=0;points.forEach(p=>{const profile=p.profile;const haystack=normalize([profile.display_name,profile.city,...(profile.interests||[])].join(' '));const matchesText=!q||haystack.includes(q);const matchesInterest=!interestFilter||(profile.interests||[]).some(tag=>normalize(tag)===normalize(interestFilter));p.filtered=!(matchesText&&matchesInterest);if(!p.filtered)shown++;if(p.node)p.node.hidden=p.filtered;});if(selected?.filtered){selected=null;card.hidden=true;wrap.classList.remove('has-selection');}if(filterCount)filterCount.textContent=`Đang hiển thị ${shown}/${points.length} hồ sơ`;}
  function populateInterests(){if(!interestSelect)return;const tags=[...new Set(points.flatMap(p=>p.profile.interests||[]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));tags.forEach(tag=>{const option=document.createElement('option');option.value=tag;option.textContent=tag;interestSelect.appendChild(option);});}

  wrap.addEventListener('connect:planet-transform', event => {
    if (!event.detail) return;
    rotY = Number(event.detail.rotationY) || 0;
    rotX = Number(event.detail.rotationX) || 0;
    zoom = Number(event.detail.zoom) || 1;
  });
  wrap.addEventListener('connect:planet-auto-rotate', event => {
    autoRotate = Boolean(event.detail?.enabled);
    if (rotateToggle) {
      rotateToggle.setAttribute('aria-pressed', String(autoRotate));
      rotateToggle.textContent = autoRotate ? '⏸ Tạm dừng xoay' : '▶ Tiếp tục xoay';
    }
  });
  canvas.addEventListener('pointerdown',e=>{drag={...pos(e),x0:rotY,y0:rotX,moved:false};canvas.setPointerCapture(e.pointerId);});
  function pos(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
  canvas.addEventListener('pointermove',e=>{if(!drag)return;const p=pos(e),dx=p.x-drag.x,dy=p.y-drag.y;if(Math.abs(dx)+Math.abs(dy)>3)drag.moved=true;rotY=drag.x0+dx*.008;rotX=Math.max(-1.15,Math.min(1.15,drag.y0+dy*.008));});
  canvas.addEventListener('pointerup',()=>{drag=null;});canvas.addEventListener('pointercancel',()=>{drag=null;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.72,Math.min(1.5,zoom+(e.deltaY<0?.08:-.08)));},{passive:false});
  searchInput?.addEventListener('input',()=>{searchTerm=searchInput.value;applyFilters();});
  interestSelect?.addEventListener('change',()=>{interestFilter=interestSelect.value;applyFilters();});
  rotateToggle?.addEventListener('click',()=>{autoRotate=!autoRotate;rotateToggle.setAttribute('aria-pressed',String(autoRotate));rotateToggle.textContent=autoRotate?'⏸ Tạm dừng xoay':'▶ Tiếp tục xoay';wrap.dispatchEvent(new CustomEvent('connect:planet-auto-rotate',{detail:{enabled:autoRotate}}));});
  document.getElementById('planet3dResetView')?.addEventListener('click',()=>{rotY=.25;rotX=-.12;zoom=1;autoRotate=true;wrap.dispatchEvent(new CustomEvent('connect:planet-reset'));if(rotateToggle){rotateToggle.setAttribute('aria-pressed','true');rotateToggle.textContent='⏸ Tạm dừng xoay';}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!raf)draw();else if(document.hidden&&raf){cancelAnimationFrame(raf);raf=0;}});
  document.querySelectorAll('[data-planet-zoom]').forEach(btn=>btn.addEventListener('click',()=>{const direction=btn.dataset.planetZoom;zoom=Math.max(.72,Math.min(1.5,zoom+(direction==='in'?.12:-.12)));wrap.dispatchEvent(new CustomEvent('connect:planet-zoom',{detail:{direction}}));}));
  document.getElementById('planet3dCardClose')?.addEventListener('click',()=>{card.hidden=true;selected=null;connectionSvg.replaceChildren();wrap.classList.remove('has-selection');});
  document.querySelectorAll('[data-planet-scan]').forEach(btn=>btn.addEventListener('click',()=>{wrap.classList.remove('is-scanning');void wrap.offsetWidth;wrap.classList.add('is-scanning');const mode=btn.dataset.planetScan;radarText.textContent=mode==='audio'?'Đang tìm thành viên có thể cùng bạn trò chuyện…':'Đang quét các hồ sơ có độ tương hợp cao…';if(mode==='audio')status.textContent='Khám phá phòng Audio Chat của Connect.';else{const ranked=[...points].filter(p=>p.score!=null).sort((a,b)=>b.score-a.score);if(ranked[0])selectMember(ranked[0]);}clearTimeout(scanTimer);scanTimer=setTimeout(()=>{wrap.classList.remove('is-scanning');radarText.textContent=mode==='audio'?'Mở Audio Chat để tham gia phòng trò chuyện theo sở thích.':(points.length?`Đã quét ${points.length} hồ sơ. Chọn Avatar để xem chi tiết.`:'Chưa có hồ sơ để quét.');},2200);}));
  load().then(()=>{if(!document.hidden)draw();}).catch(error=>{console.error('Connect Planet init:',error);status.textContent='Có lỗi khi khởi tạo tinh cầu. Vui lòng tải lại trang.';});
}
