(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.ChildPrologVisualizer = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  function createNode(document, tree) {
    const item = document.createElement("li");

    if (tree.children && tree.children.length) {
      const details = document.createElement("details");
      details.open = true;
      const summary = document.createElement("summary");
      summary.textContent = tree.goal;
      details.appendChild(summary);
      const list = document.createElement("ul");
      tree.children.forEach((child) => list.appendChild(createNode(document, child)));
      details.appendChild(list);
      item.appendChild(details);
    } else {
      item.textContent = tree.goal;
    }

    return item;
  }

  function renderTree(container, visual) {
    container.innerHTML = "";
    const trees = visual?.data?.proofTrees || visual?.data?.derivationTrees || [];

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

  function renderGraph(container, visualData) {
    container.innerHTML = "";
    const beforeEdges = visualData?.before?.edges || [];
    const afterEdges = visualData?.after?.edges || [];
    const addedEdges = visualData?.addedEdges || [];

    const beforeTitle = document.createElement("div");
    beforeTitle.textContent = "Before:";
    container.appendChild(beforeTitle);

    const beforeList = document.createElement("ul");
    if (!beforeEdges.length) {
      const emptyItem = document.createElement("li");
      emptyItem.textContent = "No edges.";
      beforeList.appendChild(emptyItem);
    } else {
      beforeEdges.forEach((edge) => {
        const item = document.createElement("li");
        item.textContent = `${edge.from} → ${edge.to}`;
        beforeList.appendChild(item);
      });
    }
    container.appendChild(beforeList);

    const afterTitle = document.createElement("div");
    afterTitle.textContent = "After:";
    container.appendChild(afterTitle);

    const afterList = document.createElement("ul");
    if (!afterEdges.length) {
      const emptyItem = document.createElement("li");
      emptyItem.textContent = "No edges.";
      afterList.appendChild(emptyItem);
    } else {
      afterEdges.forEach((edge) => {
        const item = document.createElement("li");
        item.textContent = `${edge.from} → ${edge.to}`;
        afterList.appendChild(item);
      });
    }
    container.appendChild(afterList);

    const addedTitle = document.createElement("div");
    addedTitle.textContent = "Added edges:";
    container.appendChild(addedTitle);

    const addedList = document.createElement("ul");
    if (!addedEdges.length) {
      const emptyItem = document.createElement("li");
      emptyItem.textContent = "No new edges.";
      addedList.appendChild(emptyItem);
    } else {
      addedEdges.forEach((edge) => {
        const item = document.createElement("li");
        item.textContent = `${edge.from} → ${edge.to}`;
        addedList.appendChild(item);
      });
    }
    container.appendChild(addedList);
  }

  function renderCompression(container, visualData) {
    container.innerHTML = "";
    const compression = visualData?.compression;
    const generatedProgram = visualData?.generatedProgram;
    const sampleTrace = visualData?.sampleTrace;

    if (generatedProgram) {
      const heading = document.createElement("div");
      heading.textContent = "Generated Prolog:";
      container.appendChild(heading);

      const programBlock = document.createElement("pre");
      programBlock.textContent = generatedProgram;
      container.appendChild(programBlock);

      if (sampleTrace?.comparisons?.length) {
        const traceHeading = document.createElement("div");
        traceHeading.textContent = `Sample trace for [${sampleTrace.list.join(", ")}]:`;
        container.appendChild(traceHeading);

        const traceList = document.createElement("ul");
        sampleTrace.comparisons.forEach((line) => {
          const item = document.createElement("li");
          item.textContent = line;
          traceList.appendChild(item);
        });
        container.appendChild(traceList);
      }

      return;
    }

    if (!compression) {
      container.textContent = "No compression pattern for this query.";
      return;
    }

    const heading = document.createElement("div");
    heading.textContent = `sum_to(${compression.n}) = ${compression.sum}`;
    container.appendChild(heading);

    const details = document.createElement("details");
    details.open = true;
    const summary = document.createElement("summary");
    summary.textContent = "Show recursive expansion";
    details.appendChild(summary);

    const lines = document.createElement("ul");
    compression.expansion.forEach((line) => {
      const item = document.createElement("li");
      item.textContent = line;
      lines.appendChild(item);
    });

    const finalLine = document.createElement("li");
    finalLine.textContent = compression.finalExpansion;
    lines.appendChild(finalLine);

    details.appendChild(lines);
    container.appendChild(details);

    const compressed = document.createElement("div");
    compressed.textContent = `${compression.compressedRule} | ${compression.formula}`;
    container.appendChild(compressed);
  }

  function renderTrace(container, result) {
    container.innerHTML = "";
    const lines = result?.steps || [];

    if (!lines.length) {
      container.textContent = "No trace steps yet.";
      return;
    }

    const ordered = document.createElement("ol");
    lines.forEach((line) => {
      const item = document.createElement("li");
      item.textContent = line;
      ordered.appendChild(item);
    });
    container.appendChild(ordered);
  }

  function renderTable(container, result) {
    container.innerHTML = "";
    const visualData = result?.visual?.data || {};

    if (Array.isArray(visualData.differences) && visualData.differences.length) {
      const table = document.createElement("table");
      const body = document.createElement("tbody");

      visualData.differences.forEach((row, index) => {
        const tr = document.createElement("tr");
        const label = document.createElement("th");
        label.textContent = index === 0 ? "Sequence" : `Difference ${index}`;
        tr.appendChild(label);
        row.forEach((value) => {
          const td = document.createElement("td");
          td.textContent = String(value);
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });

      table.appendChild(body);
      container.appendChild(table);
      return;
    }

    if (Array.isArray(result?.solutions) && result.solutions.length) {
      const keys = Array.from(
        result.solutions.reduce((set, solution) => {
          Object.keys(solution).forEach((key) => set.add(key));
          return set;
        }, new Set())
      );

      if (!keys.length) {
        container.textContent = "No tabular values for this query.";
        return;
      }

      const table = document.createElement("table");
      const headRow = document.createElement("tr");
      keys.forEach((key) => {
        const th = document.createElement("th");
        th.textContent = key;
        headRow.appendChild(th);
      });
      table.appendChild(headRow);

      result.solutions.forEach((solution) => {
        const row = document.createElement("tr");
        keys.forEach((key) => {
          const td = document.createElement("td");
          td.textContent = solution[key] || "";
          row.appendChild(td);
        });
        table.appendChild(row);
      });
      container.appendChild(table);
      return;
    }

    container.textContent = "No table data for this query.";
  }

  function renderFormula(container, result) {
    container.innerHTML = "";
    const visualData = result?.visual?.data || {};
    const compression = visualData.compression;
    const lines = [];

    if (visualData.formula) {
      lines.push(`a(N) = ${visualData.formula}`);
    }

    if (compression?.compressedRule) {
      lines.push(compression.compressedRule);
    }

    if (compression?.formula) {
      lines.push(compression.formula);
    }

    if (!lines.length) {
      container.textContent = "No formula for this query.";
      return;
    }

    const list = document.createElement("ul");
    lines.forEach((line) => {
      const item = document.createElement("li");
      item.textContent = line;
      list.appendChild(item);
    });
    container.appendChild(list);
  }

  function renderSemantic(container, mode, result) {
    if (mode === "graph") {
      if (result.visual?.type === "graph") {
        renderGraph(container, result.visual?.data);
      } else {
        container.innerHTML = "Graph view is available for graph/world transformation queries.";
      }
      return;
    }

    if (mode === "table") {
      renderTable(container, result);
      return;
    }

    if (mode === "formula") {
      renderFormula(container, result);
      return;
    }

    if (mode === "trace") {
      renderTrace(container, result);
      return;
    }

    if (mode === "tree") {
      renderTree(container, result.visual);
      return;
    }

    container.textContent = "Unknown mode.";
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
    if (elements.semantic) {
      const mode = elements.semanticMode?.value || "tree";
      renderSemantic(elements.semantic, mode, result);
    } else if (elements.tree) {
      if (result.visual?.type === "graph") {
        renderGraph(elements.tree, result.visual?.data);
      } else {
        renderTree(elements.tree, result.visual);
      }
    }
    if (elements.compression) {
      renderCompression(elements.compression, result.visual?.data);
    }
    elements.raw.textContent = JSON.stringify(result, null, 2);
  }

  return {
    render,
  };
});
