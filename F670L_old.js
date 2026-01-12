(function () {
  try {
    if (window.RouterTweaks && window.RouterTweaks.__F670L_OLD_RUNNING) return;
    window.RouterTweaks = window.RouterTweaks || {};
    window.RouterTweaks.__F670L_OLD_RUNNING = true;

    const RUN = Date.now().toString(36) + "_" + Math.random().toString(16).slice(2);
    const log = (...a) => console.log(`[RT-OLD][${RUN}]`, ...a);
    const warn = (...a) => console.warn(`[RT-OLD][${RUN}]`, ...a);
    const norm = (s) => (s || "").toString().replace(/\s+/g, " ").trim();
    const txt = (e) => norm(e && ("innerText" in e ? e.innerText : e.textContent));
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const getFrames = () => {
      const out = [];
      try {
        const t = window.top || window;
        if (t && t.frames && t.frames.length) {
          for (let i = 0; i < t.frames.length; i++) {
            try {
              const f = t.frames[i];
              const d = f.document;
              if (d && d.documentElement) out.push({ i, f, d, url: String(f.location), title: d.title || "" });
            } catch (e) {}
          }
        }
      } catch (e) {}
      try { out.push({ i: -1, f: window, d: document, url: String(location), title: document.title || "" }); } catch (e) {}
      return out;
    };

    const pickMenuDoc = () => {
      const fr = getFrames();
      let best = null, bestScore = -1;
      for (const x of fr) {
        const d = x.d;
        let score = 0;
        try {
          const a = d.querySelectorAll("a").length;
          const t = (d.body && d.body.innerText) ? d.body.innerText : "";
          if (a > 20) score += 2;
          if (/\+Rede|\-Rede|Status|Interface de rede|Servidor DHCP/i.test(t)) score += 3;
          if (d.querySelector("table") && a > 10) score += 1;
        } catch (e) {}
        if (score > bestScore) { bestScore = score; best = x; }
      }
      return best ? best.d : null;
    };

    const pickContentDoc = () => {
      const fr = getFrames();
      let best = null, bestScore = -1;
      for (const x of fr) {
        const d = x.d;
        let score = 0;
        try {
          const t = (d.body && d.body.innerText) ? d.body.innerText : "";
          if (/Caminho:/i.test(t)) score += 5;
          if (/ZTE/i.test(t)) score += 1;
          if (d.querySelector("table") && t.length > 200) score += 1;
        } catch (e) {}
        if (score > bestScore) { bestScore = score; best = x; }
      }
      return best ? best.d : null;
    };

    const isVisible = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };

    const clickEl = (el) => {
      if (!el) return false;
      try { el.scrollIntoView({ block: "center", inline: "nearest" }); } catch (e) {}
      try { el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window })); return true; } catch (e) {}
      try { el.click(); return true; } catch (e) {}
      return false;
    };

    const findMenuItem = (menuDoc, rx) => {
      if (!menuDoc) return null;

      const anchors = Array.from(menuDoc.querySelectorAll("a"));
      const exact = anchors.filter(a => isVisible(a) && rx.test(txt(a)));
      if (exact.length) return exact[0];

      // alguns firmwares colocam o texto no TD e o clique no <tr> ou <td>
      const cells = Array.from(menuDoc.querySelectorAll("td,div,span"));
      const hit = cells.find(e => isVisible(e) && rx.test(txt(e)) && (e.onclick || e.getAttribute("onclick")));
      if (hit) return hit;

      // fallback: qualquer elemento clicável com o texto
      const any = Array.from(menuDoc.querySelectorAll("a,td,tr,div,span,li"))
        .find(e => isVisible(e) && rx.test(txt(e)) && (e.tagName === "A" || e.onclick || e.getAttribute("onclick")));
      return any || null;
    };

    const clickMenu = (rx, label) => {
      const menuDoc = pickMenuDoc();
      if (!menuDoc) { warn("menuDoc não encontrado"); return false; }
      const el = findMenuItem(menuDoc, rx);
      if (!el) { warn("clickMenu não achou:", label || rx); return false; }
      log("clickMenu:", label || rx, "->", txt(el));
      return clickEl(el);
    };

    const waitContentHas = async (rx, timeoutMs = 9000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        const cd = pickContentDoc();
        const t = cd && cd.body ? (cd.body.innerText || "") : "";
        if (rx.test(t)) return true;
        await sleep(200);
      }
      return false;
    };

    const dumpMenuSample = () => {
      const menuDoc = pickMenuDoc();
      if (!menuDoc) { warn("dumpMenuSample: sem menuDoc"); return; }
      const items = Array.from(menuDoc.querySelectorAll("a,td,span,div"))
        .map(e => txt(e))
        .filter(t => t && (t.includes("Rede") || t.includes("LAN") || t.includes("DHCP") || t.includes("Interface") || t.includes("Status")))
        .slice(0, 80);
      log("MENU SAMPLE:", items);
    };

    const run = async () => {
      log("START");
      dumpMenuSample();

      // Sequência VISUAL para chegar no DHCP Server:
      // 1) expandir "+Rede" (se estiver recolhido)
      // 2) clicar "-LAN" (ou "LAN" dentro de Rede)
      // 3) clicar "Servidor DHCP"
      //
      // Observação: às vezes o menu tem "+Rede" (recolhido) e depois "-Rede" (expandido).
      // Vamos tentar ambos.

      // garante que Rede está expandido
      clickMenu(/^\+?\s*Rede\s*$/i, "Rede (toggle)");
      await sleep(350);
      clickMenu(/^\+\s*Rede\s*$/i, "Rede (+) expand");
      await sleep(350);
      clickMenu(/^\-\s*Rede\s*$/i, "Rede (-) já expandido");
      await sleep(350);

      // agora tenta LAN dentro de Rede
      // dependendo do firmware aparece como "-LAN" (grupo) ou só "LAN"
      let okLan = clickMenu(/^\-\s*LAN\s*$/i, "-LAN (grupo)");
      if (!okLan) okLan = clickMenu(/^\+?\s*LAN\s*$/i, "LAN (item/grupo)");
      await sleep(450);

      // tenta Servidor DHCP
      let okDhcp = clickMenu(/Servidor\s*DHCP/i, "Servidor DHCP");
      await sleep(450);

      // valida no conteúdo
      // a página costuma mostrar "Caminho:Rede-LAN-Servidor DHCP" ou ter "Endereço Alocado"
      const hasDhcp = await waitContentHas(/Servidor\s*DHCP|Endere[cç]o\s*Alocado|Endere[cç]o\s*MAC/i, 9000);
      log("DHCP content detected:", hasDhcp);

      if (!hasDhcp) {
        warn("Não consegui confirmar DHCP no conteúdo. Vou tentar variações de clique…");

        // variações comuns: em alguns menus o caminho é Rede > LAN > (Serviços) > Servidor DHCP
        clickMenu(/^\+?\s*Rede\s*$/i, "Rede (toggle retry)");
        await sleep(350);

        clickMenu(/^\-\s*LAN\s*$/i, "-LAN retry");
        await sleep(350);

        // às vezes o item aparece como "Servidor DHCP (IPv6)" primeiro; tenta DHCP sem IPv6
        okDhcp = clickMenu(/^Servidor\s*DHCP\s*$/i, "Servidor DHCP (exato)");
        if (!okDhcp) okDhcp = clickMenu(/Servidor\s*DHCP(?!\s*\(IPv6\))/i, "Servidor DHCP (sem IPv6)");
        await sleep(450);

        const hasDhcp2 = await waitContentHas(/Servidor\s*DHCP|Endere[cç]o\s*Alocado|Endere[cç]o\s*MAC/i, 9000);
        log("DHCP content detected (retry):", hasDhcp2);
      }

      log("END (debug navegação DHCP)");
    };

    run().catch(e => alert("RT-OLD falhou:\n" + (e && e.message ? e.message : e)));
  } catch (e) {
    alert("RT-OLD falhou:\n" + (e && e.message ? e.message : e));
  }
})();
