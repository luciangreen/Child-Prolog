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

      function findTopLevelWord(text, word) {
        let roundDepth = 0;
        let squareDepth = 0;

        for (let index = 0; index <= text.length - word.length; index += 1) {
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

          if (roundDepth === 0 && squareDepth === 0 && text.slice(index, index + word.length) === word) {
            return index;
          }
        }

        return -1;
      }

      function findTopLevelCharFromRight(text, target) {
        let roundDepth = 0;
        let squareDepth = 0;

        for (let index = text.length - 1; index >= 0; index -= 1) {
          const character = text[index];
          if (character === ")") {
            roundDepth += 1;
          } else if (character === "(") {
            roundDepth -= 1;
          } else if (character === "]") {
            squareDepth += 1;
          } else if (character === "[") {
            squareDepth -= 1;
          }

          if (
            character === target &&
            roundDepth === 0 &&
            squareDepth === 0 &&
            index > 0
          ) {
            return index;
          }
        }

        return -1;
      }

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

        const isIndex = findTopLevelWord(text, " is ");
        if (isIndex !== -1) {
          return {
            type: "compound",
            functor: "is",
            args: [
              parseTerm(text.slice(0, isIndex)),
              parseTerm(text.slice(isIndex + 4)),
            ],
          };
        }

        const greaterThanIndex = findTopLevelWord(text, " > ");
        if (greaterThanIndex !== -1) {
          return {
            type: "compound",
            functor: ">",
            args: [
              parseTerm(text.slice(0, greaterThanIndex)),
              parseTerm(text.slice(greaterThanIndex + 3)),
            ],
          };
        }

        const plusIndex = findTopLevelCharFromRight(text, "+");
        if (plusIndex !== -1) {
          return {
            type: "compound",
            functor: "+",
            args: [
              parseTerm(text.slice(0, plusIndex)),
              parseTerm(text.slice(plusIndex + 1)),
            ],
          };
        }

        const minusIndex = findTopLevelCharFromRight(text, "-");
        if (minusIndex !== -1) {
          return {
            type: "compound",
            functor: "-",
            args: [
              parseTerm(text.slice(0, minusIndex)),
              parseTerm(text.slice(minusIndex + 1)),
            ],
          };
        }

        if (text === "_" || /^[A-Z_]/.test(text)) {
          const variableName = text === "_" ? `_anon${anonymousCounter + 1}` : text;
          if (text === "_") {
            anonymousCounter += 1;
          }
          return {
            type: "var",
            name: variableName,
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

    function evaluateArithmetic(term, bindings) {
      const resolved = substitute(term, bindings);

      if (resolved.type === "number") {
        return resolved.value;
      }

      if (resolved.type === "atom" && /^-?\d+$/.test(resolved.value)) {
        return Number(resolved.value);
      }

      if (resolved.type === "compound" && resolved.args.length === 2) {
        const left = evaluateArithmetic(resolved.args[0], bindings);
        const right = evaluateArithmetic(resolved.args[1], bindings);
        if (left === null || right === null) {
          return null;
        }

        if (resolved.functor === "+") {
          return left + right;
        }

        if (resolved.functor === "-") {
          return left - right;
        }
      }

      return null;
    }

    function buildSumToCompression(numberN, sumValue) {
      const expansion = [];
      let prefix = "";

      for (let value = numberN; value > 0; value -= 1) {
        if (prefix) {
          prefix += " + ";
        }
        prefix += String(value);
        if (value > 1) {
          expansion.push(`${prefix} + sum_to(${value - 1})`);
        }
      }

      const finalExpansion = numberN > 0 ? `${prefix} + 0` : "0";

      return {
        n: numberN,
        sum: sumValue,
        expansion,
        finalExpansion,
        repeatedIdea: "The repeated idea is: keep adding the next smaller number.",
        compressedRule: "S = N(N+1)/2",
        formula: "sum_to(N) = N * (N + 1) / 2",
      };
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
          return [];
        }

        if (depth > settings.maxDepth) {
          fallbackSteps.push("Stopped because the proof went too deep.");
          return [];
        }

        if (!goals.length) {
          return [{
            bindings: normalizeBindings(queryVariables, bindings),
            steps: steps.concat("The query is proven."),
            tree: { goal: "success", children: [] },
          }];
        }

        visitedNodes += 1;
        const currentGoal = substitute(goals[0], bindings);
        const remainingGoals = goals.slice(1);
        const currentGoalText = termToString(currentGoal);
        const localSolutions = [];

        if (currentGoal.type === "compound" && currentGoal.functor === ">" && currentGoal.args.length === 2) {
          const leftValue = evaluateArithmetic(currentGoal.args[0], bindings);
          const rightValue = evaluateArithmetic(currentGoal.args[1], bindings);
          if (leftValue !== null && rightValue !== null && leftValue > rightValue) {
            const stepText = `Check ${currentGoalText}: ${leftValue} > ${rightValue} is true.`;
            const childSolutions = prove(remainingGoals, bindings, steps.concat(stepText), depth + 1);
            childSolutions.forEach((solution) => {
              localSolutions.push({
                bindings: solution.bindings,
                steps: solution.steps,
                tree: { goal: stepText, children: [solution.tree] },
              });
            });
          }
          return localSolutions;
        }

        if (currentGoal.type === "compound" && currentGoal.functor === "is" && currentGoal.args.length === 2) {
          const computedValue = evaluateArithmetic(currentGoal.args[1], bindings);
          if (computedValue !== null) {
            const nextBindings = unify(
              currentGoal.args[0],
              { type: "number", value: computedValue },
              bindings
            );
            if (nextBindings) {
              const stepText = `Compute ${termToString(currentGoal.args[0])} is ${termToString(currentGoal.args[1])}: ${termToString(currentGoal.args[0])} = ${computedValue}.`;
              const childSolutions = prove(remainingGoals, nextBindings, steps.concat(stepText), depth + 1);
              childSolutions.forEach((solution) => {
                localSolutions.push({
                  bindings: solution.bindings,
                  steps: solution.steps,
                  tree: { goal: stepText, children: [solution.tree] },
                });
              });
            }
          }
          return localSolutions;
        }

        clauses.forEach((clause) => {
          if (
            clause.head.type !== "compound" ||
            currentGoal.type !== "compound" ||
            clause.head.functor !== currentGoal.functor ||
            clause.head.args.length !== currentGoal.args.length
          ) {
            return;
          }

          clauseCounter += 1;
          const freshClause = freshenClause(clause, clauseCounter);
          const unifiedBindings = unify(currentGoal, freshClause.head, bindings);

          if (!unifiedBindings) {
            return;
          }

          const stepText = clause.body.length
            ? `To prove ${currentGoalText}, use ${clauseToString(clause)}`
            : `To prove ${currentGoalText}, use the fact ${clauseToString(clause)}`;

          const childSteps = steps.concat(stepText);
          const childSolutions = prove(
            freshClause.body.concat(remainingGoals),
            unifiedBindings,
            childSteps,
            depth + 1
          );

          childSolutions.forEach((solution) => {
            localSolutions.push({
              bindings: solution.bindings,
              steps: solution.steps,
              tree: { goal: stepText, children: [solution.tree] },
            });
          });
        });

        return localSolutions;
      }

      const rawSolutions = prove([query], {}, [], 0);
      solutions.push(...rawSolutions);

      const uniqueSolutions = deduplicateSolutions(solutions);
      const firstSolution = uniqueSolutions[0];
      const hasVariables = queryVariables.size > 0;

      let answer = `No proof found for ${termToString(query)}.`;
      if (uniqueSolutions.length) {
        if (
          query.type === "compound" &&
          query.functor === "sum_to" &&
          query.args.length === 2 &&
          uniqueSolutions.length === 1 &&
          query.args[1].type === "var"
        ) {
          const sumName = query.args[1].name;
          const sumValue = uniqueSolutions[0].bindings[sumName];
          answer = `${sumName} = ${sumValue}.`;
        } else if (!hasVariables) {
          answer = `${termToString(query)} is true.`;
        } else if (uniqueSolutions.length === 1) {
          answer = "Found 1 solution.";
        } else {
          answer = `Found ${uniqueSolutions.length} solutions.`;
        }
      }

      let stage2Compression = null;
      const stage2Steps = [];
      if (
        query.type === "compound" &&
        query.functor === "sum_to" &&
        query.args.length === 2 &&
        query.args[0].type === "number" &&
        query.args[1].type === "var" &&
        uniqueSolutions.length > 0
      ) {
        const numberN = query.args[0].value;
        const sumName = query.args[1].name;
        const sumValue = Number(uniqueSolutions[0].bindings[sumName]);
        if (Number.isInteger(numberN) && numberN >= 0 && Number.isFinite(sumValue)) {
          stage2Compression = buildSumToCompression(numberN, sumValue);
          stage2Steps.push(`sum_to(${numberN}) means:`);
          stage2Compression.expansion.forEach((line) => stage2Steps.push(line));
          stage2Steps.push(stage2Compression.finalExpansion);
          stage2Steps.push(`So the answer is ${sumValue}.`);
          stage2Steps.push(stage2Compression.repeatedIdea);
          stage2Steps.push("This compresses to:");
          stage2Steps.push(stage2Compression.compressedRule);
          stage2Steps.push(stage2Compression.formula);
        }
      }

      return {
        query: termToString(query),
        success: uniqueSolutions.length > 0,
        answer,
        solutions: uniqueSolutions.map((solution) => solution.bindings),
        steps: firstSolution ? firstSolution.steps.concat(stage2Steps) : fallbackSteps,
        visual: {
          type: "tree",
          data: {
            query: termToString(query),
            proofTrees: uniqueSolutions.map((solution) => solution.tree),
            solutions: uniqueSolutions.map((solution) => solution.bindings),
            compression: stage2Compression,
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
