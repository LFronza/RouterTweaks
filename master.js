// selector.js
(()=> {
  const log = (...a)=>console.log("%c[RouterTweaks]","color:#09c;font-weight:bold",...a);

  // Tabela de roteadores (você atualiza aqui sem mexer no bookmarklet)
  const ROUTERS = [
    {
      id: "F670L_NEW",
      url: "https://raw.githubusercontent.com/LFronza/RouterTweaks/refs/heads/main/F670L.js",
      detect: () => {
        return !!document.querySelector("#mainNavigator a#internet, a#localnet, a#mgrAndDiag")
          || [...document.scripts].some(s => /menuTreeJSON/.test(s.textContent || ""));
      }
    },
    {
      id: "F670L_OLD",
      url: "https://raw.githubusercontent.com/LFronza/RouterTweaks/refs/heads/main/F670L_old.js",
      detect: () => {
        const scripts = [...document.scripts].map(s=>s.textContent||"").join("\n");
        return /ajax_response_xml_root|getCMAPIParaValue|ActiveXObject\s*\(\s*['"]Microsoft\.XMLDOM['"]/.test(scripts);
      }
    }
  ];

  // ---- Parte 3 (executor) - definido aqui e chamado depois
  window.RouterTweaks = window.RouterTweaks || {};
  window.RouterTweaks.run = function runRouterScript(scriptText, meta){
    // meta: {id,url}
    try{
      // Marca info útil
      window.RouterTweaks.router = meta;
      (0,eval)(scriptText + "\n//# sourceURL=" + meta.url);
      log("rodando:", meta.id);
    }catch(e){
      log("erro ao rodar script do roteador:", meta.id, e);
    }
  };

  // Download util
  function fetchText(url, timeoutMs=8000){
    return new Promise((resolve,reject)=>{
      const t=Date.now();
      const x=new XMLHttpRequest();
      x.open("GET", url + (url.includes("?")?"&":"?") + "t=" + t, true);
      x.onreadystatechange=()=>{
        if(x.readyState===4){
          if(x.status>=200 && x.status<300) resolve(x.responseText);
          else reject(new Error("HTTP "+x.status+" em "+url));
        }
      };
      x.onerror=()=>reject(new Error("Erro de rede em "+url));
      x.send();
      setTimeout(()=>reject(new Error("Timeout em "+url)), timeoutMs);
    });
  }

  // Detecta roteador
  let chosen = null;
  for(const r of ROUTERS){
    let ok=false;
    try{ ok = !!r.detect(); }catch(_){ ok=false; }
    if(ok){ chosen = r; break; }
  }

  if(!chosen){
    log("nenhum roteador detectado. host:", location.host, "title:", document.title);
    return;
  }

  log("detectado:", chosen.id, "→ baixando script…");

  // ---- Parte 2 baixa a Parte 3 (código do roteador) e chama o executor
  fetchText(chosen.url)
    .then(code => window.RouterTweaks.run(code, {id: chosen.id, url: chosen.url}))
    .catch(err => log("falha ao baixar script do roteador:", err));
})();
