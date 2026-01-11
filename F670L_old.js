(()=>{

  if (window.RouterTweaks && window.RouterTweaks.__F670L_OLD_RUNNING) return;

  window.RouterTweaks = window.RouterTweaks || {};
  window.RouterTweaks.__F670L_OLD_RUNNING = true;

  try {

    var DOC = null;

    if (
      window.frames &&
      window.frames.mainFrame &&
      window.frames.mainFrame.document
    ) {
      DOC = window.frames.mainFrame.document;
    } else {
      DOC = document;
    }

    alert("Hello World - ZTE OLD");

    console.log(
      "[RouterTweaks OLD] Hello World executado",
      DOC.location ? DOC.location.href : ""
    );

  } catch (e) {
    console.error("[RouterTweaks OLD] erro", e);
  }

})();
