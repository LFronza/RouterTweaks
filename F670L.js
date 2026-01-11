(()=> {
  console.log('[F670L Tweak] carregado via GitHub RAW');

  const box = document.createElement('div');
  box.textContent = 'Hello World – F670L Tweak carregado';
  box.style.cssText = `
    position:fixed;
    bottom:20px;
    right:20px;
    z-index:2147483647;
    background:#111;
    color:#0f0;
    padding:12px 16px;
    border-radius:12px;
    font-family:system-ui,Segoe UI,Arial;
    font-size:14px;
    box-shadow:0 8px 24px rgba(0,0,0,.4);
  `;
  document.body.appendChild(box);

  setTimeout(()=>box.remove(),5000);
})();
