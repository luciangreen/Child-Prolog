(function () {
  const exampleProgram = `parent(alice,bob).
parent(bob,charlie).
ancestor(X,Y) :- parent(X,Y).
ancestor(X,Y) :- parent(X,Z), ancestor(Z,Y).`;

  const exampleQuery = "ancestor(alice,charlie).";

  function boot() {
    const engine = ChildPrologEngine.createEngine();
    const programInput = document.getElementById("program");
    const queryInput = document.getElementById("query");
    const runButton = document.getElementById("run");
    const elements = {
      answer: document.getElementById("answer"),
      steps: document.getElementById("steps"),
      solutions: document.getElementById("solutions"),
      tree: document.getElementById("tree"),
      raw: document.getElementById("raw"),
    };

    programInput.value = exampleProgram;
    queryInput.value = exampleQuery;

    runButton.addEventListener("click", function () {
      const result = engine.resolve(programInput.value, queryInput.value);
      ChildPrologVisualizer.render(result, elements);
    });

    runButton.click();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
