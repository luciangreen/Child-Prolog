(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.ChildPrologVisualizer = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  function createNode(document, tree) {
    const item = document.createElement("li");
    item.textContent = tree.goal;

    if (tree.children && tree.children.length) {
      const list = document.createElement("ul");
      tree.children.forEach((child) => list.appendChild(createNode(document, child)));
      item.appendChild(list);
    }

    return item;
  }

  function renderTree(container, visual) {
    container.innerHTML = "";
    const trees = visual?.data?.proofTrees || [];

    if (!trees.length) {
      container.textContent = "No proof tree yet.";
      return;
    }

    const list = document.createElement("ul");
    trees.forEach((tree, index) => {
      const wrapper = document.createElement("li");
      wrapper.textContent = `Solution ${index + 1}`;
      const nested = document.createElement("ul");
      nested.appendChild(createNode(document, tree));
      wrapper.appendChild(nested);
      list.appendChild(wrapper);
    });
    container.appendChild(list);
  }

  function renderSolutions(container, solutions) {
    container.innerHTML = "";

    if (!solutions.length) {
      container.textContent = "No variable bindings.";
      return;
    }

    solutions.forEach((solution, index) => {
      const line = document.createElement("div");
      const parts = Object.entries(solution).map(([name, value]) => `${name} = ${value}`);
      line.textContent = `Solution ${index + 1}: ${parts.join(", ") || "true"}`;
      container.appendChild(line);
    });
  }

  function render(result, elements) {
    elements.answer.textContent = result.answer;
    elements.steps.innerHTML = "";
    result.steps.forEach((step) => {
      const item = document.createElement("li");
      item.textContent = step;
      elements.steps.appendChild(item);
    });

    renderSolutions(elements.solutions, result.solutions);
    renderTree(elements.tree, result.visual);
    elements.raw.textContent = JSON.stringify(result, null, 2);
  }

  return {
    render,
  };
});
