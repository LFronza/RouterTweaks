(()=>{

  window.RouterTweaks = window.RouterTweaks || {};
  const RUN_ID = Date.now() + "_" + Math.random().toString(16).slice(2);
  window.RouterTweaks.__F670L_OLD_RUN_ID = RUN_ID;
  window.RouterTweaks.__F670L_OLD_ABORT = false;

  const DBG = (...a)=>console.log("[RT-OLD]", ...a);
  const DBGW = (...a)=>console.warn("[RT-OLD]", ...a);
  const DBGE = (...a)=>console.error("[RT-OLD]", ...a);

  const norm = s => (s || "").toString().replace(/\s+/g, " ").trim();
  const txt = e => norm(e && ("innerText" in e ? e.innerText : e.textContent));
  const num = s => { const m=(s||"").toString().replace(",",".").match(/-?\d+(?:\.\d+)?/); return m?parseFloat(m[0]):null; };
  const validPon = v => typeof v === "number" && isFinite(v) && v <= 10 && v >= -60;

  const docs = [];
  const addDoc = d => {
    if (!d || docs.includes(d)) return;
    docs.push(d);
    try { [...d.querySelectorAll("iframe,frame")].forEach(f => { try { addDoc(f.contentDocument); } catch(e){} }); } catch(e){}
  };
  const addWindowDocs = (w, depth=0) => {
    if (!w || depth>7) return;
    try { if (w.document) addDoc(w.document); } catch(e){}
    try {
      const len = w.frames ? w.frames.length : 0;
      for (let i=0;i<len;i++){ try { addWindowDocs(w.frames[i], depth+1); } catch(e){} }
    } catch(e){}
  };
  const refreshDocs = () => { docs.length = 0; addWindowDocs(window, 0); };

  const alive = () => window.RouterTweaks.__F670L_OLD_RUN_ID === RUN_ID && !window.RouterTweaks.__F670L_OLD_ABORT;

  const findElById = id => {
    for (const d of docs) { try { const el=d.getElementById(id); if (el) return el; } catch(e){} }
    return null;
  };

  const clickByText = (rx, scopeDoc=null) => {
    const pool = scopeDoc ? [scopeDoc] : docs;
    for (const d of pool) {
      try {
        const el = [...d.querySelectorAll("a,button,li,span,div,td")]
          .find(x => rx.test(txt(x)));
        if (el) { el.click(); return true; }
      } catch(e){}
    }
    return false;
  };

  const wait = ms => new Promise(r=>setTimeout(r, ms));

  const waitFor = async (name, predicate, timeoutMs=12000, intervalMs=200) => {
    const start = Date.now();
    while (alive() && (Date.now()-start) < timeoutMs) {
      refreshDocs();
      let ok=false;
      try { ok = !!predicate(); } catch(e){}
      if (ok) { DBG("waitFor OK:", name, "ms=", Date.now()-start); return true; }
      await wait(intervalMs);
    }
    DBGW("waitFor TIMEOUT:", name, "ms=", Date.now()-start);
    return false;
  };

  // ===== DEBUG HELPERS =====
  const docSummary = () => docs.map((d,i)=>{
    let u=""; try{u=d.location && d.location.href ? d.location.href : ""}catch(e){}
    let t=""; try{t=(d.title||"").slice(0,60)}catch(e){}
    let b=""; try{b=(d.body && d.body.innerText ? d.body.innerText.slice(0,120).replace(/\s+/g," ") : "")}catch(e){}
    return {i, url:u, title:t, body120:b};
  });

  const logMenuSnapshot = () => {
    refreshDocs();
    const snaps=[];
    for (const d of docs){
      try{
        const items=[...d.querySelectorAll("a,li,div,span,td")].map(n=>txt(n)).filter(Boolean);
        const menuLike = items.filter(s=>/^\+|^\-|Interface de rede|Informa(ç|c)ão PON|Rede|LAN|Servidor DHCP|Ethernet|Status/i.test(s)).slice(0,120);
        if (menuLike.length) snaps.push({url: (()=>{try{return d.location.href}catch(e){return""}})(), menuLike});
      }catch(e){}
    }
    DBG("MENU SNAPSHOT:", snaps);
  };

  const getLeftMenuDoc = () => {
    for (const d of docs) {
      try {
        const t = d.body ? d.body.innerText : "";
        if (/\+Status/i.test(t) && /Rede/i.test(t)) return d;
      } catch(e){}
    }
    return docs[0] || document;
  };

  const findMenuItem = (labelRx, d) => {
    const nodes = [...d.querySelectorAll("a,li,div,span,td")];
    return nodes.find(n => labelRx.test(txt(n)));
  };

  const ensureExpanded = async (labelRx, d) => {
    const el = findMenuItem(labelRx, d);
    DBG("ensureExpanded find", labelRx, "=>", el?txt(el):null);
    if (!el) return false;
    const t = (el.textContent || "").trim();
    if (/^\+/.test(t)) { DBG("expand click", t); el.click(); await wait(220); }
    return true;
  };

  const menuPath = async (label, steps) => {
    refreshDocs();
    const d = getLeftMenuDoc();
    DBG("menuPath", label, "steps=", steps.map(r=>r.toString()));
    DBG("menuDoc url=", (()=>{try{return d.location.href}catch(e){return""}})());

    for (let i=0;i<steps.length;i++){
      const rx = steps[i];
      const el = findMenuItem(rx, d);
      DBG(" step", i, rx.toString(), "=>", el?txt(el):null);
      if (!el) continue;

      const t = (el.textContent || "").trim();
      if (i < steps.length-1) {
        if (/^\+/.test(t)) { DBG("  click expand", t); el.click(); await wait(240); continue; }
        await wait(120);
      } else {
        DBG("  click final", t);
        el.click();
        await wait(800);
      }
    }

    // fallback global
    for (const rx of steps) {
      const ok = clickByText(rx);
      DBG(" fallback clickByText", rx.toString(), "=>", ok);
      await wait(260);
    }
  };

  // ===== READERS =====
  const readPonOld = () => {
    const el = findElById("Fnt_RxPower");
    if (el) {
      const raw = el.getAttribute("title") || txt(el);
      const v = num(raw);
      DBG("readPonOld byId Fnt_RxPower raw=", raw, "num=", v);
      if (validPon(v)) return v;
    } else {
      DBGW("readPonOld: Fnt_RxPower not found");
    }

    for (const d of docs) {
      try {
        const tds = [...d.querySelectorAll("td")];
        for (let i=0;i<tds.length;i++){
          const k = txt(tds[i]).toLowerCase();
          if ((k.includes("energia") || k.includes("pot")) && k.includes("entrada") && k.includes("módulo")) {
            const raw = txt(tds[i+1] || "");
            const v = num(raw);
            DBG("readPonOld byLabel raw=", raw, "num=", v);
            if (validPon(v)) return v;
          }
        }
      } catch(e){}
    }
    return null;
  };

  const hasPonPage = () => {
    if (findElById("Fnt_RxPower")) return true;
    for (const d of docs) {
      try {
        const t = d.body ? d.body.innerText : "";
        if (/Informa(ç|c)ão\s+PON/i.test(t) && /(Energia|Pot(ê|e)ncia)\s+de\s+entrada/i.test(t)) return true;
      } catch(e){}
    }
    return false;
  };

  const hasLanPage = () => {
    for (const d of docs) {
      try {
        const t = d.body ? d.body.innerText : "";
        if (/Interface\s+de\s+usu(á|a)rio.*Ethernet/i.test(t)) return true;
        if (/Conex(ã|a)o\s+de\s+Rede/i.test(t) && /\bLAN[1-4]\b/i.test(t)) return true;
      } catch(e){}
    }
    return false;
  };

  const readLanTableOld = () => {
    const out = {};
    for (const d of docs) {
      const tables = [...d.querySelectorAll("table")];
      for (const t of tables) {
        const rows = [...t.querySelectorAll("tr")];
        let lanName=null,status=null,speed=null,mode=null,seen=false;
        for (const tr of rows) {
          const tds=[...tr.querySelectorAll("td")];
          if (tds.length<2) continue;
          const k=txt(tds[0]).toLowerCase();
          const v=txt(tds[1]);
          if (/conex/.test(k) && /rede/.test(k)) {
            const m=v.toUpperCase().match(/\bLAN\s*([1-4])\b/);
            if (m) { lanName=`LAN${m[1]}`; seen=true; }
          } else if (k==="status") { status=v; seen=true; }
          else if (/veloc/.test(k)) { speed=v; seen=true; }
          else if (/modo/.test(k)) { mode=v; seen=true; }
        }
        if (seen && lanName) out[lanName]={ status:norm(status), speed:norm(speed), mode:norm(mode) };
      }
    }
    DBG("readLanTableOld =>", out);
    return Object.keys(out).length ? out : null;
  };

  const findAllocatedTable = () => {
    for (const d of docs) {
      try {
        const byId = d.getElementById("Dhcp_Table") || d.querySelector("#Dhcp_Table");
        if (byId) { DBG("findAllocatedTable: found by #Dhcp_Table"); return byId; }

        const nodes = [...d.querySelectorAll("div,td,span,b,strong")];
        const hdr = nodes.find(n => /Endere(ç|c)o\s+Alocado/i.test(txt(n)));
        if (hdr) {
          DBG("findAllocatedTable: found 'Endereço Alocado' header");
          const cand = hdr.closest("table") || hdr.parentElement?.querySelector("table");
          if (cand) return cand;
        }

        const tables = [...d.querySelectorAll("table")];
        for (const t of tables) {
          const r0 = t.querySelectorAll("tr")[0];
          if (!r0) continue;
          const head = [...r0.querySelectorAll("th,td")].map(c=>txt(c).toLowerCase());
          const has = (rx)=>head.some(h=>rx.test(h));
          if (has(/mac/) && has(/\bip\b/) && has(/porta|port/)) {
            DBG("findAllocatedTable: found by headers", head);
            return t;
          }
        }
      } catch(e){}
    }
    DBGW("findAllocatedTable: not found");
    return null;
  };

  const parseDhcpTable = () => {
    const t = findAllocatedTable();
    if (!t) return null;

    const rows = [...t.querySelectorAll("tr")];
    DBG("parseDhcpTable rows=", rows.length);
    if (rows.length < 2) return { byPort: {}, list: [] };

    const head = [...rows[0].querySelectorAll("th,td")].map(c=>txt(c).toLowerCase());
    const idx = (rx) => head.findIndex(h => rx.test(h));
    const iMac = idx(/mac/);
    const iIp  = idx(/\bip\b/);
    const iHost= idx(/host|anfitri|nome/);
    const iPort= idx(/porta|port/);

    DBG("parseDhcpTable head=", head, "idx:", {iMac,iIp,iHost,iPort});

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

    DBG("parseDhcpTable list sample=", list.slice(0,5));

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

    DBG("parseDhcpTable byPort=", byPort);
    return { byPort, list };
  };

  // ===== minimal modal (mantém seu fluxo) =====
  const modal = (data) => {
    const id="__tweak_old_diag__";
    document.getElementById(id)?.remove();
    const w=document.createElement("div");
    w.id=id;
    w.style.cssText="position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;";
    w.innerHTML=`
      <div style="width:min(940px,94vw);max-height:88vh;overflow:auto;background:#fff;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.25);padding:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;">
          <div style="font-weight:900;font-size:16px;">DEBUG (ZTE OLD)</div>
          <button id="__rtold_close__" style="padding:6px 10px;border:1px solid #ddd;border-radius:10px;background:#fff;cursor:pointer;">Fechar</button>
        </div>
        <pre style="white-space:pre-wrap;font-size:12px;border:1px solid #eee;border-radius:12px;padding:10px;">${norm(JSON.stringify(data,null,2))}</pre>
      </div>`;
    (document.body||document.documentElement).appendChild(w);
    document.getElementById("__rtold_close__").onclick=()=>w.remove();
    w.addEventListener("click",e=>{ if(e.target===w) w.remove(); });
  };

  (async()=>{

    DBG("START RUN_ID=", RUN_ID);
    refreshDocs();
    DBG("DOCS INIT:", docSummary());
    logMenuSnapshot();

    const data = { pon:null, lan:null, dhcp:null };

    // === PON PATH DEBUG ===
    DBG("PON: click menu Interface de rede > Informação PON");
    const menuDoc = getLeftMenuDoc();
    DBG("menuDoc chosen:", (()=>{try{return menuDoc.location.href}catch(e){return""}})());

    // tenta clicar/expandir manualmente
    const ifRede = findMenuItem(/^\+?\-?\s*Interface\s+de\s+rede$/i, menuDoc);
    DBG("find Interface de rede =>", ifRede ? txt(ifRede) : null);
    if (ifRede) {
      const t=(ifRede.textContent||"").trim();
      if (/^\+/.test(t)) { DBG("expand Interface de rede"); ifRede.click(); await wait(250); }
    } else {
      DBGW("Interface de rede not found in menuDoc, trying global snapshot...");
      logMenuSnapshot();
    }

    const infoPon = findMenuItem(/^Informa(ç|c)ão\s+PON$/i, menuDoc);
    DBG("find Informação PON =>", infoPon ? txt(infoPon) : null);
    if (infoPon) { DBG("click Informação PON"); infoPon.click(); }
    else { DBGW("Informação PON not found, trying clickByText global"); DBG("clickByText =>", clickByText(/^Informa(ç|c)ão\s+PON$/i)); }

    await waitFor("hasPonPage", ()=>hasPonPage(), 15000, 250);
    DBG("After navigation docs:", docSummary());
    data.pon = readPonOld();
    DBG("PON RESULT =>", data.pon);

    // === LAN PATH DEBUG ===
    DBG("LAN: click menu Interface de usuário > Ethernet");
    const ifUser = findMenuItem(/^\+?\-?\s*Interface\s+de\s+usu(á|a)rio$/i, menuDoc);
    DBG("find Interface de usuário =>", ifUser ? txt(ifUser) : null);
    if (ifUser) {
      const t=(ifUser.textContent||"").trim();
      if (/^\+/.test(t)) { DBG("expand Interface de usuário"); ifUser.click(); await wait(250); }
    }

    const eth = findMenuItem(/^Ethernet$/i, menuDoc);
    DBG("find Ethernet =>", eth ? txt(eth) : null);
    if (eth) { DBG("click Ethernet"); eth.click(); }
    else { DBGW("Ethernet not found, trying clickByText"); DBG("clickByText =>", clickByText(/^Ethernet$/i)); }

    await waitFor("hasLanPage", ()=>hasLanPage(), 15000, 250);
    DBG("After LAN navigation docs:", docSummary());
    data.lan = readLanTableOld();
    DBG("LAN RESULT =>", data.lan);

    // === DHCP PATH DEBUG ===
    DBG("DHCP: click menu Rede > LAN > Servidor DHCP");
    const rede = findMenuItem(/^-?\s*Rede$/i, menuDoc);
    DBG("find Rede =>", rede ? txt(rede) : null);
    if (rede) {
      const t=(rede.textContent||"").trim();
      if (/^\+/.test(t)) { DBG("expand Rede"); rede.click(); await wait(260); }
      else DBG("Rede already expanded or neutral:", t);
    } else {
      DBGW("Rede not found in menuDoc, trying clickByText"); DBG("clickByText =>", clickByText(/^-?\s*Rede$/i));
      await wait(260);
    }

    // LAN under Rede might be "-LAN" in UI; match both
    const lan = findMenuItem(/^-?\s*LAN$/i, menuDoc);
    DBG("find LAN (under Rede) =>", lan ? txt(lan) : null);
    if (lan) {
      const t=(lan.textContent||"").trim();
      if (/^\+/.test(t)) { DBG("expand LAN"); lan.click(); await wait(260); }
      else { DBG("click LAN", t); lan.click(); await wait(350); }
    } else {
      DBGW("LAN menu not found, trying clickByText"); DBG("clickByText =>", clickByText(/^-?\s*LAN$/i));
      await wait(350);
    }

    const dhcp = findMenuItem(/^Servidor\s+DHCP$/i, menuDoc);
    DBG("find Servidor DHCP =>", dhcp ? txt(dhcp) : null);
    if (dhcp) { DBG("click Servidor DHCP"); dhcp.click(); }
    else { DBGW("Servidor DHCP not found, trying clickByText"); DBG("clickByText =>", clickByText(/^Servidor\s+DHCP$/i)); }

    await waitFor("allocatedTableExists", ()=>!!findAllocatedTable(), 20000, 250);
    DBG("After DHCP navigation docs:", docSummary());
    DBG("AllocatedTable?", !!findAllocatedTable());
    data.dhcp = parseDhcpTable();
    DBG("DHCP RESULT =>", data.dhcp);

    modal(data);

  })().catch(e=>DBGE("FATAL", e));

})();
