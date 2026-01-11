(()=>{if(window.RouterTweaks&&window.RouterTweaks.__F670L_RUNNING)return;window.RouterTweaks=window.RouterTweaks||{};window.RouterTweaks.__F670L_RUNNING=true;

const norm=s=>(s||'').toString().replace(/\s+/g,' ').trim();
const txt=e=>norm(e&&('innerText'in e?e.innerText:e.textContent));
const num=s=>{const m=(s||'').toString().replace(',','.').match(/-?\d+(?:\.\d+)?/);return m?parseFloat(m[0]):null};
const validPon=v=>typeof v==='number'&&isFinite(v)&&v<=10&&v>=-60;

const docs=[];
const addDoc=d=>{if(!d||docs.includes(d))return;docs.push(d);try{[...d.querySelectorAll('iframe')].forEach(f=>{try{addDoc(f.contentDocument)}catch(e){}})}catch(e){}};
const refreshDocs=()=>{docs.length=0;addDoc(document)};
const findElById=id=>{for(const d of docs){const el=d.getElementById(id);if(el)return el}return null};

const clickById=(id)=>{for(const d of docs){const el=d.getElementById(id);if(el){el.click();return true}const a=d.querySelector(`#${CSS.escape(id)} a, a#${CSS.escape(id)}`);if(a){a.click();return true}}return false};
const clickByText=(rx)=>{for(const d of docs){const el=[...d.querySelectorAll('a,button,li,span,div')].find(x=>rx.test(txt(x)));if(el){el.click();return true}}return false};

const readPon=()=>{
  for(const d of docs){
    const rx=d.querySelector('#RxPower');
    if(rx){const v=num(rx.getAttribute('title')||txt(rx));if(validPon(v))return v}
  }
  for(const d of docs){
    const ths=[...d.querySelectorAll('th')].filter(th=>/Pot(ê|e)ncia de entrada do m(ó|o)dulo (ó|o)ptico/i.test(txt(th)));
    for(const th of ths){
      const tr=th.closest('tr'); if(!tr)continue;
      for(const td of [...tr.querySelectorAll('td')]){
        const v=num(td.getAttribute('title')||txt(td));
        if(validPon(v))return v
      }
    }
  }
  return null
};

const readLanStatesById=()=>{
  const out={};
  for(const d of docs){
    for(let i=0;i<=3;i++){
      const el=d.getElementById(`Status:${i}`);
      if(!el)continue;
      const val=norm(el.getAttribute('title')||txt(el));
      if(val)out[`LAN${i+1}`]=val
    }
  }
  return Object.keys(out).length?out:null
};

const getSectionRootByHeaderText=(rx)=>{
  for(const d of docs){
    const hdr=[...d.querySelectorAll('a,button,div,span,li,h1,h2,h3')].find(x=>rx.test(txt(x)));
    if(!hdr)continue;
    let root=hdr.closest('div')||hdr.parentElement||d.body;
    for(let i=0;i<10&&root&&(!root.querySelector||!root.querySelector('table'));i++)root=root.parentElement;
    return {d,root:root||d.body}
  }
  return null
};

const tableToRows=(root)=>{
  const tb=root.querySelector('table'); if(!tb)return [];
  return [...tb.querySelectorAll('tr')]
    .map(tr=>[...tr.querySelectorAll('th,td')].map(c=>txt(c)))
    .filter(r=>r.some(x=>x))
};

const parseLanClientCounts=(root)=>{
  const rows=tableToRows(root); if(!rows.length)return null;
  let start=1;
  for(let i=0;i<Math.min(rows.length,8);i++){
    const j=rows[i].join(' ').toLowerCase();
    if(j.includes('lan')&&(j.includes('mac')||j.includes('ip')||j.includes('porta')||j.includes('port'))){start=i+1;break}
  }
  const byPort={};
  for(let i=start;i<rows.length;i++){
    const r=rows[i];
    const pm=(r.join(' ').match(/\bLAN ?[1-4]\b/i)||[])[0];
    if(!pm)continue;
    const port=pm.toUpperCase().replace(' ','');
    byPort[port]=(byPort[port]||0)+1
  }
  const out=Object.entries(byPort).filter(([,c])=>c>0).sort().map(([port,count])=>({port,count}));
  return out.length?out:null
};

const lanBad=(s)=>{
  const t=(s||'').toLowerCase();
  if(!t||/sem\s*link/.test(t)||/down/.test(t)||/disconnected/.test(t))return false;
  const hasHalf=/half/.test(t);
  const low=/\b10\b/.test(t)||/\b100\b/.test(t);
  return hasHalf||low
};

const maskMac=s=>{
  const m=(s||'').match(/([0-9a-fA-F]{2})[:\-]([0-9a-fA-F]{2})[:\-]([0-9a-fA-F]{2})[:\-]([0-9a-fA-F]{2})[:\-]([0-9a-fA-F]{2})[:\-]([0-9a-fA-F]{2})/);
  return m?`**:**:**:${m[4].toUpperCase()}:${m[5].toUpperCase()}:${m[6].toUpperCase()}`:null
};

const maskIpLast=s=>{
  const m=(s||'').match(/\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/);
  if(!m)return null;
  const o=[+m[1],+m[2],+m[3],+m[4]];
  if(o.some(x=>x<0||x>255))return null;
  return `*.*.*.${o[3]}`
};

const getVal=(base,i)=>{
  const el=findElById(`${base}:${i}`);
  if(!el)return null;
  return norm(el.getAttribute('title')||txt(el))
};

const clickExpandWlanClientsOnce=(()=>{let done=false;return ()=>{
  if(done)return false;
  const el=findElById('Wlan_ClientStatBar');
  if(!el)return false;
  done=true; el.click(); return true
}})();

const readWlanClientsMaskedWithPerMacRssi=()=>{
  const groups={};
  let i=0,miss=0,any=false;

  for(;;){
    const essid=getVal('ESSID',i);
    const rssiS=getVal('RSSI',i);
    const ipS=getVal('IPAddress',i);
    const macS=getVal('MACAddress',i);
    const alias=getVal('AliasName',i);

    if(!essid&&!rssiS&&!ipS&&!macS&&!alias){miss++; if(miss>=2)break; i++; continue}
    any=true; miss=0;

    const ssid=essid||'(sem SSID)';
    const rssi=num(rssiS);
    const macM=maskMac(macS);
    const ipM=maskIpLast(ipS);

    if(!groups[ssid])groups[ssid]={count:0,sum:0,min:null,max:null,ips:[],macs:[],macItems:[],ipSet:new Set(),macSet:new Set()};

    groups[ssid].count++;

    if(ipM && !groups[ssid].ipSet.has(ipM)){
      groups[ssid].ipSet.add(ipM);
      groups[ssid].ips.push(ipM);
    }

    if(macM && !groups[ssid].macSet.has(macM)){
      groups[ssid].macSet.add(macM);
      groups[ssid].macs.push(macM);
    }

    if(macM){
      groups[ssid].macItems.push({
        mac: macM,
        rssi: (rssi!==null&&isFinite(rssi)) ? Math.round(rssi*10)/10 : null
      });
    }

    if(rssi!==null&&isFinite(rssi)){
      groups[ssid].sum+=rssi;
      groups[ssid].min=groups[ssid].min===null?rssi:Math.min(groups[ssid].min,rssi);
      groups[ssid].max=groups[ssid].max===null?rssi:Math.max(groups[ssid].max,rssi);
    }

    i++
  }

  if(!any)return null;

  return Object.entries(groups).map(([ssid,g])=>({
    ssid,
    count:g.count,
    min:g.min===null?null:Math.round(g.min*10)/10,
    max:g.max===null?null:Math.round(g.max*10)/10,
    avg:g.min===null?null:Math.round((g.sum/g.count)*10)/10,
    ips:g.ips||[],
    macs:g.macs||[],
    macItems:(g.macItems||[]).slice(0,64)
  })).sort((a,b)=>b.count-a.count)
};

const mkFlags=(data)=>{
  const flags=[];
  if(data.pon==null)flags.push('PON: não encontrado');
  else if(data.pon>-10||data.pon<-26)flags.push(`PON fora do intervalo (-26..-10): ${data.pon} dBm`);
  if(data.lanState){
    for(const [p,s] of Object.entries(data.lanState)){
      if(lanBad(s))flags.push(`${p} link degradado: ${s}`);
    }
  }
  if(data.wlan){
    for(const x of data.wlan){
      if(x.min!==null&&x.max!==null&&x.min<-80&&x.max<-80)flags.push(`Wi-Fi ${x.ssid}: RSSI ruim (${x.min}..${x.max})`);
    }
  }
  return flags
};

const safeJoin=v=>Array.isArray(v)?v.filter(Boolean).join(', '):'';

const modal=(data)=>{
  const id='__tweak_diag_modal__';
  document.getElementById(id)?.remove();

  const flags=mkFlags(data);
  const badPon=data.pon!==null&&(data.pon>-10||data.pon<-26);
  const wlanSafe=Array.isArray(data.wlan)?data.wlan:[];
  const lanState=data.lanState||null;

  const report=[
    `Sinal PON: ${data.pon===null?'N/A':data.pon+' dBm'}`,
    '',
    ...(lanState?Object.entries(lanState).sort().map(([k,v])=>`${k}: ${v}`):['LAN (Estado): N/A']),
    '',
    ...(wlanSafe.length?wlanSafe.map(x=>`SSID ${x.ssid}: ${x.count} disp, RSSI ${x.min}..${x.max}${(x.ips&&x.ips.length)?`, IPs ${safeJoin(x.ips)}`:''}${(x.macs&&x.macs.length)?`, MACs ${safeJoin(x.macs)}`:''}`):['WLAN do cliente: N/A']),
    '',
    ...(data.lanClients?data.lanClients.map(x=>`${x.port}: ${x.count} disp`):['LAN do cliente: N/A'])
  ].join('\n');

  const w=document.createElement('div');
  w.id=id;
  w.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;';

  const wlanHtml=wlanSafe.length?wlanSafe.map(x=>{
    const macList=(x.macItems||[]).length?`
      <div style="margin-top:6px;font-size:12px;color:#444;display:grid;gap:3px">
        ${(x.macItems||[]).slice(0,24).map(m=>`<div style="display:flex;justify-content:space-between;gap:10px"><span>${m.mac}</span><span>RSSI ${m.rssi===null?'N/A':m.rssi}</span></div>`).join('')}
        ${(x.macItems||[]).length>24?`<div style="color:#666">+${(x.macItems||[]).length-24} MACs…</div>`:''}
      </div>`:'';
    return `
      <div style="border:1px solid #f1f1f1;border-radius:10px;padding:10px;">
        <div style="display:flex;justify-content:space-between;gap:12px">
          <span style="font-weight:900">${x.ssid}</span>
          <span>${x.count} disp • RSSI ${x.min??'N/A'}..${x.max??'N/A'}</span>
        </div>
        ${macList}
      </div>`;
  }).join(''):'<span style="color:#666">não encontrado</span>';

  w.innerHTML=`
  <div style="width:min(860px,94vw);max-height:88vh;overflow:auto;background:#fff;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.25);padding:14px;">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;">
      <div style="font-weight:900;font-size:16px;">Resumo para o chamado</div>
      <button id="__tweak_close__" style="padding:6px 10px;border:1px solid #ddd;border-radius:10px;background:#fff;cursor:pointer;">Fechar</button>
    </div>

    ${flags.length?`
      <div style="border:1px solid #fecaca;background:#fff5f5;border-radius:12px;padding:10px;margin-bottom:10px;">
        <div style="font-weight:900;color:#b91c1c;margin-bottom:6px;">Pontos de atenção</div>
        <div style="color:#7f1d1d;display:grid;gap:4px;">${flags.map(f=>`<div>• ${f}</div>`).join('')}</div>
      </div>
    `:''}

    <div style="border:1px solid #eee;border-radius:12px;padding:10px;margin-bottom:10px;">
      <div style="font-weight:900;margin-bottom:4px;">Leitura PON</div>
      <div><span style="font-weight:900;">Sinal PON</span>: ${data.pon===null?'<span style="color:#666">não encontrado</span>':`<b style="color:${badPon?'#d11':'#111'}">${data.pon} dBm</b>`}${badPon?`<div style="font-size:12px;color:#b91c1c;margin-top:4px;">Fora do intervalo (-26 a -10 dBm)</div>`:''}</div>
    </div>

    <div style="border:1px solid #eee;border-radius:12px;padding:10px;margin-bottom:10px;">
      <div style="font-weight:900;margin-bottom:6px;">LAN (Estado)</div>
      <div style="display:grid;gap:4px;">
        ${(lanState?Object.entries(lanState).sort().map(([k,v])=>`<div style="display:flex;justify-content:space-between;gap:12px"><b>${k}</b><span style="color:${lanBad(v)?'#b91c1c':'#111'}">${v}</span></div>`):['<span style="color:#666">não encontrado</span>']).join('')}
      </div>
      <div style="margin-top:6px;font-size:12px;color:#555;">Obs: “Sem link” não é problema.</div>
    </div>

    <div style="border:1px solid #eee;border-radius:12px;padding:10px;margin-bottom:10px;">
      <div style="font-weight:900;margin-bottom:6px;">WLAN do cliente (MAC + RSSI)</div>
      <div style="display:grid;gap:10px;">${wlanHtml}</div>
    </div>

    <div style="border:1px solid #eee;border-radius:12px;padding:10px;margin-bottom:10px;">
      <div style="font-weight:900;margin-bottom:6px;">LAN do cliente</div>
      <div style="display:grid;gap:4px;">
        ${(data.lanClients?data.lanClients.map(x=>`<div style="display:flex;justify-content:space-between;gap:12px"><b>${x.port}</b><span>${x.count} disp</span></div>`).join(''):'<span style="color:#666">não encontrado</span>')}
      </div>
    </div>

    <div style="display:flex;justify-content:flex-end;gap:8px;">
      <button id="__tweak_copy__" style="padding:8px 10px;border:0;border-radius:10px;background:#111;color:#fff;cursor:pointer;font-weight:900;">Copiar texto</button>
    </div>
  </div>`;

  (document.documentElement||document.body).appendChild(w);
  document.getElementById('__tweak_close__').onclick=()=>w.remove();
  w.addEventListener('click',e=>{if(e.target===w)w.remove();});
  document.getElementById('__tweak_copy__').onclick=async()=>{
    try{await navigator.clipboard.writeText(report);alert('Texto copiado.')}
    catch(e){prompt('Copie o texto:',report)}
  };
};

const data={pon:null,lanState:null,wlan:null,lanClients:null};
let phase=0,tries=0;
let clickedLanClient=false,clickedWlanHeader=false;

const delay=ms=>setTimeout(tick,ms);

const tick=()=>{
  tries++; refreshDocs();

  if(phase===0){
    data.pon=readPon();
    if(data.pon!==null){phase=1;tries=0}
    else{
      clickById('internet')||clickByText(/^Internet$/i);
      if(tries<50)return delay(250);
      phase=1;tries=0
    }
  }

  if(phase===1){
    clickById('localnet')||clickByText(/^Rede local$/i);
    phase=2;tries=0;return delay(450)
  }

  if(phase===2){
    data.lanState=readLanStatesById();
    phase=3;tries=0
  }

  if(phase===3){
    if(!clickedLanClient){clickedLanClient=true;clickByText(/^Estado da LAN do cliente$/i);return delay(450)}
    const sec=getSectionRootByHeaderText(/^Estado da LAN do cliente$/i);
    data.lanClients=sec?parseLanClientCounts(sec.root):null;
    phase=4;tries=0
  }

  if(phase===4){
    if(!clickedWlanHeader){clickedWlanHeader=true;clickByText(/^Estado da WLAN do cliente$/i);return delay(450)}
    clickExpandWlanClientsOnce();
    phase=5;tries=0;return delay(450)
  }

  if(phase===5){
    data.wlan=readWlanClientsMaskedWithPerMacRssi();
    if(!data.wlan&&tries<15)return delay(350);
    phase=6;tries=0
  }

  if(phase===6){
    clickById('mgrAndDiag')||clickByText(/^Gerência\s*&\s*Diagnóstico$/i);
    modal(data);
    return
  }
};

tick();

})();
