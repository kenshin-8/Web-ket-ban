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
  let w=0,h=0,dpr=1,rotY=.25,rotX=-.12,zoom=1,drag=null,points=[],me=null,user=null,raf=0,selected=null,scanTimer=0,autoRotate=!reducedMotion(),searchTerm='',interestFilter='',playerNode=null,playerLat=.12,playerLon=.25;
  const remotePlayers=new Map();
  let proximityNotice=null,nearbyMemberId=null,proximityRefreshAt=0;
  let planetDmChannel=null,planetDmPeer=null,planetDmIds=new Set(),planetChatPanel=null,planetChatMessages=null,planetChatForm=null,planetChatInput=null,planetChatStatus=null;
  let planetChannel=null,presenceHeartbeat=null,presenceWriteTimer=null,presenceWriteBusy=false,presenceWritePending=false;
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
  const normalizeLongitude=value=>{const circle=Math.PI*2;return ((value+Math.PI)%circle+circle)%circle-Math.PI;};
  function updateWalkStatus(message){const el=document.getElementById('planetWalkStatus');if(el)el.textContent=message;}
  function findProfilePoint(userId){return points.find(point=>point.profile.id===userId)||null;}
  function removeRemotePlayer(userId){const remote=remotePlayers.get(userId);if(remote?.node)remote.node.remove();remotePlayers.delete(userId);if(nearbyMemberId===userId){nearbyMemberId=null;hideProximityNotice();}}
  function hideProximityNotice(){if(proximityNotice)proximityNotice.hidden=true;}
  function ensureProximityNotice(){
    if(proximityNotice)return proximityNotice;
    proximityNotice=document.createElement('aside');proximityNotice.className='planet-proximity-notice glass-panel';proximityNotice.hidden=true;proximityNotice.setAttribute('aria-live','polite');
    const copy=document.createElement('div');copy.className='planet-proximity-copy';
    const title=document.createElement('strong');title.textContent='✦ Có thành viên ở gần bạn';
    const detail=document.createElement('span');detail.className='planet-proximity-detail';detail.textContent='Một avatar vừa bước vào vùng lân cận.';
    copy.append(title,detail);
    const actions=document.createElement('div');actions.className='planet-proximity-actions';
    const view=document.createElement('button');view.type='button';view.className='planet-proximity-view';view.textContent='Gặp gỡ';
    view.addEventListener('click',()=>{const point=findProfilePoint(nearbyMemberId);if(point)selectMember(point);});
    const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='planet-proximity-dismiss';dismiss.textContent='Để sau';dismiss.addEventListener('click',hideProximityNotice);
    actions.append(view,dismiss);proximityNotice.append(copy,actions);
    const stage=wrap.closest('.planet3d-stage')||wrap.parentElement;stage.appendChild(proximityNotice);return proximityNotice;
  }
  function angularDistance(lat1,lon1,lat2,lon2){
    const dLat=lat2-lat1,dLon=normalizeLongitude(lon2-lon1);
    const a=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
    return 2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));
  }
  function updateNearbyMember(){
    if(!user)return;
    const now=Date.now();if(now-proximityRefreshAt<450)return;proximityRefreshAt=now;
    let nearest=null,nearestDistance=Infinity;
    for(const [id,remote] of remotePlayers){
      if(now-remote.updatedAt>90000||remote.profilePoint.filtered)continue;
      const distance=angularDistance(playerLat,playerLon,remote.latitude,remote.longitude);
      if(distance<nearestDistance){nearestDistance=distance;nearest={id,remote};}
    }
    const notice=ensureProximityNotice();
    if(!nearest||nearestDistance>.24){nearbyMemberId=null;notice.hidden=true;return;}
    nearbyMemberId=nearest.id;notice.hidden=false;
    const name=nearest.remote.profilePoint.profile.display_name||'Thành viên Connect';
    const distance=Math.max(1,Math.round(nearestDistance*180/Math.PI));
    notice.querySelector('.planet-proximity-detail').textContent=`${name} đang ở gần bạn · cách khoảng ${distance}° trên bề mặt tinh cầu`;
  }
  async function sendPlanetFriendRequest(profile,button){
    if(!user||!profile?.id||profile.id===user.id)return;
    button.disabled=true;button.textContent='Đang gửi…';
    try{
      const {data:rows,error:readError}=await supabase.from('friend_requests').select('id,requester_id,recipient_id,status').or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`);
      if(readError)throw readError;
      const previous=(rows||[]).find(row=>(row.requester_id===user.id&&row.recipient_id===profile.id)||(row.requester_id===profile.id&&row.recipient_id===user.id));
      if(previous?.status==='accepted'){button.textContent='✓ Đã là bạn bè';return;}
      if(previous?.status==='pending'){button.textContent=previous.requester_id===user.id?'Đã gửi lời mời':'Có lời mời đang chờ';return;}
      if(previous?.status==='declined'){
        const {error}=await supabase.from('friend_requests').delete().eq('id',previous.id);if(error)throw error;
      }
      const {error}=await supabase.from('friend_requests').insert({requester_id:user.id,recipient_id:profile.id,status:'pending'});
      if(error)throw error;button.textContent='✓ Đã gửi lời mời';
    }catch(error){console.warn('Planet friend request:',error);button.textContent=error.code==='23505'?'Đã có lời mời':'Thử lại';button.title=error.message||'Không gửi được lời mời';button.disabled=false;}
  }
  function upsertRemotePlayer(row){
    if(!row?.user_id||row.user_id===user?.id)return;
    const profilePoint=findProfilePoint(row.user_id);
    if(!profilePoint)return;
    const updated=Date.parse(row.updated_at||'');
    if(!Number.isFinite(updated)||Date.now()-updated>90000){removeRemotePlayer(row.user_id);return;}
    let remote=remotePlayers.get(row.user_id);
    if(!remote){
      const node=document.createElement('button');node.type='button';node.className='planet3d-player-node planet3d-remote-player-node';
      node.setAttribute('aria-label',`Xem hồ sơ ${profilePoint.profile.display_name||'thành viên'}`);
      const avatar=document.createElement('div');avatar.className='planet3d-player-avatar';
      if(profilePoint.profile.avatar_data)avatar.appendChild(createAvatarSvg(profilePoint.profile.avatar_data,`Avatar của ${profilePoint.profile.display_name||'thành viên'}`));
      else{const fallback=document.createElement('span');fallback.textContent=(profilePoint.profile.display_name||'C').trim().charAt(0).toLocaleUpperCase('vi-VN');avatar.appendChild(fallback);}
      const label=document.createElement('strong');label.className='planet3d-player-label';label.textContent=profilePoint.profile.display_name||'Thành viên';
      node.append(avatar,label);node.addEventListener('click',()=>selectMember(profilePoint));layer.appendChild(node);
      remote={node,profilePoint};remotePlayers.set(row.user_id,remote);
    }
    remote.latitude=Number(row.latitude);remote.longitude=Number(row.longitude);remote.updatedAt=updated;
    if(!Number.isFinite(remote.latitude)||!Number.isFinite(remote.longitude)){removeRemotePlayer(row.user_id);return;}
  }
  function renderRemotePlayers(){
    const now=Date.now();
    for(const [id,remote] of remotePlayers){
      if(now-remote.updatedAt>90000){removeRemotePlayer(id);continue;}
      const lat=remote.latitude,lon=remote.longitude;
      const point=project({x:Math.cos(lat)*Math.sin(lon),y:Math.sin(lat),z:Math.cos(lat)*Math.cos(lon)});
      const visible=point.z>-.48&&!remote.profilePoint.filtered;remote.node.hidden=!visible;
      if(visible){const size=49*(.78+Math.max(0,point.z)*.22);remote.node.style.width=`${size}px`;remote.node.style.height=`${size}px`;remote.node.style.left=`${point.x}px`;remote.node.style.top=`${point.y}px`;remote.node.style.zIndex=String(180+Math.round((point.z+1)*20));}
    }
  }
  async function writePlanetPresence(){
    if(!user)return;
    if(presenceWriteBusy){presenceWritePending=true;return;}
    presenceWriteBusy=true;
    try{
      const {error}=await supabase.from('planet_presence').upsert({user_id:user.id,latitude:playerLat,longitude:playerLon,updated_at:new Date().toISOString()},{onConflict:'user_id'});
      if(error){console.warn('Planet presence write:',error.message);updateWalkStatus('Chưa đồng bộ được vị trí · kiểm tra migration 016_planet_presence.sql');}
      else updateWalkStatus(`Bạn đang hiện diện cùng ${remotePlayers.size} thành viên · WASD để di chuyển`);
    }catch(error){console.warn('Planet presence unavailable:',error);updateWalkStatus('Không thể kết nối đồng bộ vị trí.');}
    finally{presenceWriteBusy=false;if(presenceWritePending){presenceWritePending=false;setTimeout(writePlanetPresence,80);}}
  }
  function schedulePresenceWrite(){
    if(!user)return;
    clearTimeout(presenceWriteTimer);
    presenceWriteTimer=setTimeout(writePlanetPresence,350);
  }
  async function initPlanetPresence(){
    if(!user)return;
    const {data,error}=await supabase.from('planet_presence').select('user_id,latitude,longitude,updated_at');
    if(error){console.warn('Planet presence load:',error.message);updateWalkStatus('Đang ở chế độ cá nhân · chạy migration 016_planet_presence.sql để thấy thành viên khác');}
    else (data||[]).forEach(upsertRemotePlayer);
    planetChannel=supabase.channel('connect-planet-presence',{config:{broadcast:{self:false},presence:{key:user.id}}});
    planetChannel.on('postgres_changes',{event:'*',schema:'public',table:'planet_presence'},payload=>{
      if(payload.eventType==='DELETE')removeRemotePlayer(payload.old?.user_id);
      else upsertRemotePlayer(payload.new);
    }).subscribe(channelStatus=>{
      if(channelStatus==='CHANNEL_ERROR'||channelStatus==='TIMED_OUT'){
        updateWalkStatus('Đồng bộ nhiều người chưa sẵn sàng · kiểm tra Supabase Realtime');
      }
    });
    // Vẫn lưu heartbeat nếu Realtime đang tạm lỗi; giao diện sẽ tự cập nhật khi kết nối lại.
    void writePlanetPresence();
    if(presenceHeartbeat)clearInterval(presenceHeartbeat);
    presenceHeartbeat=setInterval(writePlanetPresence,30000);
  }
  function setupPlayerAvatar(){
    const walkStatus=document.getElementById('planetWalkStatus');
    if(!user){if(walkStatus)walkStatus.textContent='Đăng nhập để xuất hiện trên tinh cầu';return;}
    if(!playerNode){
      playerNode=document.createElement('div');playerNode.className='planet3d-player-node';playerNode.setAttribute('role','img');playerNode.setAttribute('aria-label','Avatar của bạn trên tinh cầu');
      const avatar=document.createElement('div');avatar.className='planet3d-player-avatar';
      if(me?.avatar_data)avatar.appendChild(createAvatarSvg(me.avatar_data,'Avatar của bạn'));
      else {const fallback=document.createElement('span');fallback.textContent=(me?.display_name||'Bạn').trim().charAt(0).toLocaleUpperCase('vi-VN');avatar.appendChild(fallback);}
      const tag=document.createElement('strong');tag.className='planet3d-player-label';tag.textContent=me?.display_name||'Bạn';
      playerNode.append(avatar,tag);layer.appendChild(playerNode);
    }
    if(walkStatus)walkStatus.textContent='Avatar của bạn đã xuất hiện · WASD / phím mũi tên để di chuyển';
  }
  function movePlayer(direction){
    if(!user){const walkStatus=document.getElementById('planetWalkStatus');if(walkStatus)walkStatus.textContent='Hãy đăng nhập để di chuyển Avatar';return;}
    const step=.105;
    if(direction==='up')playerLat=Math.min(1.12,playerLat+step);
    if(direction==='down')playerLat=Math.max(-1.12,playerLat-step);
    if(direction==='left')playerLon=normalizeLongitude(playerLon-step);
    if(direction==='right')playerLon=normalizeLongitude(playerLon+step);
    if(playerNode)playerNode.classList.remove('is-moving');
    if(playerNode){void playerNode.offsetWidth;playerNode.classList.add('is-moving');}
    autoRotate=false;
    // Stop the WebGL globe too; otherwise it keeps rotating beneath the moving avatar.
    wrap.dispatchEvent(new CustomEvent('connect:planet-auto-rotate',{detail:{enabled:false}}));
    if(rotateToggle){rotateToggle.setAttribute('aria-pressed','false');rotateToggle.textContent='▶ Tiếp tục xoay';}
    schedulePresenceWrite();
  }
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
    if(playerNode&&user){const playerPosition={x:Math.cos(playerLat)*Math.sin(playerLon),y:Math.sin(playerLat),z:Math.cos(playerLat)*Math.cos(playerLon)};const playerPoint=project(playerPosition);const playerVisible=playerPoint.z>-.48;playerNode.hidden=!playerVisible;if(playerVisible){const playerSize=56*(.78+Math.max(0,playerPoint.z)*.22);playerNode.style.width=`${playerSize}px`;playerNode.style.height=`${playerSize}px`;playerNode.style.left=`${playerPoint.x}px`;playerNode.style.top=`${playerPoint.y}px`;playerNode.style.zIndex=String(220+Math.round((playerPoint.z+1)*20));}}
    renderRemotePlayers();
    updateNearbyMember();
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
    // WebGL owns rotation when available and publishes its exact transform each frame.
    // Keep this Canvas-only rotation as a fallback when WebGL/CDN is unavailable.
    if(autoRotate&&!reduced&&!drag&&!document.hidden&&!wrap.classList.contains('has-webgl'))rotY+=.0017;
    if(!document.hidden)raf=requestAnimationFrame(draw);
  }
  function ensurePlanetChatPanel(){
    if(planetChatPanel)return planetChatPanel;
    planetChatPanel=document.createElement('section');planetChatPanel.className='planet3d-chat-panel';planetChatPanel.hidden=true;planetChatPanel.setAttribute('aria-label','Trò chuyện riêng');
    const heading=document.createElement('div');heading.className='planet3d-chat-heading';
    const title=document.createElement('strong');title.textContent='Trò chuyện riêng';
    const close=document.createElement('button');close.type='button';close.className='planet3d-chat-close';close.textContent='Thu gọn';close.addEventListener('click',()=>{planetChatPanel.hidden=true;});heading.append(title,close);
    planetChatMessages=document.createElement('div');planetChatMessages.className='planet3d-chat-messages';planetChatMessages.setAttribute('role','log');planetChatMessages.setAttribute('aria-live','polite');
    planetChatStatus=document.createElement('p');planetChatStatus.className='planet3d-chat-status';planetChatStatus.textContent='Tin nhắn riêng tư chỉ dành cho bạn bè đã xác nhận.';
    planetChatForm=document.createElement('form');planetChatForm.className='planet3d-chat-form';
    planetChatInput=document.createElement('input');planetChatInput.type='text';planetChatInput.maxLength=2000;planetChatInput.placeholder='Viết lời nhắn…';planetChatInput.setAttribute('aria-label','Nội dung tin nhắn');
    const send=document.createElement('button');send.type='submit';send.textContent='Gửi';planetChatForm.append(planetChatInput,send);
    planetChatForm.addEventListener('submit',sendPlanetDirectMessage);
    planetChatPanel.append(heading,planetChatMessages,planetChatStatus,planetChatForm);card.appendChild(planetChatPanel);return planetChatPanel;
  }
  function appendPlanetMessage(message){
    if(!message?.id||planetDmIds.has(message.id))return;planetDmIds.add(message.id);
    const empty=planetChatMessages.querySelector('.planet3d-chat-empty');if(empty)empty.remove();
    const item=document.createElement('div');item.className=`planet3d-chat-message${message.sender_id===user.id?' is-mine':''}`;
    const body=document.createElement('p');body.textContent=message.body;
    const time=document.createElement('time');const date=new Date(message.created_at);time.dateTime=date.toISOString();time.textContent=date.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
    item.append(body,time);planetChatMessages.appendChild(item);planetChatMessages.scrollTop=planetChatMessages.scrollHeight;
  }
  async function openPlanetConversation(profile){
    if(!user||!profile?.id||profile.id===user.id)return;
    const panel=ensurePlanetChatPanel();panel.hidden=false;planetDmPeer=null;planetChatStatus.textContent='Đang kiểm tra kết nối…';planetChatMessages.replaceChildren();planetDmIds=new Set();
    if(planetDmChannel){await supabase.removeChannel(planetDmChannel);planetDmChannel=null;}
    const {data:relations,error:relationError}=await supabase.from('friend_requests').select('status,requester_id,recipient_id').or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`);
    if(relationError){planetChatStatus.textContent='Không kiểm tra được trạng thái bạn bè. Vui lòng thử lại.';return;}
    const relation=(relations||[]).find(row=>(row.requester_id===user.id&&row.recipient_id===profile.id)||(row.requester_id===profile.id&&row.recipient_id===user.id));
    if(relation?.status!=='accepted'){
      planetChatStatus.textContent=relation?.status==='pending'?'Lời mời kết bạn đang chờ phản hồi.':'Hai bạn cần xác nhận kết bạn trước khi nhắn tin riêng.';
      const empty=document.createElement('p');empty.className='planet3d-chat-empty';empty.textContent='Khung chat sẽ mở sau khi hai bạn trở thành bạn bè.';planetChatMessages.appendChild(empty);planetChatForm.hidden=true;return;
    }
    planetDmPeer=profile;planetChatForm.hidden=false;planetChatStatus.textContent='Đang tải tin nhắn…';
    const {data,error}=await supabase.from('direct_messages').select('id,sender_id,recipient_id,body,created_at').or(`and(sender_id.eq.${user.id},recipient_id.eq.${profile.id}),and(sender_id.eq.${profile.id},recipient_id.eq.${user.id})`).order('created_at',{ascending:true}).limit(60);
    if(error){planetChatStatus.textContent='Không tải được tin nhắn. Hãy kiểm tra 003_friend_system.sql và quyền RLS.';console.warn('Planet direct messages:',error);return;}
    (data||[]).forEach(appendPlanetMessage);
    if(!data?.length){const empty=document.createElement('p');empty.className='planet3d-chat-empty';empty.textContent='Hãy gửi lời chào đầu tiên!';planetChatMessages.appendChild(empty);}
    planetChatStatus.textContent=`Đang trò chuyện với ${profile.display_name||'bạn bè'} · Đồng bộ realtime`;
    planetDmChannel=supabase.channel(`planet-dm-${[user.id,profile.id].sort().join('-')}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'direct_messages'},payload=>{const m=payload.new;if((m.sender_id===user.id&&m.recipient_id===profile.id)||(m.sender_id===profile.id&&m.recipient_id===user.id))appendPlanetMessage(m);}).subscribe(state=>{if(state==='CHANNEL_ERROR'||state==='TIMED_OUT')planetChatStatus.textContent='Realtime tạm gián đoạn. Bạn vẫn có thể gửi tin nhắn.';});
    planetChatInput.focus();
  }
  async function sendPlanetDirectMessage(event){
    event.preventDefault();const body=planetChatInput.value.trim();if(!body||!planetDmPeer||!user)return;
    const send=planetChatForm.querySelector('button[type="submit"]');send.disabled=true;
    const {data,error}=await supabase.from('direct_messages').insert({sender_id:user.id,recipient_id:planetDmPeer.id,body}).select('id,sender_id,recipient_id,body,created_at').single();
    send.disabled=false;if(error){planetChatStatus.textContent=`Gửi tin nhắn thất bại: ${error.message}`;console.warn('Planet send message:',error);return;}
    appendPlanetMessage(data);planetChatInput.value='';planetChatInput.focus();
  }
  async function selectMember(p){if(!p||p.filtered)return;selected=p;const profile=p.profile;card.hidden=false;cardAvatar.replaceChildren();if(profile.avatar_data)cardAvatar.appendChild(createAvatarSvg(profile.avatar_data,`Avatar của ${profile.display_name||'thành viên'}`));else{const fallback=document.createElement('span');fallback.textContent=(profile.display_name||'C').trim().charAt(0).toLocaleUpperCase('vi-VN');cardAvatar.appendChild(fallback);}cardName.textContent=profile.display_name||'Thành viên Connect';cardScore.textContent=p.score==null?'✦ Hoàn thành Soul Quiz để xem tương hợp':`✦ ${p.score}% tương hợp`;cardTags.replaceChildren();(profile.interests||[]).slice(0,4).forEach(tag=>{const el=document.createElement('span');el.textContent=tag;cardTags.appendChild(el);});cardActions.replaceChildren();if(planetDmChannel){supabase.removeChannel(planetDmChannel);planetDmChannel=null;}planetDmPeer=null;const chat=ensurePlanetChatPanel();chat.hidden=true;planetChatForm.hidden=false;if(user&&profile.id!==user.id){const common=sharedInterests(me?.interests,profile.interests);createSoulLikeButton(profile.id,p.score||0,common,cardActions);const friend=document.createElement('button');friend.type='button';friend.className='planet3d-friend-request';friend.textContent='＋ Kết bạn';friend.addEventListener('click',()=>sendPlanetFriendRequest(profile,friend));cardActions.appendChild(friend);const message=document.createElement('button');message.type='button';message.className='planet3d-message-button';message.textContent='✉ Nhắn tin';message.addEventListener('click',()=>openPlanetConversation(profile));cardActions.appendChild(message);const connect=document.createElement('a');connect.className='planet3d-connect-link';connect.href='match.html';connect.textContent='Soul Match ↗';cardActions.appendChild(connect);}else if(!user){const login=document.createElement('a');login.className='planet3d-connect-link';login.href='login.html';login.textContent='Đăng nhập để kết nối';cardActions.appendChild(login);}wrap.classList.add('has-selection');}
  async function load(){status.textContent='Đang đồng bộ hồ sơ công khai…';const {data:auth,error:authError}=await supabase.auth.getUser();if(authError)console.warn('Auth status:',authError.message);user=auth?.user||null;if(user){const seed=Array.from(user.id).reduce((value,char)=>((value*31+char.charCodeAt(0))>>>0),7);playerLat=((seed%1200)/1000)-.6;playerLon=normalizeLongitude((((seed>>>8)%6283)/1000)-Math.PI);const {data:mine}=await supabase.from('profiles').select('id,display_name,planet,soul_scores,interests,zodiac,avatar_data').eq('id',user.id).maybeSingle();me=mine;if(me)initSoulConnections(user.id,me);}
    let query=supabase.from('profiles').select('id,display_name,city,planet,soul_scores,interests,zodiac,avatar_data').eq('is_visible',true).limit(60);if(user)query=query.neq('id',user.id);const {data,error}=await query;if(error){console.error('Planet profiles:',error);status.textContent='Không thể tải hồ sơ công khai. Hãy kiểm tra chính sách RLS Supabase.';return;}const rows=data||[];points=rows.map((profile,i)=>({...randSphere(1)[0],profile,color:palette[i%palette.length],score:me?.planet&&profile.planet?compat(me,profile):null}));count.textContent=String(points.length);status.textContent=`${points.length} hồ sơ công khai trong vũ trụ Connect`;radarText.textContent=me?.planet?'Sẵn sàng quét các hồ sơ có độ tương hợp cao.':'Đăng nhập và hoàn thành Soul Quiz để cá nhân hóa Soul Match.';if(!points.length){status.textContent='Chưa có hồ sơ công khai khác để hiển thị.';radarText.textContent='Hãy hoàn thiện hồ sơ và bật Chia sẻ hồ sơ công khai trong trang Hồ sơ, hoặc mời bạn bè tham gia Connect.';}distribute();makeNodes();setupPlayerAvatar();populateInterests();applyFilters();if(user)await initPlanetPresence();}
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
  document.getElementById('planet3dCardClose')?.addEventListener('click',()=>{card.hidden=true;selected=null;connectionSvg.replaceChildren();wrap.classList.remove('has-selection');if(planetDmChannel){supabase.removeChannel(planetDmChannel);planetDmChannel=null;}if(planetChatPanel)planetChatPanel.hidden=true;});
  document.querySelectorAll('[data-player-move]').forEach(button=>button.addEventListener('click',()=>movePlayer(button.dataset.playerMove)));
  document.addEventListener('keydown',event=>{
    if(event.altKey||event.ctrlKey||event.metaKey)return;
    const target=event.target;
    if(target instanceof HTMLElement&&(/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)||target.isContentEditable))return;
    const key=event.key.toLowerCase();const direction=({arrowup:'up',w:'up',arrowdown:'down',s:'down',arrowleft:'left',a:'left',arrowright:'right',d:'right'})[key];
    if(!direction||(!wrap.matches(':hover')&&!wrap.contains(document.activeElement)))return;
    event.preventDefault();movePlayer(direction);
  });
  document.querySelectorAll('[data-planet-scan]').forEach(btn=>btn.addEventListener('click',()=>{wrap.classList.remove('is-scanning');void wrap.offsetWidth;wrap.classList.add('is-scanning');const mode=btn.dataset.planetScan;radarText.textContent=mode==='audio'?'Đang tìm thành viên có thể cùng bạn trò chuyện…':'Đang quét các hồ sơ có độ tương hợp cao…';if(mode==='audio')status.textContent='Khám phá phòng Audio Chat của Connect.';else{const ranked=[...points].filter(p=>p.score!=null).sort((a,b)=>b.score-a.score);if(ranked[0])selectMember(ranked[0]);}clearTimeout(scanTimer);scanTimer=setTimeout(()=>{wrap.classList.remove('is-scanning');radarText.textContent=mode==='audio'?'Mở Audio Chat để tham gia phòng trò chuyện theo sở thích.':(points.length?`Đã quét ${points.length} hồ sơ. Chọn Avatar để xem chi tiết.`:'Chưa có hồ sơ để quét.');},2200);}));
  window.addEventListener('pagehide',()=>{clearInterval(presenceHeartbeat);clearTimeout(presenceWriteTimer);if(planetChannel)supabase.removeChannel(planetChannel);if(planetDmChannel)supabase.removeChannel(planetDmChannel);});
  load().then(()=>{if(!document.hidden)draw();}).catch(error=>{console.error('Connect Planet init:',error);status.textContent='Có lỗi khi khởi tạo tinh cầu. Vui lòng tải lại trang.';});
}
