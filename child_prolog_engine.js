(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.ChildPrologEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  function createEngine(options = {}) {
    const settings = {
      maxDepth: options.maxDepth || 30,
      maxSolutions: options.maxSolutions || 20,
      maxNodes: options.maxNodes || 1000,
    };

    function splitTopLevel(text, delimiter) {
      const parts = [];
      let current = "";
      let roundDepth = 0;
      let squareDepth = 0;

      for (let index = 0; index < text.length; index += 1) {
        const character = text[index];

        if (character === "(") {
          roundDepth += 1;
        } else if (character === ")") {
          roundDepth -= 1;
        } else if (character === "[") {
          squareDepth += 1;
        } else if (character === "]") {
          squareDepth -= 1;
        }

        if (character === delimiter && roundDepth === 0 && squareDepth === 0) {
          parts.push(current.trim());
          current = "";
          continue;
        }

        current += character;
      }

      if (current.trim()) {
        parts.push(current.trim());
      }

      return parts;
    }

    function splitStatements(source) {
      const statements = [];
      let current = "";
      let roundDepth = 0;
      let squareDepth = 0;

      for (let index = 0; index < source.length; index += 1) {
        const character = source[index];

        if (character === "(") {
          roundDepth += 1;
        } else if (character === ")") {
          roundDepth -= 1;
        } else if (character === "[") {
          squareDepth += 1;
        } else if (character === "]") {
          squareDepth -= 1;
        }

        if (character === "." && roundDepth === 0 && squareDepth === 0) {
          const statement = current.trim();
          if (statement) {
            statements.push(statement);
          }
          current = "";
          continue;
        }

        current += character;
      }

      const trailing = current.trim();
      if (trailing) {
        statements.push(trailing);
      }

      return statements;
    }

    function createParser() {
      let anonymousCounter = 0;

      function parseTerm(rawText) {
        const text = rawText.trim();

        if (!text) {
          throw new Error("Cannot parse an empty term.");
        }

        if (/^-?\d+$/.test(text)) {
          return { type: "number", value: Number(text) };
        }

        if (text === "[]") {
          return { type: "list", items: [] };
        }

        if (text.startsWith("[") && text.endsWith("]")) {
          const inner = text.slice(1, -1).trim();
          return {
            type: "list",
            items: inner ? splitTopLevel(inner, ",").map(parseTerm) : [],
          };
        }

        if (text === "_" || /^[A-Z_]/.test(text)) {
          return {
            type: "var",
            name: text === "_" ? `_anon${anonymousCounter += 1}` : text,
          };
        }

        const firstParen = text.indexOf("(");
        if (firstParen !== -1 && text.endsWith(")")) {
          const functor = text.slice(0, firstParen).trim();
          const inner = text.slice(firstParen + 1, -1).trim();
          return {
            type: "compound",
            functor,
            args: inner ? splitTopLevel(inner, ",").map(parseTerm) : [],
          };
        }

        return { type: "atom", value: text };
      }

      return { parseTerm };
    }

    function parseClause(statement) {
      const parser = createParser();
      if (statement.includes(":-")) {
        const [headText, bodyText] = statement.split(":-");
        return {
          head: parser.parseTerm(headText),
          body: splitTopLevel(bodyText, ",").map(parser.parseTerm),
        };
      }

      return {
        head: parser.parseTerm(statement),
        body: [],
      };
    }

    function parseProgram(source) {
      return splitStatements(source).map(parseClause);
    }

    function parseQuery(source) {
      const trimmed = source.trim().replace(/^\?\-\s*/, "").replace(/^query:\s*/i, "");
      const normalized = trimmed.endsWith(".") ? trimmed.slice(0, -1) : trimmed;
      return createParser().parseTerm(normalized);
    }

    function freshenTerm(term, suffix) {
      if (term.type === "var") {
        return { type: "var", name: `${term.name}__${suffix}` };
      }

      if (term.type === "compound") {
        return {
          type: "compound",
          functor: term.functor,
          args: term.args.map((arg) => freshenTerm(arg, suffix)),
        };
      }

      if (term.type === "list") {
        return {
          type: "list",
          items: term.items.map((item) => freshenTerm(item, suffix)),
        };
      }

      return JSON.parse(JSON.stringify(term));
    }

    function freshenClause(clause, suffix) {
      return {
        head: freshenTerm(clause.head, suffix),
        body: clause.body.map((goal) => freshenTerm(goal, suffix)),
      };
    }

    function dereference(term, bindings) {
      let resolved = term;
      while (resolved && resolved.type === "var" && bindings[resolved.name]) {
        resolved = bindings[resolved.name];
      }
      return resolved;
    }

    function cloneBindings(bindings) {
      return { ...bindings };
    }

    function bindVariable(variable, value, bindings) {
      const nextBindings = cloneBindings(bindings);
      nextBindings[variable.name] = value;
      return nextBindings;
    }

    function unify(left, right, bindings) {
      const resolvedLeft = dereference(left, bindings);
      const resolvedRight = dereference(right, bindings);

      if (resolvedLeft.type === "var") {
        return bindVariable(resolvedLeft, resolvedRight, bindings);
      }

      if (resolvedRight.type === "var") {
        return bindVariable(resolvedRight, resolvedLeft, bindings);
      }

      if (resolvedLeft.type !== resolvedRight.type) {
        return null;
      }

      if (resolvedLeft.type === "atom") {
        return resolvedLeft.value === resolvedRight.value ? bindings : null;
      }

      if (resolvedLeft.type === "number") {
        return resolvedLeft.value === resolvedRight.value ? bindings : null;
      }

      if (resolvedLeft.type === "list") {
        if (resolvedLeft.items.length !== resolvedRight.items.length) {
          return null;
        }

        let nextBindings = bindings;
        for (let index = 0; index < resolvedLeft.items.length; index += 1) {
          nextBindings = unify(resolvedLeft.items[index], resolvedRight.items[index], nextBindings);
          if (!nextBindings) {
            return null;
          }
        }
        return nextBindings;
      }

      if (
        resolvedLeft.functor !== resolvedRight.functor ||
        resolvedLeft.args.length !== resolvedRight.args.length
      ) {
        return null;
      }

      let nextBindings = bindings;
      for (let index = 0; index < resolvedLeft.args.length; index += 1) {
        nextBindings = unify(resolvedLeft.args[index], resolvedRight.args[index], nextBindings);
        if (!nextBindings) {
          return null;
        }
      }
      return nextBindings;
    }

    function substitute(term, bindings) {
      const resolved = dereference(term, bindings);

      if (resolved.type === "compound") {
        return {
          type: "compound",
          functor: resolved.functor,
          args: resolved.args.map((arg) => substitute(arg, bindings)),
        };
      }

      if (resolved.type === "list") {
        return {
          type: "list",
          items: resolved.items.map((item) => substitute(item, bindings)),
        };
      }

      return resolved;
    }

    function termToString(term) {
      if (term.type === "atom") {
        return term.value;
      }

      if (term.type === "number") {
        return String(term.value);
      }

      if (term.type === "var") {
        return term.name.replace(/__\d+$/, "");
      }

      if (term.type === "list") {
        return `[${term.items.map(termToString).join(",")}]`;
      }

      return `${term.functor}(${term.args.map(termToString).join(",")})`;
    }

    function clauseToString(clause) {
      if (!clause.body.length) {
        return `${termToString(clause.head)}.`;
      }

      return `${termToString(clause.head)} :- ${clause.body.map(termToString).join(", ")}.`;
    }

    function collectQueryVariables(term, bucket = new Set()) {
      if (term.type === "var") {
        bucket.add(term.name);
        return bucket;
      }

      if (term.type === "compound") {
        term.args.forEach((arg) => collectQueryVariables(arg, bucket));
      }

      if (term.type === "list") {
        term.items.forEach((item) => collectQueryVariables(item, bucket));
      }

      return bucket;
    }

    function normalizeBindings(variableNames, bindings) {
      const normalized = {};
      Array.from(variableNames).forEach((name) => {
        normalized[name] = termToString(substitute({ type: "var", name }, bindings));
      });
      return normalized;
    }

    function deduplicateSolutions(solutions) {
      const seen = new Set();
      return solutions.filter((solution) => {
        const key = JSON.stringify(solution.bindings);
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
    }

    function resolve(programSource, querySource) {
      const clauses = parseProgram(programSource);
      const query = parseQuery(querySource);
      const queryVariables = collectQueryVariables(query);
      const solutions = [];
      const fallbackSteps = [];
      let clauseCounter = 0;
      let visitedNodes = 0;

      function prove(goals, bindings, steps, depth) {
        if (solutions.length >= settings.maxSolutions || visitedNodes >= settings.maxNodes) {
          return;
        }

        if (depth > settings.maxDepth) {
          fallbackSteps.push("Stopped because the proof went too deep.");
          return;
        }

        if (!goals.length) {
          solutions.push({
            bindings: normalizeBindings(queryVariables, bindings),
            steps: steps.concat("The query is proven."),
            tree: { goal: "success", children: [] },
          });
          return;
        }

        visitedNodes += 1;
        const currentGoal = substitute(goals[0], bindings);
        const remainingGoals = goals.slice(1);
        const currentGoalText = termToString(currentGoal);

        clauses.forEach((clause) => {
          if (
            clause.head.type !== "compound" ||
            currentGoal.type !== "compound" ||
            clause.head.functor !== currentGoal.functor ||
            clause.head.args.length !== currentGoal.args.length
          ) {
            return;
          }

          const freshClause = freshenClause(clause, clauseCounter += 1);
          const unifiedBindings = unify(currentGoal, freshClause.head, bindings);

          if (!unifiedBindings) {
            return;
          }

          const stepText = clause.body.length
            ? `To prove ${currentGoalText}, use ${clauseToString(clause)}`
            : `To prove ${currentGoalText}, use the fact ${clauseToString(clause)}`;

          const childSteps = steps.concat(stepText);
          prove(freshClause.body.concat(remainingGoals), unifiedBindings, childSteps, depth + 1);
        });
      }

      prove([query], {}, [], 0);

      const uniqueSolutions = deduplicateSolutions(solutions);
      const firstSolution = uniqueSolutions[0];
      const hasVariables = queryVariables.size > 0;

      let answer = `No proof found for ${termToString(query)}.`;
      if (uniqueSolutions.length) {
        if (!hasVariables) {
          answer = `${termToString(query)} is true.`;
        } else if (uniqueSolutions.length === 1) {
          answer = "Found 1 solution.";
        } else {
          answer = `Found ${uniqueSolutions.length} solutions.`;
        }
      }

      return {
        query: termToString(query),
        success: uniqueSolutions.length > 0,
        answer,
        solutions: uniqueSolutions.map((solution) => solution.bindings),
        steps: firstSolution ? firstSolution.steps : fallbackSteps,
        visual: {
          type: "tree",
          data: {
            query: termToString(query),
            proofTrees: uniqueSolutions.map((solution) => solution.tree),
            solutions: uniqueSolutions.map((solution) => solution.bindings),
          },
        },
      };
    }

    return {
      parseProgram,
      parseQuery,
      resolve,
      termToString,
    };
  }

  return {
    createEngine,
  };
});
