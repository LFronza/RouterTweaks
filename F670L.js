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

const clickExpandLanDevsOnce=(()=>{let done=false;return ()=>{
  if(done)return false;
  const el=findElById('LANDevsBar');
  if(!el)return false;
  done=true; el.click(); return true
}})();

const ssidBand=(essid,alias)=>{
  const s=(alias||'')+' '+(essid||'');
  const m=s.match(/(?:\bssid\b\s*|#\s*|_|\-|\s)([1-6])\b/i)||s.match(/\b([1-6])\b/);
  const n=m?parseInt(m[1],10):null;
  if(n>=1&&n<=3)return '2.4G';
  if(n>=4&&n<=6)return '5G';
  return '';
};

const readWlanClientsMaskedWithPerMacRssi=()=>{
  const groups={};
  let i=0,miss=0,any=false;

  for(;;){
    const essid=getVal('ESSID',i);
    const rssiS=getVal('RSSI',i);
    const macS=getVal('MACAddress',i);
    const alias=getVal('AliasName',i);

    if(!essid&&!rssiS&&!macS&&!alias){miss++; if(miss>=2)break; i++; continue}
    any=true; miss=0;

    const ssid=essid||'(sem SSID)';
    const band=ssidBand(essid,alias);
    const rssi=num(rssiS);
    const macM=maskMac(macS);

    if(!groups[ssid])groups[ssid]={ssid,band,count:0,sum:0,min:null,max:null,macItems:[]};
    groups[ssid].count++;

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

    if(!groups[ssid].band && band)groups[ssid].band=band;

    i++
  }

  if(!any)return null;

  return Object.values(groups).map(g=>({
    ssid:g.ssid,
    band:g.band||'',
    count:g.count,
    min:g.min===null?null:Math.round(g.min*10)/10,
    max:g.max===null?null:Math.round(g.max*10)/10,
    avg:g.min===null?null:Math.round((g.sum/g.count)*10)/10,
    macItems:(g.macItems||[]).slice(0,256)
  })).sort((a,b)=>b.count-a.count)
};

const readLanDevsMacsByPort=()=>{
  const out={};
  let i=0,miss=0,any=false;
  for(;;){
    const alias=getVal('AliasName:LANDevs',i);
    const macS=getVal('MACAddress:LANDevs',i);
    if(!alias&&!macS){miss++; if(miss>=2)break; i++; continue}
    any=true; miss=0;

    const a=(alias||'').toUpperCase();
    const mPort=a.match(/\bLAN\s*([1-4])\b/);
    const port=mPort?`LAN${mPort[1]}`:null;

    const macM=maskMac(macS);
    if(port && macM){
      out[port]=out[port]||{set:new Set(),list:[]};
      if(!out[port].set.has(macM)){
        out[port].set.add(macM);
        out[port].list.push(macM);
      }
    }
    i++
  }
  if(!any)return null;
  const fin={};
  for(const k of Object.keys(out))fin[k]=out[k].list;
  return Object.keys(fin).length?fin:null
};

const readPoweronTime=()=>{
  const el=findElById('PoweronTime');
  if(!el)return null;
  return norm(el.getAttribute('title')||txt(el))
};

const parseUptimeSeconds=(s)=>{
  s=(s||'').toLowerCase();
  if(!s)return null;
  const pick=(rx)=>{const m=s.match(rx);return m?parseInt(m[1],10):0};
  const d=pick(/(\d+)\s*dia/);
  const h=pick(/(\d+)\s*hora/);
  const m=pick(/(\d+)\s*min/); // pega minuto/miuto
  const sec=pick(/(\d+)\s*seg/);
  const total=d*86400+h*3600+m*60+sec;
  return isFinite(total)&&total>=0?total:null
};

const mkFlags=(data)=>{
  const flags=[];
  if(data.pon==null)flags.push('PON: não encontrado');
  else if(data.pon>-10||data.pon<-26)flags.push(`PON fora do intervalo (-26..-10): ${data.pon} dBm`);

  if(data.uptimeText){
    const up=parseUptimeSeconds(data.uptimeText);
    if(up!==null && up>30*86400) flags.push(`Uptime alto (>30 dias): ${data.uptimeText}`);
  }

  if(data.lanState){
    for(const [p,s] of Object.entries(data.lanState)){
      if(lanBad(s))flags.push(`${p} link degradado: ${s}`);
    }
  }

  if(Array.isArray(data.wlan)){
    const badMacs=[];
    for(const ss of data.wlan){
      for(const mi of (ss.macItems||[])){
        if(mi && mi.rssi!==null && mi.rssi<-70) badMacs.push(`${ss.ssid}${ss.band?`(${ss.band})`:''} ${mi.mac} RSSI ${mi.rssi}`);
      }
    }
    if(badMacs.length){
      flags.push('Wi-Fi RSSI < -70 (MACs):');
      badMacs.slice(0,12).forEach(x=>flags.push(x));
      if(badMacs.length>12)flags.push(`+${badMacs.length-12} MACs...`);
    }
  }

  return flags
};

const copyToClipboard=(text)=>{
  try{
    const ta=document.createElement('textarea');
    ta.value=text;
    ta.setAttribute('readonly','');
    ta.style.cssText='position:fixed;left:-9999px;top:-9999px;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0,ta.value.length);
    const ok=document.execCommand && document.execCommand('copy');
    document.body.removeChild(ta);
    return !!ok;
  }catch(e){return false}
};

const modal=(data)=>{
  const id='__tweak_diag_modal__';
  document.getElementById(id)?.remove();

  const flags=mkFlags(data);
  const badPon=data.pon!==null&&(data.pon>-10||data.pon<-26);
  const wlanSafe=Array.isArray(data.wlan)?data.wlan:[];
  const lanState=data.lanState||null;
  const lanDevs=data.lanDevs||null;

  const report=[
    `Sinal PON: ${data.pon===null?'N/A':data.pon+' dBm'}`,
    data.uptimeText?`Uptime: ${data.uptimeText}`:'Uptime: N/A',
    '',
    ...(lanState?Object.entries(lanState).sort().map(([k,v])=>`${k}: ${v}`):['LAN: N/A']),
    '',
    ...(wlanSafe.length?wlanSafe.map(x=>`SSID ${x.ssid}${x.band?` (${x.band})`:''}: ${x.count} disp, RSSI ${x.min??'N/A'}..${x.max??'N/A'}`):['WLAN do cliente: N/A'])
  ].join('\n');

  const w=document.createElement('div');
  w.id=id;
  w.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;';

  const lanHtml=(lanState?Object.entries(lanState).sort().map(([k,v])=>{
    const macs=(lanDevs&&lanDevs[k])?lanDevs[k]:[];
    return `
      <div style="border:1px solid #f1f1f1;border-radius:10px;padding:10px;">
        <div style="display:flex;justify-content:space-between;gap:12px">
          <span style="font-weight:900">${k}</span>
          <span style="color:${lanBad(v)?'#b91c1c':'#111'}">${v}</span>
        </div>
        ${macs.length?`<div style="margin-top:6px;font-size:12px;color:#444;display:grid;gap:3px">${macs.slice(0,24).map(m=>`<div>${m}</div>`).join('')}${macs.length>24?`<div style="color:#666">+${macs.length-24} MACs…</div>`:''}</div>`:''}
      </div>`;
  }).join(''):'<span style="color:#666">não encontrado</span>');

  const wlanHtml=wlanSafe.length?wlanSafe.map(x=>{
    const macList=(x.macItems||[]).length?`
      <div style="margin-top:6px;font-size:12px;color:#444;display:grid;gap:3px">
        ${(x.macItems||[]).slice(0,24).map(m=>`<div style="display:flex;justify-content:space-between;gap:10px"><span>${m.mac}</span><span>RSSI ${m.rssi===null?'N/A':m.rssi}</span></div>`).join('')}
        ${(x.macItems||[]).length>24?`<div style="color:#666">+${(x.macItems||[]).length-24} MACs…</div>`:''}
      </div>`:'';
    return `
      <div style="border:1px solid #f1f1f1;border-radius:10px;padding:10px;">
        <div style="display:flex;justify-content:space-between;gap:12px">
          <span style="font-weight:900">${x.ssid}${x.band?` <span style="font-weight:700;color:#555">(${x.band})</span>`:''}</span>
          <span>${x.count} disp • RSSI ${x.min??'N/A'}..${x.max??'N/A'}</span>
        </div>
        ${macList}
      </div>`;
  }).join(''):'<span style="color:#666">não encontrado</span>';

  w.innerHTML=`
  <div style="width:min(900px,94vw);max-height:88vh;overflow:auto;background:#fff;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.25);padding:14px;">
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
      <div style="margin-top:6px;font-size:12px;color:#555;"><b>Uptime:</b> ${data.uptimeText||'não encontrado'}</div>
    </div>

    <div style="border:1px solid #eee;border-radius:12px;padding:10px;margin-bottom:10px;">
      <div style="font-weight:900;margin-bottom:6px;">LAN</div>
      <div style="display:grid;gap:10px;">${lanHtml}</div>
      <div style="margin-top:6px;font-size:12px;color:#555;">Obs: “Sem link” não é problema.</div>
    </div>

    <div style="border:1px solid #eee;border-radius:12px;padding:10px;margin-bottom:10px;">
      <div style="font-weight:900;margin-bottom:6px;">WLAN do cliente</div>
      <div style="display:grid;gap:10px;">${wlanHtml}</div>
    </div>

    <div style="display:flex;justify-content:flex-end;gap:8px;">
      <button id="__tweak_copy__" style="padding:8px 10px;border:0;border-radius:10px;background:#111;color:#fff;cursor:pointer;font-weight:900;">Copiar texto</button>
    </div>
  </div>`;

  (document.documentElement||document.body).appendChild(w);
  document.getElementById('__tweak_close__').onclick=()=>w.remove();
  w.addEventListener('click',e=>{if(e.target===w)w.remove();});

  document.getElementById('__tweak_copy__').onclick=()=>{
    const ok=copyToClipboard(report);
    if(!ok) alert('Não foi possível copiar para a área de transferência.');
  };
};

const data={pon:null,lanState:null,wlan:null,lanDevs:null,uptimeText:null};
let phase=0,tries=0;
let clickedWlanHeader=false,clickedLanDevs=false,clickedMgr=false;

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
    if(!clickedWlanHeader){clickedWlanHeader=true;clickByText(/^Estado da WLAN do cliente$/i);return delay(450)}
    clickExpandWlanClientsOnce();
    phase=4;tries=0;return delay(450)
  }

  if(phase===4){
    data.wlan=readWlanClientsMaskedWithPerMacRssi();
    if(!data.wlan&&tries<15)return delay(350);
    phase=5;tries=0
  }

  if(phase===5){
    if(!clickedLanDevs){clickedLanDevs=true;clickExpandLanDevsOnce();return delay(450)}
    data.lanDevs=readLanDevsMacsByPort();
    phase=6;tries=0
  }

  if(phase===6){
    if(!clickedMgr){clickedMgr=true;clickById('mgrAndDiag')||clickByText(/^Gerência\s*&\s*Diagnóstico$/i);return delay(650)}
    data.uptimeText=readPoweronTime();
    phase=7;tries=0
  }

  if(phase===7){
    modal(data);
    return
  }
};

tick();

})();
