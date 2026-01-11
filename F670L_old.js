(()=>{

  if (window.RouterTweaks && window.RouterTweaks.__F670L_OLD_RUNNING) return;
  window.RouterTweaks = window.RouterTweaks || {};
  window.RouterTweaks.__F670L_OLD_RUNNING = true;

  const norm = s => (s || "").toString().replace(/\s+/g, " ").trim();
  const txt = e => norm(e && ("innerText" in e ? e.innerText : e.textContent));
  const num = s => { const m=(s||"").toString().replace(",",".").match(/-?\d+(?:\.\d+)?/); return m?parseFloat(m[0]):null; };
  const validPon = v => typeof v === "number" && isFinite(v) && v <= 10 && v >= -60;

  const maskMac = s => {
    const m = (s||"").match(/([0-9a-fA-F]{2})[:\-]([0-9a-fA-F]{2})[:\-]([0-9a-fA-F]{2})[:\-]([0-9a-fA-F]{2})[:\-]([0-9a-fA-F]{2})[:\-]([0-9a-fA-F]{2})/);
    return m ? `**:**:**:${m[4].toUpperCase()}:${m[5].toUpperCase()}:${m[6].toUpperCase()}` : null;
  };

  const maskIpLast = s => {
    const m = (s||"").match(/\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/);
    if (!m) return null;
    const o=[+m[1],+m[2],+m[3],+m[4]];
    if (o.some(x=>x<0||x>255)) return null;
    return `*.*.*.${o[3]}`;
  };

  const ssidBand = portStr => {
    const m = (portStr||"").toUpperCase().match(/\bSSID\s*([1-6])\b/);
    const n = m ? parseInt(m[1],10) : null;
    if (n>=1 && n<=3) return "2.4G";
    if (n>=4 && n<=6) return "5G";
    return "";
  };

  const docs = [];
  const addDoc = d => {
    if (!d || docs.includes(d)) return;
    docs.push(d);
    try { [...d.querySelectorAll("iframe,frame")].forEach(f => { try { addDoc(f.contentDocument); } catch(e){} }); } catch(e){}
  };

  const refreshDocs = () => {
    docs.length = 0;
    try { if (window.frames && window.frames.mainFrame && window.frames.mainFrame.document) addDoc(window.frames.mainFrame.document); } catch(e){}
    addDoc(document);
  };

  const isVisible = el => {
    try {
      if (!el) return false;
      if (el.hidden) return false;
      const st = el.ownerDocument.defaultView.getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden" || +st.opacity === 0) return false;
      const r = el.getBoundingClientRect();
      if (!r || r.width < 2 || r.height < 2) return false;
      return true;
    } catch(e){ return false; }
  };

  const findClickableById = (d, id) => {
    const esc = CSS.escape(id);
    const cand = [
      ...d.querySelectorAll(`a#${esc}, #${esc} a, button#${esc}, #${esc} button, li#${esc} > a, li#${esc}`)
    ].filter(isVisible);
    if (cand.length) return cand[0];

    const el = d.getElementById(id);
    if (el && isVisible(el) && /^(A|BUTTON|LI|DIV|SPAN)$/.test(el.tagName)) return el;

    return null;
  };

  const clickById = id => {
    for (const d of docs) {
      try {
        const el = findClickableById(d, id);
        if (el) { el.click(); return true; }
      } catch(e){}
    }
    return false;
  };

  const clickByText = rx => {
    for (const d of docs) {
      try {
        const el = [...d.querySelectorAll("a,button,li,span,div,h1,h2,h3")]
          .find(x => isVisible(x) && rx.test(txt(x)));
        if (el) { el.click(); return true; }
      } catch(e){}
    }
    return false;
  };

  const expandTreeForText = (childTextRx) => {
    refreshDocs();
    for (const d of docs) {
      try {
        const target = [...d.querySelectorAll("a,li,div,span")]
          .find(x => isVisible(x) && childTextRx.test(txt(x)));
        if (!target) continue;

        let li = target.closest("li") || (target.parentElement ? target.parentElement.closest("li") : null);
        if (!li) return false;

        let p = li.parentElement ? li.parentElement.closest("li") : null;
        let guard = 0;

        while (p && guard++ < 25) {
          const a = p.querySelector(":scope > a");
          if (a) {
            const t = (a.textContent || "").trim();
            if (/^\+/.test(t)) a.click();
          }
          p = p.parentElement ? p.parentElement.closest("li") : null;
        }
        return true;
      } catch(e){}
    }
    return false;
  };

  const safeClickMenu = id => {
    if (clickById(id)) return true;
    return false;
  };

  const safeClickMenuByText = (rx) => {
    if (clickByText(rx)) return true;
    expandTreeForText(rx);
    return clickByText(rx);
  };

  const findElById = id => {
    for (const d of docs) { try { const el = d.getElementById(id); if (el) return el; } catch(e){} }
    return null;
  };

  const readPonOld = () => {
    const el = findElById("Fnt_RxPower");
    if (!el) return null;
    const v = num(el.getAttribute("title") || txt(el));
    return validPon(v) ? v : null;
  };

  const readLanTableOld = () => {
    const out = {};
    for (const d of docs) {
      const tables = [...d.querySelectorAll("table.infor, table#TestContent, table")];
      for (const t of tables) {
        const rows = [...t.querySelectorAll("tr")];
        let lanName = null, status=null, speed=null, mode=null;
        for (const tr of rows) {
          const tds = [...tr.querySelectorAll("td")];
          if (tds.length < 2) continue;
          const k = txt(tds[0]).toLowerCase();
          const v = txt(tds[1]);
          if (k.includes("conex") && k.includes("rede")) {
            const m = v.toUpperCase().match(/\bLAN\s*([1-4])\b/);
            if (m) lanName = `LAN${m[1]}`;
          } else if (k === "status") status = v;
          else if (k.includes("veloc")) speed = v;
          else if (k.includes("modo")) mode = v;
        }
        if (lanName) out[lanName] = { status: norm(status), speed: norm(speed), mode: norm(mode) };
      }
    }
    return Object.keys(out).length ? out : null;
  };

  const parseDhcpTable = () => {
    for (const d of docs) {
      const t = d.getElementById("Dhcp_Table") || d.querySelector("#Dhcp_Table");
      if (!t) continue;

      const rows = [...t.querySelectorAll("tr")];
      if (rows.length < 2) return { byPort: {}, list: [] };

      const head = [...rows[0].querySelectorAll("th,td")].map(c=>txt(c).toLowerCase());
      const idx = (rx) => head.findIndex(h => rx.test(h));

      const iMac = idx(/mac/);
      const iIp  = idx(/\bip\b/);
      const iHost= idx(/host|anfitri|nome/);
      const iPort= idx(/porta|port/);

      const list = [];
      for (let i=1;i<rows.length;i++){
        const cols = [...rows[i].querySelectorAll("td")].map(c=>txt(c));
        if (!cols.length) continue;
        const mac = cols[iMac] || "";
        const ip  = cols[iIp]  || "";
        const host= cols[iHost]|| "";
        const port= cols[iPort]|| "";
        const macM = maskMac(mac);
        const ipM  = maskIpLast(ip);
        list.push({ mac, ip, host, port, macM, ipM });
      }

      const byPort = {};
      for (const r of list) {
        const p = (r.port||"").toUpperCase().replace(/\s+/g,"");
        if (!p) continue;
        byPort[p] = byPort[p] || { count:0, macs:[], ips:[], macSet:new Set(), ipSet:new Set() };
        byPort[p].count++;
        if (r.macM && !byPort[p].macSet.has(r.macM)) { byPort[p].macSet.add(r.macM); byPort[p].macs.push(r.macM); }
        if (r.ipM && !byPort[p].ipSet.has(r.ipM)) { byPort[p].ipSet.add(r.ipM); byPort[p].ips.push(r.ipM); }
      }
      Object.values(byPort).forEach(x=>{ delete x.macSet; delete x.ipSet; });
      return { byPort, list };
    }
    return null;
  };

  const isLanUp = s => {
    const t=(s||"").toLowerCase();
    return t.includes("conectar") || t.includes("linkup");
  };

  const lanDegraded = (speed, mode, status) => {
    if (!isLanUp(status)) return false;
    const sp = (speed||"").toLowerCase();
    const md = (mode||"").toLowerCase();
    const low = /\b10\b/.test(sp) || /\b100\b/.test(sp);
    const half = md.includes("half");
    return low || half;
  };

  const mkFlags = (data) => {
    const flags = [];
    if (data.pon == null) flags.push("PON: não encontrado");
    else if (data.pon > -10 || data.pon < -26) flags.push(`PON fora do intervalo (-26..-10): ${data.pon} dBm`);
    if (data.lan) {
      for (const k of Object.keys(data.lan).sort()) {
        const x = data.lan[k];
        if (lanDegraded(x.speed, x.mode, x.status)) flags.push(`${k} link degradado: ${x.speed || "?"} / ${x.mode || "?"}`);
      }
    }
    return flags;
  };

  const copyToClipboard = (text) => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0;";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      const ok = document.execCommand && document.execCommand("copy");
      document.body.removeChild(ta);
      return !!ok;
    } catch (e) { return false; }
  };

  const modal = (data) => {
    const id="__tweak_old_diag__";
    document.getElementById(id)?.remove();

    const flags = mkFlags(data);
    const badPon = data.pon!==null && (data.pon>-10 || data.pon<-26);

    const lanHtml = data.lan
      ? Object.keys(data.lan).sort().map(k=>{
          const x=data.lan[k]||{};
          const up=isLanUp(x.status);
          const deg=lanDegraded(x.speed,x.mode,x.status);
          const dev=(data.dhcp && data.dhcp.byPort && data.dhcp.byPort[k]) ? data.dhcp.byPort[k] : null;
          const macs = dev && dev.macs ? dev.macs : [];
          const ips  = dev && dev.ips  ? dev.ips  : [];
          return `
            <div style="border:1px solid #f1f1f1;border-radius:10px;padding:10px;">
              <div style="display:flex;justify-content:space-between;gap:12px">
                <span style="font-weight:900">${k}</span>
                <span style="color:${deg?'#b91c1c':'#111'}">${x.status||'—'}${up?` • ${x.speed||'—'} • ${x.mode||'—'}`:''}</span>
              </div>
              ${(macs.length||ips.length)?`
                <div style="margin-top:6px;font-size:12px;color:#444;display:grid;gap:3px">
                  ${ips.length?`<div><b>IPs:</b> ${ips.slice(0,12).join(", ")}${ips.length>12?"…":""}</div>`:""}
                  ${macs.length?`<div><b>MACs:</b> ${macs.slice(0,12).join(", ")}${macs.length>12?"…":""}</div>`:""}
                </div>`:""}
            </div>`;
        }).join("")
      : `<span style="color:#666">não encontrado</span>`;

    const wifiGroups = (() => {
      const out = [];
      const by = data.dhcp && data.dhcp.byPort ? data.dhcp.byPort : {};
      for (const p of Object.keys(by)) {
        if (!/^SSID\d$/i.test(p)) continue;
        const band = ssidBand(p);
        out.push({ ssid: p.toUpperCase(), band, count: by[p].count, macs: by[p].macs||[], ips: by[p].ips||[] });
      }
      out.sort((a,b)=>b.count-a.count);
      return out;
    })();

    const wifiHtml = wifiGroups.length
      ? wifiGroups.map(g=>`
          <div style="border:1px solid #f1f1f1;border-radius:10px;padding:10px;">
            <div style="display:flex;justify-content:space-between;gap:12px">
              <span style="font-weight:900">${g.ssid} <span style="font-weight:700;color:#555">(${g.band||"—"})</span></span>
              <span>${g.count} disp</span>
            </div>
            ${(g.macs.length||g.ips.length)?`
              <div style="margin-top:6px;font-size:12px;color:#444;display:grid;gap:3px">
                ${g.ips.length?`<div><b>IPs:</b> ${g.ips.slice(0,12).join(", ")}${g.ips.length>12?"…":""}</div>`:""}
                ${g.macs.length?`<div><b>MACs:</b> ${g.macs.slice(0,12).join(", ")}${g.macs.length>12?"…":""}</div>`:""}
              </div>`:""}
          </div>`).join("")
      : `<span style="color:#666">não encontrado</span>`;

    const report = [
      `Sinal PON: ${data.pon===null?'N/A':(data.pon+' dBm')}`,
      "",
      "LAN (Estado):",
      ...(data.lan ? Object.keys(data.lan).sort().map(k=>{
        const x=data.lan[k]||{};
        const up=isLanUp(x.status);
        return `${k}: ${x.status||'—'}${up?` • ${x.speed||'—'} • ${x.mode||'—'}`:''}`;
      }) : ["LAN: N/A"]),
      "",
      "Wi-Fi (DHCP por SSID):",
      ...(wifiGroups.length ? wifiGroups.map(g=>`${g.ssid} (${g.band||'—'}): ${g.count} disp`) : ["Wi-Fi: N/A"])
    ].join("\n");

    const w=document.createElement("div");
    w.id=id;
    w.style.cssText="position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;";
    w.innerHTML=`
      <div style="width:min(940px,94vw);max-height:88vh;overflow:auto;background:#fff;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.25);padding:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;">
          <div style="font-weight:900;font-size:16px;">Resumo para o chamado (ZTE OLD)</div>
          <button id="__tweak_old_close__" style="padding:6px 10px;border:1px solid #ddd;border-radius:10px;background:#fff;cursor:pointer;">Fechar</button>
        </div>

        ${flags.length?`
          <div style="border:1px solid #fecaca;background:#fff5f5;border-radius:12px;padding:10px;margin-bottom:10px;">
            <div style="font-weight:900;color:#b91c1c;margin-bottom:6px;">Pontos de atenção</div>
            <div style="color:#7f1d1d;display:grid;gap:4px;">${flags.map(f=>`<div>• ${f}</div>`).join("")}</div>
          </div>` : ""}

        <div style="border:1px solid #eee;border-radius:12px;padding:10px;margin-bottom:10px;">
          <div style="font-weight:900;margin-bottom:4px;">Leitura PON</div>
          <div><span style="font-weight:900;">Sinal PON</span>: ${data.pon===null?'<span style="color:#666">não encontrado</span>':`<b style="color:${badPon?'#d11':'#111'}">${data.pon} dBm</b>`}${badPon?`<div style="font-size:12px;color:#b91c1c;margin-top:4px;">Fora do intervalo (-26 a -10 dBm)</div>`:""}</div>
        </div>

        <div style="border:1px solid #eee;border-radius:12px;padding:10px;margin-bottom:10px;">
          <div style="font-weight:900;margin-bottom:6px;">LAN (Status + velocidade + duplex + MAC/IP mascarados via DHCP)</div>
          <div style="display:grid;gap:10px;">${lanHtml}</div>
          <div style="margin-top:6px;font-size:12px;color:#555;">Obs: linkdown/Marque abaixo = sem link.</div>
        </div>

        <div style="border:1px solid #eee;border-radius:12px;padding:10px;margin-bottom:10px;">
          <div style="font-weight:900;margin-bottom:6px;">Wi-Fi (DHCP por SSID + MAC/IP mascarados)</div>
          <div style="display:grid;gap:10px;">${wifiHtml}</div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button id="__tweak_old_copy__" style="padding:8px 10px;border:0;border-radius:10px;background:#111;color:#fff;cursor:pointer;font-weight:900;">Copiar texto</button>
        </div>
      </div>
    `;
    (document.body||document.documentElement).appendChild(w);

    document.getElementById("__tweak_old_close__").onclick=()=>w.remove();
    w.addEventListener("click",e=>{ if(e.target===w) w.remove(); });

    document.getElementById("__tweak_old_copy__").onclick=()=>{
      const ok = copyToClipboard(report);
      if (!ok) alert("Não foi possível copiar para a área de transferência.");
    };
  };

  const data = { pon:null, lan:null, dhcp:null };
  let phase=0, tries=0;

  const wait = (ms) => setTimeout(tick, ms);

  const tick = () => {
    tries++;
    refreshDocs();

    if (phase===0) {
      safeClickMenu("smWanStatu");
      phase=1; tries=0;
      return wait(350);
    }

    if (phase===1) {
      safeClickMenu("ssmLinkState");
      phase=2; tries=0;
      return wait(700);
    }

    if (phase===2) {
      data.pon = readPonOld();
      if (data.pon!==null || tries>=18) { phase=3; tries=0; }
      return wait(350);
    }

    if (phase===3) {
      safeClickMenu("smLanStatu");
      phase=4; tries=0;
      return wait(350);
    }

    if (phase===4) {
      safeClickMenu("ssmLAN");
      phase=5; tries=0;
      return wait(900);
    }

    if (phase===5) {
      data.lan = readLanTableOld();
      phase=6; tries=0;
    }

    if (phase===6) {
      safeClickMenuByText(/^-?\s*Rede$/i);
      phase=7; tries=0;
      return wait(350);
    }

    if (phase===7) {
      safeClickMenuByText(/^-?\s*LAN$/i);
      phase=8; tries=0;
      return wait(350);
    }

    if (phase===8) {
      safeClickMenuByText(/^Servidor\s+DHCP$/i);
      phase=9; tries=0;
      return wait(1100);
    }

    if (phase===9) {
      data.dhcp = parseDhcpTable();
      if (data.dhcp || tries>=30) { phase=10; tries=0; }
      return wait(350);
    }

    if (phase===10) {
      modal(data);
      return;
    }
  };

  tick();

})();
