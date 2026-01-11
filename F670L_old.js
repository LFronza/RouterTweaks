(function () {
  try {
    // Documento correto da interface antiga
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

    // Prova de execução
    alert("Hello World - ZTE OLD");

    console.log(
      "[RouterTweaks OLD] Hello World executado",
      DOC.location ? DOC.location.href : "sem location"
    );

  } catch (e) {
    console.error("[RouterTweaks OLD] erro no Hello World", e);
    alert("Erro ao executar Hello World (OLD)");
  }
})();
