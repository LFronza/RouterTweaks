(()=>{

  const DBG = (...a)=>console.log("[RT-OLD-MENU]", ...a);
  const DBGW = (...a)=>console.warn("[RT-OLD-MENU]", ...a);

  const norm = s => (s || "").toString().replace(/\s+/g, " ").trim();
  const txt = e => norm(e && ("innerText" in e ? e.innerText : e.textContent));

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

  const wait = ms => new Promise(r=>setTimeout(r, ms));

  const docUrl = d => { try { return d.location && d.location.href ? d.location.href : ""; } catch(e){ return ""; } };

  const pickMenuDoc = () => {
    // escolhe o doc que realmente contém os itens do menu (o teu snapshot mostrou template.gch)
    const need = [
      /Interface\s+de\s+rede/i,
      /Interface\s+de\s+usu(á|a)rio/i,
      /\bRede\b/i
    ];

    let best = null, bestScore = -1;

    for (const d of docs) {
      try {
        const body = d.body ? d.body.innerText : "";
        if (!body) continue;

        let score = 0;
        for (const rx of need) if (rx.test(body)) score++;

        // bônus se o texto tem várias linhas começando com + ou -
        const plusMinusHits = (body.match(/^[\+\-]/gm) || []).length;
        if (plusMinusHits >= 5) score += 2;
        if (/template\.gch/i.test(docUrl(d))) score += 3; // heurística do teu caso

        if (score > bestScore) { bestScore = score; best = d; }
      } catch(e){}
    }
    return { best, bestScore };
  };

  const menuItemsSample = (d) => {
    try {
      const items = [...d.querySelectorAll("a,li,div,span,td")]
        .map(n=>txt(n))
        .filter(Boolean)
        .filter(s => /Interface de rede|Interface de usu|Rede|LAN|Servidor DHCP|Informa(ç|c)ão PON|Ethernet|\+|\-/i.test(s))
        .slice(0, 80);
      return items;
    } catch(e){ return []; }
  };

  const findMenuNode = (d, rx) => {
    const nodes = [...d.querySelectorAll("a,li,div,span,td")];
    return nodes.find(n => rx.test(txt(n)));
  };

  const clickNode = (node) => {
    if (!node) return false;
    // tenta clicar no <a> mais próximo (muitos menus são td/span com <a> dentro)
    const a = node.closest("a") || node.querySelector?.("a") || node.parentElement?.querySelector?.("a");
    const target = a || node;
    try { target.click(); return true; } catch(e){ return false; }
  };

  const ensureExpanded = async (d, rx) => {
    const n = findMenuNode(d, rx);
    DBG("ensureExpanded", rx.toString(), "=>", n?txt(n):null);
    if (!n) return false;
    const t = (n.textContent || "").trim();
    if (/^\+/.test(t)) { DBG(" expand click", t); clickNode(n); await wait(250); }
    return true;
  };

  const clickMenu = async (d, rx, delay=750) => {
    const n = findMenuNode(d, rx);
    DBG("clickMenu", rx.toString(), "=>", n?txt(n):null);
    if (!n) return false;
    const ok = clickNode(n);
    await wait(delay);
    return ok;
  };

  const findAllocatedTable = () => {
    for (const d of docs) {
      try {
        const byId = d.getElementById("Dhcp_Table") || d.querySelector("#Dhcp_Table");
        if (byId) return byId;

        const hdr = [...d.querySelectorAll("div,td,span,b,strong")]
          .find(n => /Endere(ç|c)o\s+Alocado/i.test(txt(n)));
        if (hdr) {
          const t = hdr.closest("table") || hdr.parentElement?.querySelector("table") || d.querySelector("table");
          if (t) return t;
        }

        // fallback por colunas MAC/IP/Porta
        for (const t of [...d.querySelectorAll("table")]) {
          const r0 = t.querySelectorAll("tr")[0];
          if (!r0) continue;
          const head = [...r0.querySelectorAll("th,td")].map(c=>txt(c).toLowerCase());
          const has = (rx)=>head.some(h=>rx.test(h));
          if (has(/mac/) && has(/\bip\b/) && has(/porta|port/)) return t;
        }
      } catch(e){}
    }
    return null;
  };

  (async()=>{

    refreshDocs();
    DBG("DOCS:", docs.map((d,i)=>({i, url: docUrl(d), title:(d.title||"")})));

    const { best: menuDoc, bestScore } = pickMenuDoc();
    DBG("PICKED menuDoc:", menuDoc ? docUrl(menuDoc) : null, "score=", bestScore);

    if (!menuDoc) {
      DBGW("Não achei menuDoc. Me manda o print do DOM do menu (left).");
      return;
    }

    DBG("MENU ITEMS SAMPLE:", menuItemsSample(menuDoc));

    // Caminho que você quer: Interface de rede -> Rede -> LAN -> Servidor DHCP
    // (na prática, Rede é seção própria no menu, então vamos clicar nela e expandir LAN)
    await ensureExpanded(menuDoc, /^\+?\-?\s*Interface\s+de\s+rede$/i);

    // Se "Rede" aparece como "+Rede" ou "-Rede"
    await ensureExpanded(menuDoc, /^\+?\-?\s*Rede$/i);
    await clickMenu(menuDoc, /^\+?\-?\s*Rede$/i, 400);

    // LAN pode aparecer como "+LAN" ou "-LAN"
    await ensureExpanded(menuDoc, /^\+?\-?\s*LAN$/i);
    await clickMenu(menuDoc, /^\+?\-?\s*LAN$/i, 500);

    // Servidor DHCP
    await clickMenu(menuDoc, /^Servidor\s+DHCP$/i, 900);

    // Confirma se a tabela apareceu
    refreshDocs();
    const tbl = findAllocatedTable();
    DBG("AllocatedTable FOUND?", !!tbl);

    if (tbl) {
      const rows = [...tbl.querySelectorAll("tr")];
      DBG("AllocatedTable rows=", rows.length);
      const head = [...(rows[0]?.querySelectorAll("th,td")||[])].map(c=>txt(c));
      DBG("AllocatedTable head=", head);
      const sample = rows.slice(1,6).map(tr=>[...tr.querySelectorAll("td")].map(td=>txt(td)));
      DBG("AllocatedTable sample rows=", sample);
    } else {
      DBGW("Tabela não encontrada ainda. Talvez a página carregue em outro frame/doc. Vou listar docs com 'Endereço Alocado':");
      refreshDocs();
      for (const d of docs) {
        try {
          const body = d.body ? d.body.innerText : "";
          if (/Endere(ç|c)o\s+Alocado/i.test(body)) DBG("FOUND text in doc:", docUrl(d));
        } catch(e){}
      }
    }

  })();

})();
