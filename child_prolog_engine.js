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
      maxCfgExplanationExamples: options.maxCfgExplanationExamples || 2,
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

    function parseGrammarRules(programSource) {
      const statements = splitStatements(programSource);
      const parser = createParser();
      const rules = [];

      statements.forEach((statement) => {
        if (!statement.includes("-->")) {
          return;
        }

        const [headText, bodyText] = statement.split("-->");
        if (!headText || !bodyText) {
          return;
        }

        const head = parser.parseTerm(headText.trim());
        const body = splitTopLevel(bodyText, ",").map((part) => parser.parseTerm(part.trim()));
        rules.push({ head, body });
      });

      return rules;
    }

    function buildCfgExplanation(startSymbol, rules) {
      const lines = [];

      function prettify(symbolText) {
        return symbolText.replace(/_/g, " ");
      }

      function listRuleParts(rule) {
        return rule.body.map((part) => prettify(termToString(part)));
      }

      function findRuleFor(symbol) {
        const symbolText = termToString(symbol);
        return rules.find((rule) => termToString(rule.head) === symbolText) || null;
      }

      const startRule = findRuleFor(startSymbol);
      if (!startRule) {
        return lines;
      }

      const startText = prettify(termToString(startSymbol));
      lines.push(`A ${startText} is made from:`);
      listRuleParts(startRule).forEach((part, index) => {
        lines.push(`${index + 1}. a ${part}`);
      });

      const explainablePart = startRule.body.find((part) => part.type === "atom" || part.type === "compound");
      if (explainablePart) {
        const detailRule = findRuleFor(explainablePart);
        if (detailRule) {
          const detailText = prettify(termToString(explainablePart));
          lines.push(`A ${detailText} is:`);
          listRuleParts(detailRule).forEach((part, index) => {
            lines.push(`${index + 1}. a ${part}`);
          });
        }
      }

      return lines;
    }

    function generateCfgDerivations(startSymbol, rules, maxNodes) {
      let visitedNodes = 0;

      function matchesRuleHead(ruleHead, symbol) {
        return termToString(ruleHead) === termToString(symbol);
      }

      function expandItem(item, depth) {
        if (visitedNodes >= maxNodes || depth > settings.maxDepth) {
          return [];
        }

        visitedNodes += 1;

        if (item.type === "list") {
          return [{
            tokens: item.items.map((token) => termToString(token)),
            nodes: item.items.map((token) => ({ goal: termToString(token), children: [] })),
          }];
        }

        if (item.type === "atom" || item.type === "compound") {
          return expandSymbol(item, depth + 1).map((result) => ({
            tokens: result.tokens,
            nodes: [result.tree],
          }));
        }

        return [];
      }

      function expandSequence(sequence, depth) {
        let results = [{ tokens: [], nodes: [] }];

        for (let index = 0; index < sequence.length; index += 1) {
          const itemExpansions = expandItem(sequence[index], depth + 1);
          const next = [];

          results.forEach((base) => {
            itemExpansions.forEach((expansion) => {
              if (next.length >= maxNodes) {
                return;
              }
              next.push({
                tokens: base.tokens.concat(expansion.tokens),
                nodes: base.nodes.concat(expansion.nodes),
              });
            });
          });

          results = next;
          if (!results.length || results.length >= maxNodes) {
            break;
          }
        }

        return results;
      }

      function expandSymbol(symbol, depth) {
        if (visitedNodes >= maxNodes || depth > settings.maxDepth) {
          return [];
        }

        const matchingRules = rules.filter((rule) => matchesRuleHead(rule.head, symbol));
        const symbolText = termToString(symbol);

        if (!matchingRules.length) {
          return [{
            tokens: [symbolText],
            tree: { goal: symbolText, children: [] },
          }];
        }

        const expansions = [];
        matchingRules.forEach((rule) => {
          if (expansions.length >= maxNodes) {
            return;
          }

          const bodyExpansions = expandSequence(rule.body, depth + 1);
          bodyExpansions.forEach((bodyExpansion) => {
            if (expansions.length >= maxNodes) {
              return;
            }
            expansions.push({
              tokens: bodyExpansion.tokens,
              tree: {
                goal: symbolText,
                children: bodyExpansion.nodes,
              },
            });
          });
        });

        return expansions;
      }

      const rawDerivations = expandSymbol(startSymbol, 0);
      const deduped = [];
      const seen = new Set();

      rawDerivations.forEach((item) => {
        const key = item.tokens.join(" ");
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        deduped.push(item);
      });

      return deduped;
    }

    function formatSentence(tokens) {
      if (!tokens.length) {
        return "";
      }

      const raw = tokens.join(" ").replace(/\s+/g, " ").trim();
      if (raw.length < 1) {
        return "";
      }

      const capitalized = `${raw.charAt(0).toUpperCase()}${raw.slice(1)}`;
      return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
    }

    function resolve(programSource, querySource) {
      const query = parseQuery(querySource);
      const queryVariables = collectQueryVariables(query);

      if (
        query.type === "compound" &&
        query.functor === "generate" &&
        query.args.length === 2 &&
        (query.args[0].type === "atom" || query.args[0].type === "compound")
      ) {
        const grammarRules = parseGrammarRules(programSource);
        if (grammarRules.length > 0) {
          const derivations = generateCfgDerivations(query.args[0], grammarRules, settings.maxNodes);
          const generated = derivations
            .map((item) => ({
              tokens: item.tokens,
              sentence: formatSentence(item.tokens),
              tree: item.tree,
            }))
            .filter((item) => item.sentence);

          const target = query.args[1];
          const targetName = target.type === "var" ? target.name : null;
          const solutions = targetName
            ? generated.map((item) => ({ [targetName]: item.sentence }))
            : generated
                .filter((item) => target.type === "atom" && item.sentence.toLowerCase() === target.value.toLowerCase())
                .map(() => ({}));
          const success = solutions.length > 0;
          const exampleCount = Math.min(settings.maxCfgExplanationExamples, generated.length);
          const cfgExplanation = buildCfgExplanation(query.args[0], grammarRules);
          for (let index = 0; index < exampleCount; index += 1) {
            cfgExplanation.push(`Example ${index + 1}: ${generated[index].sentence}`);
          }

          let answer = `No sentence generated for ${termToString(query.args[0])}.`;
          if (success) {
            answer = targetName
              ? `Found ${solutions.length} sentence${solutions.length === 1 ? "" : "s"}.`
              : `${termToString(query)} is true.`;
          }

          return {
            query: termToString(query),
            success,
            answer,
            solutions,
            steps: cfgExplanation,
            visual: {
              type: "grammar",
              data: {
                query: termToString(query),
                startSymbol: termToString(query.args[0]),
                generatedSentences: generated.map((item) => item.sentence),
                derivationTrees: generated.map((item) => item.tree),
                solutions,
                compression: null,
              },
            },
          };
        }
      }

      const clauses = parseProgram(programSource);
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
