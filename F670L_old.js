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
    const num = (s) => { const m = (s || "").toString().replace(",", ".").match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; };

    const maskMac = (s) => {
      const m = (s || "").match(/([0-9a-fA-F]{2})[:\-]([0-9a-fA-F]{2})[:\-]([0-9a-fA-F]{2})[:\-]([0-9a-fA-F]{2})[:\-]([0-9a-fA-F]{2})[:\-]([0-9a-fA-F]{2})/);
      return m ? `**:**:**:${m[4].toUpperCase()}:${m[5].toUpperCase()}:${m[6].toUpperCase()}` : null;
    };
    const maskIpLast = (s) => {
      const m = (s || "").match(/\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/);
      if (!m) return null;
      const o = [+m[1], +m[2], +m[3], +m[4]];
      if (o.some((x) => x < 0 || x > 255)) return null;
      return `*.*.*.${o[3]}`;
    };
    const bandOfSsid = (p) => {
      const m = (p || "").toUpperCase().match(/^SSID\s*([1-6])$/) || (p || "").toUpperCase().match(/^SSID([1-6])$/);
      if (!m) return null;
      const n = parseInt(m[1], 10);
      return n >= 1 && n <= 3 ? "2.4G" : "5G";
    };

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
          if (/\+Rede|\-Rede|Status|Interface de rede|Servidor DHCP|Informação PON|Interface de usuário|Ethernet/i.test(t)) score += 3;
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
          if (/ZTE|F670L/i.test(t)) score += 1;
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
      const exact = anchors.find(a => isVisible(a) && rx.test(txt(a)));
      if (exact) return exact;

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

   const readPonFromDoc = (d) => {
  if (!d) return null;

  const rows = d.querySelectorAll("tr");
  for (const tr of rows) {
    const tds = tr.querySelectorAll("td");
    if (tds.length < 2) continue;

    const label = txt(tds[0]).toLowerCase();
    if (
      label.includes("energia de entrada") ||
      label.includes("potência de entrada") ||
      label.includes("potencia de entrada")
    ) {
      const raw = txt(tds[1]).replace(",", ".");
      const m = raw.match(/-?\d+(\.\d+)?/);
      if (m) return parseFloat(m[0]);
    }
  }
  return null;
};


    const readLanFromDoc = (d) => {
      if (!d) return null;
      const out = {};
      const tables = Array.from(d.querySelectorAll("table.infor, table#TestContent, table"));
      for (const t of tables) {
        const all = txt(t);
        const m = all.match(/\bLAN\s*([1-4])\b/i);
        if (!m) continue;
        const lan = "LAN" + m[1];
        let status = null, speed = null, duplex = null;
        const trs = t.querySelectorAll("tr");
        for (const tr of trs) {
          const tds = tr.querySelectorAll("td,th");
          if (tds.length < 2) continue;
          const k = txt(tds[0]).toLowerCase();
          const v = txt(tds[tds.length - 1]);
          if (/status/.test(k)) status = v;
          else if (/velocidade|speed/.test(k)) speed = v;
          else if (/modo|duplex/.test(k)) duplex = v;
        }
        out[lan] = { status, speed, duplex, macs: [], ips: [] };
      }
      return Object.keys(out).length ? out : null;
    };

    const findDhcpTable = (d) => {
  if (!d) return null;
  const byId = d.getElementById("Dhcp_Table");
  if (byId) return byId;
  const tables = d.querySelectorAll("table");
  for (const tb of tables) {
    const th = tb.querySelectorAll("th, td");
    if (!th || !th.length) continue;
    const header = Array.from(th).slice(0, 8).map(x => txt(x).toLowerCase()).join(" | ");
    if ((header.includes("endereço mac") || header.includes("mac address")) && (header.includes("porta") || header.includes("port"))) return tb;
  }
  return null;
};

