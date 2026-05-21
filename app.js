(function () {
  const exampleProgram = `sum_to(0,0).
sum_to(N,Sum) :-
  N > 0,
  N1 is N - 1,
  sum_to(N1,Prev),
  Sum is N + Prev.`;

  const exampleQuery = "sum_to(5,S).";

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
      compression: document.getElementById("compression"),
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
