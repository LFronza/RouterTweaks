(function () {
  try {
    if (window.RouterTweaks && window.RouterTweaks.__F670L_OLD_RUNNING) return;
    window.RouterTweaks = window.RouterTweaks || {};
    window.RouterTweaks.__F670L_OLD_RUNNING = true;

    var norm = function (s) { return (s || "").toString().replace(/\s+/g, " ").trim(); };
    var txt = function (e) { return norm(e && ("innerText" in e ? e.innerText : e.textContent)); };
    var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var num = function (s) { var m = (s || "").toString().replace(",", ".").match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; };

    var maskMac = function (s) {
      var m = (s || "").match(/([0-9a-fA-F]{2})[:\-]([0-9a-fA-F]{2})[:\-]([0-9a-fA-F]{2})[:\-]([0-9a-fA-F]{2})[:\-]([0-9a-fA-F]{2})[:\-]([0-9a-fA-F]{2})/);
      return m ? ("**:**:**:" + m[4].toUpperCase() + ":" + m[5].toUpperCase() + ":" + m[6].toUpperCase()) : null;
    };
    var maskIpLast = function (s) {
      var m = (s || "").match(/\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/);
      if (!m) return null;
      var o = [+m[1], +m[2], +m[3], +m[4]];
      if (o.some(function (x) { return x < 0 || x > 255; })) return null;
      return "*.*.*." + o[3];
    };
    var bandOfSsidPort = function (p) {
      var m = (p || "").toUpperCase().match(/^SSID\s*([1-6])$/) || (p || "").toUpperCase().match(/^SSID([1-6])$/);
      if (!m) return null;
      var n = parseInt(m[1], 10);
      return n >= 1 && n <= 3 ? "2.4G" : "5G";
    };

    var getMainWin = function () {
      try { if (window.top && window.top.frames && window.top.frames.length) return window.top; } catch (e) {}
      try { return window.top || window; } catch (e) { return window; }
    };

    var getMainContentDoc = function () {
      var topw = getMainWin();
      try {
        if (topw && topw.frames && topw.frames.length) {
          for (var i = 0; i < topw.frames.length; i++) {
            try {
              var d = topw.frames[i].document;
              if (!d || !d.body) continue;
              var t = d.body.innerText || "";
              if (/Caminho:/i.test(t)) return d;
            } catch (e) {}
          }
        }
      } catch (e) {}
      try { return document; } catch (e) { return null; }
    };

    var waitForContentDoc = async function (timeoutMs) {
      var t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        var d = getMainContentDoc();
        if (d && d.body && (d.body.innerText || "").length > 50) return d;
        await sleep(150);
      }
      return getMainContentDoc();
    };

    var mainNavigate = function (url) {
      var topw = getMainWin();
      try {
        if (topw && topw.mainFrame && topw.mainFrame.location) { topw.mainFrame.location.href = url; return true; }
      } catch (e) {}
      try {
        if (topw && topw.frames && topw.frames.length) {
          for (var i = 0; i < topw.frames.length; i++) {
            try {
              var f = topw.frames[i];
              if (f && f.location && f.document && f.document.body) {
                var t = f.document.body.innerText || "";
                if (/Caminho:/i.test(t)) { f.location.href = url; return true; }
              }
            } catch (e) {}
          }
        }
      } catch (e) {}
      try { window.location.href = url; return true; } catch (e) {}
      return false;
    };

    var gotoNext = async function (next) {
      var u = "getpage.gch?pid=1002&next=" + encodeURIComponent(next) + "&_rt=" + Date.now();
      mainNavigate(u);
      await sleep(650);
      return waitForContentDoc(9000);
    };

    var readPon = function (d) {
      if (!d) return null;
      var el = d.getElementById("Fnt_RxPower");
      if (el) {
        var v = num(el.getAttribute("value") || el.getAttribute("title") || txt(el));
        if (v !== null && isFinite(v)) return v;
      }
      var tables = d.querySelectorAll("table");
      for (var ti = 0; ti < tables.length; ti++) {
        var trs = tables[ti].querySelectorAll("tr");
        for (var ri = 0; ri < trs.length; ri++) {
          var cells = trs[ri].querySelectorAll("td,th");
          if (cells.length < 2) continue;
          var left = txt(cells[0]).toLowerCase();
          if (!/energia.*entrada|rx\s*power|pot(ê|e)ncia.*entrada/i.test(left)) continue;
          var right = txt(cells[cells.length - 1]);
          var v2 = num(right);
          if (v2 !== null && isFinite(v2)) return v2;
        }
      }
      return null;
    };

    var readLan = function (d) {
      if (!d) return null;
      var out = {};
      var tables = d.querySelectorAll("table.infor, table#TestContent, table");
      for (var i = 0; i < tables.length; i++) {
        var t = tables[i];
        var all = txt(t);
        var m = all.match(/\bLAN\s*([1-4])\b/i);
        if (!m) continue;
        var lan = "LAN" + m[1];

        var status = null, speed = null, duplex = null;
        var trs = t.querySelectorAll("tr");
        for (var r = 0; r < trs.length; r++) {
          var tds = trs[r].querySelectorAll("td,th");
          if (tds.length < 2) continue;
          var k = txt(tds[0]).toLowerCase();
          var v = txt(tds[tds.length - 1]);
          if (/status/.test(k)) status = v;
          else if (/velocidade|speed/.test(k)) speed = v;
          else if (/modo|duplex/.test(k)) duplex = v;
        }
        out[lan] = { status: status || null, speed: speed || null, duplex: duplex || null, macs: [], ips: [] };
      }
      return Object.keys(out).length ? out : null;
    };

    var findDhcpTable = function (d) {
      if (!d) return null;
      var tables = d.querySelectorAll("table");
      for (var i = 0; i < tables.length; i++) {
        var th = tables[i].querySelectorAll("th");
        if (!th || !th.length) continue;
        var header = Array.prototype.map.call(th, function (x) { return txt(x).toLowerCase(); }).join(" | ");
        if ((header.indexOf("endereço mac") >= 0 || header.indexOf("mac address") >= 0) && (header.indexOf("porta") >= 0 || header.indexOf("port") >= 0)) return tables[i];
      }
      for (var j = 0; j < tables.length; j++) {
        var s = txt(tables[j]).toLowerCase();
        if ((s.indexOf("endereço alocado") >= 0 || s.indexOf("allocated") >= 0) && (s.indexOf("endereço mac") >= 0 || s.indexOf("mac address") >= 0)) return tables[j];
      }
      return null;
    };

    var readDhcpLeases = function (d) {
      var table = findDhcpTable(d);
      if (!table) return null;

      var rows = table.querySelectorAll("tr");
      if (!rows || rows.length < 2) return null;

      var out = [];
      for (var i = 1; i < rows.length; i++) {
        var cells = rows[i].querySelectorAll("td");
        if (!cells || cells.length < 2) continue;

        var mac = norm(txt(cells[0]));
        var ip = norm(txt(cells[1]));
        var host = cells.length >= 4 ? norm(txt(cells[3])) : "";
        var port = cells.length >= 5 ? norm(txt(cells[4])) : "";

        var macM = maskMac(mac);
        var ipM = maskIpLast(ip);
        var portNorm = (port || "").toUpperCase().replace(/\s+/g, "");

        if (!macM && !ipM && !portNorm) continue;

        out.push({ macMasked: macM, ipMasked: ipM, host: host, port: port, portNorm: portNorm, band: bandOfSsidPort(portNorm) });
      }
      return out.length ? out : null;
    };

    var groupDhcp = function (leases) {
      var byLan = {};
      var bySsid = {};
      (leases || []).forEach(function (x) {
        var p = x.portNorm || "";
        var mLan = p.match(/^LAN\s*([1-4])$/i) || p.match(/^LAN([1-4])$/i);
        if (mLan) {
          var lan = "LAN" + mLan[1];
          byLan[lan] = byLan[lan] || { macs: [], ips: [], setM: new Set(), setI: new Set() };
          if (x.macMasked && !byLan[lan].setM.has(x.macMasked)) { byLan[lan].setM.add(x.macMasked); byLan[lan].macs.push(x.macMasked); }
          if (x.ipMasked && !byLan[lan].setI.has(x.ipMasked)) { byLan[lan].setI.add(x.ipMasked); byLan[lan].ips.push(x.ipMasked); }
          return;
        }
        var mS = p.match(/^SSID\s*([1-6])$/i) || p.match(/^SSID([1-6])$/i);
        if (mS) {
          var ssid = "SSID" + mS[1];
          bySsid[ssid] = bySsid[ssid] || { ssid: ssid, band: bandOfSsidPort(ssid) || "", count: 0, macs: [], ips: [], setM: new Set(), setI: new Set() };
          bySsid[ssid].count++;
          if (x.macMasked && !bySsid[ssid].setM.has(x.macMasked)) { bySsid[ssid].setM.add(x.macMasked); bySsid[ssid].macs.push(x.macMasked); }
          if (x.ipMasked && !bySsid[ssid].setI.has(x.ipMasked)) { bySsid[ssid].setI.add(x.ipMasked); bySsid[ssid].ips.push(x.ipMasked); }
          return;
        }
      });

      var lanArr = Object.keys(byLan).sort().map(function (k) { return { lan: k, macs: byLan[k].macs, ips: byLan[k].ips }; });
      var wifiArr = Object.keys(bySsid)
        .sort(function (a, b) { return (parseInt(a.replace(/\D/g, ""), 10) || 0) - (parseInt(b.replace(/\D/g, ""), 10) || 0); })
        .map(function (k) { return { ssid: bySsid[k].ssid, band: bySsid[k].band, count: bySsid[k].count, macs: bySsid[k].macs, ips: bySsid[k].ips }; });

      return { lan: lanArr, wifi: wifiArr };
    };

    var lanBad = function (s) {
      var t = (s || "").toLowerCase();
      if (!t) return false;
      if (/marque\s*abaixo|link\s*down|linkdown/.test(t)) return false;
      if (/half/.test(t)) return true;
      if (/\b10\b/.test(t) || /\b100\b/.test(t)) return true;
      return false;
    };

    var mkFlags = function (data) {
      var flags = [];
      if (data.pon == null) flags.push("PON: não encontrado");
      else if (data.pon > -10 || data.pon < -26) flags.push("PON fora do esperado (-26..-10): " + data.pon + " dBm");

      if (data.lan) {
        Object.keys(data.lan).sort().forEach(function (k) {
          var it = data.lan[k] || {};
          var line = [it.status || "", it.speed || "", it.duplex || ""].filter(Boolean).join(" • ");
          if (lanBad(line)) flags.push(k + " link degradado: " + line);
        });
      }
      return flags;
    };

    var buildCopyReport = function (data) {
      var lines = [];
      lines.push("ZTE OLD");
      lines.push("PON: " + (data.pon == null ? "N/A" : data.pon + " dBm"));
      lines.push("");
      if (data.lan) {
        Object.keys(data.lan).sort().forEach(function (k) {
          var it = data.lan[k] || {};
          var st = it.status ? norm(it.status) : "N/A";
          var extra = [];
          if (it.speed && it.speed !== "--") extra.push(norm(it.speed));
          if (it.duplex && it.duplex !== "--") extra.push(norm(it.duplex));
          lines.push(k + ": " + st + (extra.length ? " • " + extra.join(" • ") : ""));
        });
      } else lines.push("LAN: N/A");
      lines.push("");
      if (data.wifi && data.wifi.length) {
        data.wifi.forEach(function (w) { lines.push(w.ssid + (w.band ? " (" + w.band + ")" : "") + ": " + (w.count || 0) + " disp"); });
      } else lines.push("Wi-Fi: N/A");
      return lines.join("\n");
    };

    var modal = function (data) {
      var id = "__rt_old_modal__";
      var old = document.getElementById(id);
      if (old) old.remove();

      var flags = mkFlags(data);
      var reportCopy = buildCopyReport(data);
      var w = document.createElement("div");
      w.id = id;
      w.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;";

      var ponOk = data.pon != null && !(data.pon > -10 || data.pon < -26);

      var lanHtml = "";
      if (data.lan) {
        lanHtml = '<div style="display:grid;gap:10px;">' + Object.keys(data.lan).sort().map(function (k) {
          var it = data.lan[k] || {};
          var st = norm(it.status || "não encontrado");
          var meta = [];
          if (it.speed && it.speed !== "--") meta.push(norm(it.speed));
          if (it.duplex && it.duplex !== "--") meta.push(norm(it.duplex));
          var right = st + (meta.length ? " • " + meta.join(" • ") : "");
          var extra = "";
          var macs = (it.macs || []).slice(0, 24);
          var ips = (it.ips || []).slice(0, 24);
          if (macs.length || ips.length) {
            extra = '<div style="margin-top:8px;font-size:12px;color:#444;display:grid;gap:4px;">' +
              (macs.length ? "<div><b>MACs (masc.):</b> " + macs.join(", ") + (it.macs.length > macs.length ? "…" : "") + "</div>" : "") +
              (ips.length ? "<div><b>IPs (masc.):</b> " + ips.join(", ") + (it.ips.length > ips.length ? "…" : "") + "</div>" : "") +
              "</div>";
          }
          return '<div style="border:1px solid #f1f1f1;border-radius:12px;padding:10px;">' +
            '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">' +
            '<div style="font-weight:900">' + k + '</div>' +
            '<div style="color:' + (lanBad(right) ? "#b91c1c" : "#111") + ';text-align:right">' + right + '</div>' +
            '</div>' + extra + '</div>';
        }).join("") + "</div>";
      } else lanHtml = '<div style="color:#666">não encontrado</div>';

      var wifiHtml = "";
      if (data.wifi && data.wifi.length) {
        wifiHtml = '<div style="display:grid;gap:10px;">' + data.wifi.map(function (x) {
          var macs = (x.macs || []).slice(0, 24);
          var ips = (x.ips || []).slice(0, 24);
          var extra = "";
          if (macs.length || ips.length) {
            extra = '<div style="margin-top:8px;font-size:12px;color:#444;display:grid;gap:4px;">' +
              (macs.length ? "<div><b>MACs (masc.):</b> " + macs.join(", ") + (x.macs.length > macs.length ? "…" : "") + "</div>" : "") +
              (ips.length ? "<div><b>IPs (masc.):</b> " + ips.join(", ") + (x.ips.length > ips.length ? "…" : "") + "</div>" : "") +
              "</div>";
          }
          return '<div style="border:1px solid #f1f1f1;border-radius:12px;padding:10px;">' +
            '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">' +
            '<div style="font-weight:900;word-break:break-word">' + x.ssid + (x.band ? " (" + x.band + ")" : "") + '</div>' +
            '<div style="color:#111;text-align:right">' + (x.count || 0) + " disp</div>" +
            '</div>' + extra + '</div>';
        }).join("") + "</div>";
      } else wifiHtml = '<div style="color:#666">não encontrado</div>';

      w.innerHTML =
        '<div style="width:min(980px,94vw);max-height:88vh;overflow:auto;background:#fff;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.25);padding:16px 16px 12px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin:0 0 10px;">' +
        '<div style="font-weight:900;font-size:16px;">Resumo para o chamado (ZTE OLD)</div>' +
        '<button id="__rt_old_close__" style="padding:8px 10px;border:1px solid #ddd;border-radius:10px;background:#fff;cursor:pointer;">Fechar</button>' +
        '</div>' +
        '<div style="display:grid;gap:10px">' +
        (flags.length
          ? '<div style="border:1px solid #fee2e2;background:#fff5f5;border-radius:12px;padding:12px;">' +
            '<div style="font-weight:800;color:#b91c1c;margin-bottom:6px;">Pontos de atenção</div>' +
            '<div style="display:grid;gap:4px;color:#7f1d1d">' + flags.map(function (f) { return "<div>• " + f + "</div>"; }).join("") + "</div></div>"
          : '<div style="border:1px solid #e5e7eb;background:#f8fafc;border-radius:12px;padding:12px;">' +
            '<div style="font-weight:800;margin-bottom:4px;">Pontos de atenção</div><div style="color:#555">Nada crítico detectado pelas regras básicas.</div></div>') +
        '<div style="border:1px solid #eee;border-radius:12px;padding:12px;text-align:center;">' +
        '<div style="font-weight:900;font-size:15px;margin-bottom:6px;">Leitura PON</div>' +
        '<div style="font-size:14px;"><b>Sinal PON:</b> ' +
        (data.pon == null ? '<span style="color:#666">não encontrado</span>' : '<b style="color:' + (ponOk ? "#111" : "#b91c1c") + '">' + data.pon + " dBm</b>") +
        '</div></div>' +
        '<div style="border:1px solid #eee;border-radius:12px;padding:12px;">' +
        '<div style="font-weight:900;text-align:center;margin-bottom:10px;">LAN (Status + velocidade + duplex + MAC/IP mascarados via DHCP)</div>' +
        lanHtml +
        '<div style="margin-top:8px;font-size:12px;color:#555;text-align:center;">Obs: linkdown/Marque abaixo = sem link (não é problema se não tiver nada conectado).</div>' +
        '</div>' +
        '<div style="border:1px solid #eee;border-radius:12px;padding:12px;">' +
        '<div style="font-weight:900;text-align:center;margin-bottom:10px;">Wi-Fi (DHCP por SSID + MAC/IP mascarados)</div>' +
        wifiHtml +
        '</div>' +
        '</div>' +
        '<div style="margin-top:10px;display:flex;justify-content:flex-end;gap:8px;">' +
        '<button id="__rt_old_copy__" style="padding:8px 10px;border:0;border-radius:10px;background:#111;color:#fff;cursor:pointer;font-weight:900;">Copiar texto</button>' +
        '</div>' +
        '</div>';

      (document.documentElement || document.body).appendChild(w);

      var closeBtn = document.getElementById("__rt_old_close__");
      if (closeBtn) closeBtn.onclick = function () { w.remove(); };
      w.addEventListener("click", function (e) { if (e.target === w) w.remove(); });

      var copyBtn = document.getElementById("__rt_old_copy__");
      if (copyBtn) {
        copyBtn.onclick = async function () {
          try { await navigator.clipboard.writeText(reportCopy); }
          catch (e) { prompt("Copie o texto:", reportCopy); }
        };
      }
    };

    window.RouterTweaks.goto = gotoNext;

    (async function () {
      var data = { pon: null, lan: null, wifi: [] };

      var dPon = await gotoNext("poninfo");
      data.pon = readPon(dPon);
      if (data.pon == null) {
        var dPon2 = await gotoNext("pon_status");
        data.pon = readPon(dPon2);
      }

      var dEth = await gotoNext("eth_status");
      data.lan = readLan(dEth);
      if (!data.lan) {
        var dEth2 = await gotoNext("lan_status");
        data.lan = readLan(dEth2);
      }

      var dDhcp = await gotoNext("dhcp_server");
      var leases = readDhcpLeases(dDhcp);
      if (!leases) {
        var dDhcp2 = await gotoNext("dhcpser");
        leases = readDhcpLeases(dDhcp2);
      }
      var grouped = groupDhcp(leases || []);
      data.wifi = grouped.wifi || [];

      if (data.lan && grouped.lan && grouped.lan.length) {
        grouped.lan.forEach(function (x) {
          if (!data.lan[x.lan]) data.lan[x.lan] = { status: null, speed: null, duplex: null, macs: [], ips: [] };
          data.lan[x.lan].macs = x.macs || [];
          data.lan[x.lan].ips = x.ips || [];
        });
      }

      modal(data);
    })().catch(function (e) {
      alert("RouterTweaks OLD falhou:\n" + (e && e.message ? e.message : e));
    });
  } catch (e) {
    alert("RouterTweaks OLD falhou:\n" + (e && e.message ? e.message : e));
  }
})();