const readDhcpLeases = (d) => {
  const tb = findDhcpTable(d);
  if (!tb) return null;

  const rows = Array.from(tb.querySelectorAll("tr"));
  if (rows.length < 2) return null;

  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const tds = Array.from(rows[i].querySelectorAll("td"));
    if (tds.length < 2) continue;

    const mac = norm(txt(tds[0]));
    const ip = norm(txt(tds[1]));

    let host = "";
    if (tds.length >= 4) {
      const inp = tds[3].querySelector("input");
      host = norm(inp ? (inp.value || "") : txt(tds[3]));
    }

    const port = tds.length >= 5 ? norm(txt(tds[4])) : "";
    const portNorm = (port || "").toUpperCase().replace(/\s+/g, "");

    const macM = maskMac(mac);
    const ipM = maskIpLast(ip);

    if (!macM && !ipM && !portNorm) continue;
    out.push({ macMasked: macM, ipMasked: ipM, host, port, portNorm, band: bandOfSsid(portNorm) });
  }

  return out.length ? out : null;
};
    const groupDhcp = (leases) => {
      const byLan = {};
      const bySsid = {};
      (leases || []).forEach((x) => {
        const p = x.portNorm || "";
        const mLan = p.match(/^LAN\s*([1-4])$/i) || p.match(/^LAN([1-4])$/i);
        if (mLan) {
          const lan = "LAN" + mLan[1];
          byLan[lan] = byLan[lan] || { macs: [], ips: [], setM: new Set(), setI: new Set() };
          if (x.macMasked && !byLan[lan].setM.has(x.macMasked)) { byLan[lan].setM.add(x.macMasked); byLan[lan].macs.push(x.macMasked); }
          if (x.ipMasked && !byLan[lan].setI.has(x.ipMasked)) { byLan[lan].setI.add(x.ipMasked); byLan[lan].ips.push(x.ipMasked); }
          return;
        }
        const mS = p.match(/^SSID\s*([1-6])$/i) || p.match(/^SSID([1-6])$/i);
        if (mS) {
          const ssid = "SSID" + mS[1];
          bySsid[ssid] = bySsid[ssid] || { ssid, band: bandOfSsid(ssid) || "", count: 0, macs: [], ips: [], setM: new Set(), setI: new Set() };
          bySsid[ssid].count++;
          if (x.macMasked && !bySsid[ssid].setM.has(x.macMasked)) { bySsid[ssid].setM.add(x.macMasked); bySsid[ssid].macs.push(x.macMasked); }
          if (x.ipMasked && !bySsid[ssid].setI.has(x.ipMasked)) { bySsid[ssid].setI.add(x.ipMasked); bySsid[ssid].ips.push(x.ipMasked); }
        }
      });

      const lanArr = Object.keys(byLan).sort().map((k) => ({ lan: k, macs: byLan[k].macs, ips: byLan[k].ips }));
      const wifiArr = Object.keys(bySsid)
        .sort((a, b) => (parseInt(a.replace(/\D/g, ""), 10) || 0) - (parseInt(b.replace(/\D/g, ""), 10) || 0))
        .map((k) => ({ ssid: bySsid[k].ssid, band: bySsid[k].band, count: bySsid[k].count, macs: bySsid[k].macs, ips: bySsid[k].ips }));
      return { lan: lanArr, wifi: wifiArr };
    };

    const lanBad = (s) => {
      const t = (s || "").toLowerCase();
      if (!t) return false;
      if (/marque\s*abaixo|link\s*down|linkdown/.test(t)) return false;
      if (/half/.test(t)) return true;
      if (/\b10\b/.test(t) || /\b100\b/.test(t)) return true;
      return false;
    };

    const mkFlags = (data) => {
      const flags = [];
      if (data.pon == null) flags.push("PON: não encontrado");
      else if (data.pon > -10 || data.pon < -26) flags.push(`PON fora do esperado (-26..-10): ${data.pon} dBm`);
      if (data.lan) {
        Object.keys(data.lan).sort().forEach((k) => {
          const it = data.lan[k] || {};
          const line = [it.status || "", it.speed || "", it.duplex || ""].filter(Boolean).join(" - ");
          if (lanBad(line)) flags.push(`${k} link degradado: ${line}`);
        });
      }
      return flags;
    };

    const buildCopyReport = (data) => {
      const lines = [];
      lines.push("Resumo (ZTE OLD)");
      lines.push(`Sinal PON: ${data.pon == null ? "N/A" : data.pon + " dBm"}`);
      lines.push("");
      if (data.lan) {
        Object.keys(data.lan).sort().forEach((k) => {
          const it = data.lan[k] || {};
          const st = it.status ? norm(it.status) : "N/A";
          const extra = [];
          if (it.speed && it.speed !== "--") extra.push(norm(it.speed));
          if (it.duplex && it.duplex !== "--") extra.push(norm(it.duplex));
          lines.push(`${k}: ${st}${extra.length ? " - " + extra.join(" - ") : ""}`);
        });
      } else lines.push("LAN: N/A");
      lines.push("");
      if (data.wifi && data.wifi.length) {
        data.wifi.forEach((w) => lines.push(`${w.ssid}${w.band ? " (" + w.band + ")" : ""}: ${w.count || 0} disp`));
      } else lines.push("Wi-Fi: N/A");
      return lines.join("\n");
    };

    const modal = (data) => {
      const id = "__rt_old_modal__";
      const old = document.getElementById(id);
      if (old) old.remove();

      const flags = mkFlags(data);
      const reportCopy = buildCopyReport(data);

      const w = document.createElement("div");
      w.id = id;
      w.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;";

      const ponBad = data.pon != null && (data.pon > -10 || data.pon < -26);

      const lanHtml = data.lan
        ? '<div style="display:grid;gap:10px;">' + Object.keys(data.lan).sort().map((k) => {
            const it = data.lan[k] || {};
            const st = norm(it.status || "não encontrado");
            const meta = [];
            if (it.speed && it.speed !== "--") meta.push(norm(it.speed));
            if (it.duplex && it.duplex !== "--") meta.push(norm(it.duplex));
            const right = st + (meta.length ? " - " + meta.join(" - ") : "");
            const macs = (it.macs || []).slice(0, 24);
            const ips = (it.ips || []).slice(0, 24);
            const extra = (macs.length || ips.length)
              ? '<div style="margin-top:8px;font-size:12px;color:#444;display:grid;gap:4px;">' +
                (macs.length ? `<div><b>MACs (masc.):</b> ${macs.join(", ")}${it.macs.length > macs.length ? "…" : ""}</div>` : "") +
                (ips.length ? `<div><b>IPs (masc.):</b> ${ips.join(", ")}${it.ips.length > ips.length ? "…" : ""}</div>` : "") +
                "</div>"
              : "";
            return `<div style="border:1px solid #f1f1f1;border-radius:12px;padding:10px;">
              <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
                <div style="font-weight:900">${k}</div>
                <div style="color:${lanBad(right) ? "#b91c1c" : "#111"};text-align:right">${right}</div>
              </div>${extra}</div>`;
          }).join("") + "</div>"
        : '<div style="color:#666">não encontrado</div>';

      const wifiHtml = (data.wifi && data.wifi.length)
        ? '<div style="display:grid;gap:10px;">' + data.wifi.map((x) => {
            const macs = (x.macs || []).slice(0, 24);
            const ips = (x.ips || []).slice(0, 24);
            const extra = (macs.length || ips.length)
              ? '<div style="margin-top:8px;font-size:12px;color:#444;display:grid;gap:4px;">' +
                (macs.length ? `<div><b>MACs (masc.):</b> ${macs.join(", ")}${x.macs.length > macs.length ? "…" : ""}</div>` : "") +
                (ips.length ? `<div><b>IPs (masc.):</b> ${ips.join(", ")}${x.ips.length > ips.length ? "…" : ""}</div>` : "") +
                "</div>"
              : "";
            return `<div style="border:1px solid #f1f1f1;border-radius:12px;padding:10px;">
              <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
                <div style="font-weight:900;word-break:break-word">${x.ssid}${x.band ? " (" + x.band + ")" : ""}</div>
                <div style="text-align:right">${x.count || 0} disp</div>
              </div>${extra}</div>`;
          }).join("") + "</div>"
        : '<div style="color:#666">não encontrado</div>';

      w.innerHTML = `<div style="width:min(980px,94vw);max-height:88vh;overflow:auto;background:#fff;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.25);padding:16px 16px 12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin:0 0 10px;">
          <div style="font-weight:900;font-size:16px;">Resumo para o chamado (ZTE OLD)</div>
          <button id="__rt_old_close__" style="padding:8px 10px;border:1px solid #ddd;border-radius:10px;background:#fff;cursor:pointer;">Fechar</button>
        </div>
        <div style="display:grid;gap:10px;">
          ${flags.length
            ? `<div style="border:1px solid #fee2e2;background:#fff5f5;border-radius:12px;padding:12px;">
                <div style="font-weight:800;color:#b91c1c;margin-bottom:6px;">Pontos de atenção</div>
                <div style="display:grid;gap:4px;color:#7f1d1d">${flags.map(f => `<div>- ${f}</div>`).join("")}</div>
              </div>`
            : `<div style="border:1px solid #e5e7eb;background:#f8fafc;border-radius:12px;padding:12px;">
                <div style="font-weight:800;margin-bottom:4px;">Pontos de atenção</div>
                <div style="color:#555">Nada crítico detectado pelas regras básicas.</div>
              </div>`
          }
          <div style="border:1px solid #eee;border-radius:12px;padding:12px;text-align:center;">
            <div style="font-weight:900;font-size:15px;margin-bottom:6px;">Leitura PON</div>
            <div style="font-size:14px;"><b>Sinal PON:</b> ${data.pon == null ? `<span style="color:#666">não encontrado</span>` : `<b style="color:${ponBad ? "#b91c1c" : "#111"}">${data.pon} dBm</b>`}</div>
          </div>
          <div style="border:1px solid #eee;border-radius:12px;padding:12px;">
            <div style="font-weight:900;text-align:center;margin-bottom:10px;">LAN (Status + velocidade + duplex + MAC/IP mascarados via DHCP)</div>
            ${lanHtml}
            <div style="margin-top:8px;font-size:12px;color:#555;text-align:center;">Obs: linkdown/Marque abaixo = sem link (não é problema se não tiver nada conectado).</div>
          </div>
          <div style="border:1px solid #eee;border-radius:12px;padding:12px;">
            <div style="font-weight:900;text-align:center;margin-bottom:10px;">Wi-Fi (DHCP por SSID + MAC/IP mascarados)</div>
            ${wifiHtml}
          </div>
        </div>
        <div style="margin-top:10px;display:flex;justify-content:flex-end;gap:8px;">
          <button id="__rt_old_copy__" style="padding:8px 10px;border:0;border-radius:10px;background:#111;color:#fff;cursor:pointer;font-weight:900;">Copiar texto</button>
        </div>
      </div>`;

      (document.documentElement || document.body).appendChild(w);

      document.getElementById("__rt_old_close__").onclick = () => w.remove();
      w.addEventListener("click", (e) => { if (e.target === w) w.remove(); });

     document.getElementById("__rt_old_copy__").onclick = async () => {
  try {
    await navigator.clipboard.writeText(reportCopy);
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = reportCopy;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (_) {}
    ta.remove();
  }
};


    const goDhcpVisual = async () => {
      clickMenu(/^\+?\s*Rede\s*$/i, "Rede (toggle)");
      await sleep(350);
      clickMenu(/^\+\s*Rede\s*$/i, "Rede (+) expand");
      await sleep(350);
      clickMenu(/^\-\s*Rede\s*$/i, "Rede (-) já expandido");
      await sleep(350);

      let okLan = clickMenu(/^\-\s*LAN\s*$/i, "-LAN (grupo)");
      if (!okLan) okLan = clickMenu(/^\+?\s*LAN\s*$/i, "LAN (item/grupo)");
      await sleep(450);

      clickMenu(/Servidor\s*DHCP(?!\s*\(IPv6\))/i, "Servidor DHCP");
      await sleep(450);

      const hasDhcp = await waitContentHas(/Caminho:Rede\-LAN\-Servidor\s*DHCP|Endere[cç]o\s*Alocado|Endere[cç]o\s*MAC/i, 9000);
      return hasDhcp;
    };

    const goPonVisual = async () => {
      clickMenu(/Interface\s*de\s*rede/i, "Interface de rede");
      await sleep(350);
      clickMenu(/Inform(a|ã)ção\s*PON/i, "Informação PON");
      await sleep(450);
      const ok = await waitContentHas(/Inform(a|ã)ção\s*PON|Energia\s*de\s*entrada|Fnt_RxPower/i, 9000);
      return ok;
    };

    const goEthVisual = async () => {
      clickMenu(/Interface\s*de\s*usu(a|á)rio/i, "Interface de usuário");
      await sleep(350);
      clickMenu(/^Ethernet$/i, "Ethernet");
      await sleep(450);
      const ok = await waitContentHas(/Interface\s*de\s*usu(a|á)rio\-Ethernet|Conex(a|ã)o\s*de\s*Rede|LAN1/i, 9000);
      return ok;
    };

    (async () => {
      const data = { pon: null, lan: null, wifi: [] };

      log("PON: navegando visualmente…");
      await goPonVisual();
      await sleep(250);
      data.pon = readPonFromDoc(pickContentDoc());
      log("PON:", data.pon);

      log("LAN: navegando visualmente…");
      await goEthVisual();
      await sleep(250);
      data.lan = readLanFromDoc(pickContentDoc());
      log("LAN:", data.lan);

      log("DHCP: navegando visualmente…");
      const okDhcp = await goDhcpVisual();
      log("DHCP page ok:", okDhcp);

      let leases = null;
      if (okDhcp) {
        await sleep(250);
        leases = readDhcpLeases(pickContentDoc());
      }
      log("leases:", leases ? leases.length : null);

      const grouped = groupDhcp(leases || []);
      data.wifi = grouped.wifi || [];

      if (data.lan && grouped.lan && grouped.lan.length) {
        grouped.lan.forEach((x) => {
          if (!data.lan[x.lan]) data.lan[x.lan] = { status: null, speed: null, duplex: null, macs: [], ips: [] };
          data.lan[x.lan].macs = x.macs || [];
          data.lan[x.lan].ips = x.ips || [];
        });
      }

      modal(data);
    })().catch((e) => {
      alert("RouterTweaks OLD falhou:\n" + (e && e.message ? e.message : e));
    });
  } catch (e) {
    alert("RouterTweaks OLD falhou:\n" + (e && e.message ? e.message : e));
  }
})();
