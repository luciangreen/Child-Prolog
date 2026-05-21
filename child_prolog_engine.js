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

      const raw = tokens.join(" ").trim();
      if (raw.length < 1) {
        return "";
      }

      const capitalized = capitalizeFirst(raw);
      return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
    }

    function capitalizeFirst(text) {
      if (!text || text.length < 1) {
        return text;
      }
      return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
    }

    function edgeKey(from, to) {
      return `${from}->${to}`;
    }

    function parseGraphProgram(clauses) {
      const nodes = new Set();
      const edges = [];
      const edgeSeen = new Set();
      const rules = new Map();

      clauses.forEach((clause) => {
        if (clause.head.type !== "compound") {
          return;
        }

        if (clause.head.functor === "node" && clause.head.args.length === 1 && clause.body.length === 0) {
          nodes.add(termToString(clause.head.args[0]));
          return;
        }

        if (clause.head.functor === "edge" && clause.head.args.length === 2 && clause.body.length === 0) {
          const from = termToString(clause.head.args[0]);
          const to = termToString(clause.head.args[1]);
          const key = edgeKey(from, to);
          if (!edgeSeen.has(key)) {
            edgeSeen.add(key);
            edges.push({ from, to });
          }
          nodes.add(from);
          nodes.add(to);
          return;
        }

        if (clause.head.functor === "rule" && clause.head.args.length === 1) {
          rules.set(termToString(clause.head.args[0]), clause.body);
        }
      });

      return {
        nodes: Array.from(nodes),
        edges,
        rules,
      };
    }

    function applyGraphRule(ruleBody, edges) {
      const edgeTerms = edges.map((edge) => ({
        type: "compound",
        functor: "edge",
        args: [
          { type: "atom", value: edge.from },
          { type: "atom", value: edge.to },
        ],
      }));
      const candidates = [];

      function addCandidate(from, to, witnesses) {
        candidates.push({ from, to, witnesses });
      }

      function walk(goalIndex, bindings, witnesses) {
        if (goalIndex >= ruleBody.length) {
          return;
        }

        const goal = ruleBody[goalIndex];
        if (goal.type !== "compound") {
          return;
        }

        if (goal.functor === "edge" && goal.args.length === 2) {
          edgeTerms.forEach((edgeTerm) => {
            const nextBindings = unify(goal, edgeTerm, bindings);
            if (!nextBindings) {
              return;
            }
            const witnessFrom = termToString(substitute(goal.args[0], nextBindings));
            const witnessTo = termToString(substitute(goal.args[1], nextBindings));
            walk(goalIndex + 1, nextBindings, witnesses.concat({ from: witnessFrom, to: witnessTo }));
          });
          return;
        }

        if (goal.functor === "add_edge" && goal.args.length === 2) {
          const fromTerm = substitute(goal.args[0], bindings);
          const toTerm = substitute(goal.args[1], bindings);
          if (fromTerm.type === "var" || toTerm.type === "var") {
            return;
          }
          addCandidate(termToString(fromTerm), termToString(toTerm), witnesses.slice());
          walk(goalIndex + 1, bindings, witnesses);
        }
      }

      walk(0, {}, []);

      const deduped = [];
      const seen = new Set();
      candidates.forEach((candidate) => {
        const key = edgeKey(candidate.from, candidate.to);
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        deduped.push(candidate);
      });

      return deduped;
    }

    function buildGraphSteps(ruleName, addedEdges) {
      if (!addedEdges.length) {
        return [`Applied ${ruleName}.`, "No new shortcut edges were needed."];
      }

      const lines = [];
      addedEdges.forEach((edge) => {
        const witnesses = edge.witnesses || [];
        if (witnesses.length >= 2) {
          const first = witnesses[0];
          const second = witnesses[1];
          lines.push(
            `Because ${first.from} connects to ${first.to}, and ${second.from} connects to ${second.to},`
          );
          lines.push(`we can add a shortcut from ${edge.from} to ${edge.to}.`);
        } else if (witnesses.length === 1) {
          const only = witnesses[0];
          lines.push(`Because ${only.from} connects to ${only.to},`);
          lines.push(`we can add a shortcut from ${edge.from} to ${edge.to}.`);
        } else {
          lines.push(`We add a shortcut from ${edge.from} to ${edge.to}.`);
        }
      });
      return lines;
    }

    function parseSymbolicWorldProgram(clauses) {
      const rooms = new Set();
      const paths = [];
      const pathSeen = new Set();
      const keyRooms = new Set();
      const lockedRooms = new Set();

      clauses.forEach((clause) => {
        if (clause.head.type !== "compound" || clause.body.length > 0) {
          return;
        }

        if (clause.head.functor === "room" && clause.head.args.length === 1) {
          rooms.add(termToString(clause.head.args[0]));
          return;
        }

        if (clause.head.functor === "path" && clause.head.args.length === 2) {
          const from = termToString(clause.head.args[0]);
          const to = termToString(clause.head.args[1]);
          const key = edgeKey(from, to);
          if (!pathSeen.has(key)) {
            pathSeen.add(key);
            paths.push({ from, to });
          }
          rooms.add(from);
          rooms.add(to);
          return;
        }

        if (clause.head.functor === "has_key" && clause.head.args.length === 1) {
          const room = termToString(clause.head.args[0]);
          keyRooms.add(room);
          rooms.add(room);
          return;
        }

        if (clause.head.functor === "locked" && clause.head.args.length === 1) {
          const room = termToString(clause.head.args[0]);
          lockedRooms.add(room);
          rooms.add(room);
        }
      });

      return {
        rooms: Array.from(rooms),
        paths,
        keyRooms,
        lockedRooms,
      };
    }

    function hasSymbolicWorldFacts(world) {
      return world.rooms.length > 0 || world.paths.length > 0 || world.keyRooms.size > 0 || world.lockedRooms.size > 0;
    }

    function buildSymbolicWorldResult(query, world, success) {
      const queryRoom = query.args[0] ? termToString(query.args[0]) : null;
      const keyRoom = world.keyRooms.values().next().value || null;
      const isLocked = queryRoom ? world.lockedRooms.has(queryRoom) : false;
      const steps = [];

      if (!success) {
        steps.push(`You cannot enter the ${queryRoom} yet.`);
      } else if (queryRoom && isLocked && keyRoom) {
        steps.push(`You can enter the ${queryRoom} because the ${keyRoom} has a key.`);
        steps.push(`The key unlocks the ${queryRoom}.`);
      } else if (queryRoom && isLocked) {
        steps.push(`You can enter the ${queryRoom} because a key rule allows it.`);
      } else if (queryRoom) {
        steps.push(`You can enter the ${queryRoom} because it is not locked.`);
      }

      return {
        steps,
        visual: {
          query: termToString(query),
          world: {
            rooms: world.rooms.map((name) => ({
              name,
              hasKey: world.keyRooms.has(name),
              locked: world.lockedRooms.has(name),
            })),
            paths: world.paths,
          },
          before: {
            nodes: world.rooms,
            edges: world.paths,
          },
          after: {
            nodes: world.rooms,
            edges: world.paths,
          },
          addedEdges: [],
          unlockedRooms: success && queryRoom && isLocked ? [queryRoom] : [],
          compression: null,
        },
      };
    }

    function gcdBigInt(left, right) {
      let a = left < 0n ? -left : left;
      let b = right < 0n ? -right : right;

      while (b !== 0n) {
        const remainder = a % b;
        a = b;
        b = remainder;
      }

      return a === 0n ? 1n : a;
    }

    function makeFraction(num, den = 1n) {
      if (den === 0n) {
        throw new Error("Cannot divide by zero in polynomial solver.");
      }

      let numerator = num;
      let denominator = den;
      if (denominator < 0n) {
        numerator = -numerator;
        denominator = -denominator;
      }

      const divisor = gcdBigInt(numerator, denominator);
      return {
        num: numerator / divisor,
        den: denominator / divisor,
      };
    }

    function addFraction(left, right) {
      return makeFraction(left.num * right.den + right.num * left.den, left.den * right.den);
    }

    function subtractFraction(left, right) {
      return makeFraction(left.num * right.den - right.num * left.den, left.den * right.den);
    }

    function multiplyFraction(left, right) {
      return makeFraction(left.num * right.num, left.den * right.den);
    }

    function divideFraction(left, right) {
      return makeFraction(left.num * right.den, left.den * right.num);
    }

    function isZeroFraction(value) {
      return value.num === 0n;
    }

    function negateFraction(value) {
      return makeFraction(-value.num, value.den);
    }

    function absoluteFraction(value) {
      return value.num < 0n ? negateFraction(value) : value;
    }

    function fractionToString(value) {
      if (value.den === 1n) {
        return value.num.toString();
      }
      return `${value.num.toString()}/${value.den.toString()}`;
    }

    function buildFiniteDifferences(sequence) {
      const rows = [sequence.slice()];
      while (rows[rows.length - 1].length > 1) {
        const previous = rows[rows.length - 1];
        const next = [];
        for (let index = 1; index < previous.length; index += 1) {
          next.push(previous[index] - previous[index - 1]);
        }
        rows.push(next);
      }
      return rows;
    }

    function findConstantDifferenceDegree(differences) {
      for (let index = 0; index < differences.length; index += 1) {
        const row = differences[index];
        if (!row.length) {
          continue;
        }
        if (row.every((value) => value === row[0])) {
          return index;
        }
      }
      return differences.length - 1;
    }

    function solvePolynomialCoefficients(sequence, degree) {
      const size = degree + 1;
      const matrix = [];

      for (let row = 0; row < size; row += 1) {
        const n = BigInt(row + 1);
        const currentRow = [];
        for (let power = 0; power <= degree; power += 1) {
          currentRow.push(makeFraction(n ** BigInt(power)));
        }
        currentRow.push(makeFraction(BigInt(sequence[row])));
        matrix.push(currentRow);
      }

      for (let column = 0; column < size; column += 1) {
        let pivot = column;
        while (pivot < size && isZeroFraction(matrix[pivot][column])) {
          pivot += 1;
        }

        if (pivot === size) {
          return null;
        }

        if (pivot !== column) {
          const temporary = matrix[column];
          matrix[column] = matrix[pivot];
          matrix[pivot] = temporary;
        }

        const pivotValue = matrix[column][column];
        for (let valueIndex = column; valueIndex <= size; valueIndex += 1) {
          matrix[column][valueIndex] = divideFraction(matrix[column][valueIndex], pivotValue);
        }

        for (let row = 0; row < size; row += 1) {
          if (row === column) {
            continue;
          }
          const factor = matrix[row][column];
          if (isZeroFraction(factor)) {
            continue;
          }
          for (let valueIndex = column; valueIndex <= size; valueIndex += 1) {
            matrix[row][valueIndex] = subtractFraction(
              matrix[row][valueIndex],
              multiplyFraction(factor, matrix[column][valueIndex])
            );
          }
        }
      }

      return matrix.map((row) => row[size]);
    }

    function polynomialKind(degree) {
      if (degree <= 0) {
        return "constant";
      }
      if (degree === 1) {
        return "linear";
      }
      if (degree === 2) {
        return "quadratic";
      }
      if (degree === 3) {
        return "cubic";
      }
      return `degree-${degree}`;
    }

    function ordinalWord(index) {
      const names = ["first", "second", "third", "fourth", "fifth", "sixth"];
      if (index > 0 && index <= names.length) {
        return names[index - 1];
      }
      const mod100 = index % 100;
      if (mod100 >= 11 && mod100 <= 13) {
        return `${index}th`;
      }
      const mod10 = index % 10;
      if (mod10 === 1) {
        return `${index}st`;
      }
      if (mod10 === 2) {
        return `${index}nd`;
      }
      if (mod10 === 3) {
        return `${index}rd`;
      }
      return `${index}th`;
    }

    function formatPolynomialFormula(coefficients) {
      const terms = [];

      for (let power = coefficients.length - 1; power >= 0; power -= 1) {
        const coefficient = coefficients[power];
        if (!coefficient || isZeroFraction(coefficient)) {
          continue;
        }

        const isNegative = coefficient.num < 0n;
        const absolute = absoluteFraction(coefficient);
        let core;

        if (power === 0) {
          core = fractionToString(absolute);
        } else {
          const variablePart = power === 1 ? "N" : `N^${power}`;
          if (absolute.num === 1n && absolute.den === 1n) {
            core = variablePart;
          } else if (absolute.den === 1n) {
            core = `${absolute.num.toString()}${variablePart}`;
          } else {
            core = `${fractionToString(absolute)}*${variablePart}`;
          }
        }

        if (!terms.length) {
          terms.push(isNegative ? `-${core}` : core);
        } else {
          terms.push(isNegative ? `- ${core}` : `+ ${core}`);
        }
      }

      return terms.length ? terms.join(" ") : "0";
    }

    function normalizeSpecificationText(text) {
      return text
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    }

    function normalizeQuerySourceText(source) {
      return source
        .trim()
        .replace(/^\?\-\s*/, "")
        .replace(/^query:\s*/i, "")
        .replace(/\.\s*$/, "");
    }

    function stripTrailingSentencePeriod(text) {
      return text.replace(/\.\s*$/, "");
    }

    const specToAlgorithmRegistry = [
      {
        label: "Find the biggest number in a list.",
        variations: [
          "find the biggest number in a list",
          "find biggest number in a list",
          "biggest number in a list",
        ],
        buildGeneratedProgram: buildBiggestNumberAlgorithm,
        buildSampleTrace: function () {
          return buildBiggestNumberTrace([3, 8, 2, 5]);
        },
      },
    ];

    function detectSpecToAlgorithmRequest(query) {
      if (query.type === "atom") {
        const match = specToAlgorithmRegistry.find((entry) =>
          entry.variations.includes(normalizeSpecificationText(query.value))
        );
        if (match) {
          return {
            entry: match,
            target: null,
          };
        }
      }

      if (
        query.type === "compound" &&
        query.functor === "spec_to_algorithm" &&
        query.args.length === 2 &&
        query.args[0].type === "atom"
      ) {
        const match = specToAlgorithmRegistry.find((entry) =>
          entry.variations.includes(normalizeSpecificationText(query.args[0].value))
        );
        if (match) {
          return {
            entry: match,
            target: query.args[1],
          };
        }
      }

      return null;
    }

    function buildBiggestNumberAlgorithm() {
      return [
        "biggest([X], X).",
        "biggest([X|Rest], Biggest) :-",
        "  biggest(Rest, RestBiggest),",
        "  max(X, RestBiggest, Biggest).",
      ];
    }

    function buildBiggestNumberTrace(numbers) {
      function walk(index) {
        const current = numbers[index];
        const remaining = numbers.slice(index);

        if (index === numbers.length - 1) {
          return {
            biggest: current,
            comparisons: [],
            tree: {
              goal: `biggest([${remaining.join(",")}]) = ${current}`,
              children: [],
            },
          };
        }

        const rest = walk(index + 1);
        const biggest = Math.max(current, rest.biggest);
        return {
          biggest,
          comparisons: [`compare ${current} with biggest([${numbers.slice(index + 1).join(",")}])`].concat(rest.comparisons),
          tree: {
            goal: `compare ${current} with biggest([${numbers.slice(index + 1).join(",")}])`,
            children: [
              rest.tree,
              {
                goal: `max(${current}, ${rest.biggest}) = ${biggest}`,
                children: [],
              },
            ],
          },
        };
      }

      const trace = walk(0);
      return {
        list: numbers.slice(),
        biggest: trace.biggest,
        comparisons: trace.comparisons.concat(`answer = ${trace.biggest}`),
        tree: trace.tree,
      };
    }

    function resolveSpecToAlgorithm(query, request) {
      const { entry } = request;
      if (!entry) {
        return null;
      }

      const generatedProgramLines = entry.buildGeneratedProgram();
      const generatedProgram = generatedProgramLines.join("\n");
      const sampleTrace = entry.buildSampleTrace();
      const target = request.target;
      const targetName = target && target.type === "var" ? target.name : null;
      const solutions = targetName ? [{ [targetName]: generatedProgram }] : [{}];
      const answer = targetName
        ? `${targetName} = generated recursive algorithm.`
        : "Generated a recursive algorithm for finding the biggest number in a list.";

      return {
        query: termToString(query),
        success: true,
        answer,
        solutions,
        steps: [
          "To find the biggest number:",
          "1. If the list has one number, that number is biggest.",
          "2. Otherwise, find the biggest number in the rest of the list.",
          "3. Compare the first number with that result.",
          "Generated Child Prolog:",
        ].concat(generatedProgramLines),
        visual: {
          type: "tree",
          data: {
            query: termToString(query),
            specification: entry.label,
            generatedProgram,
            generatedProgramLines,
            sampleTrace: {
              list: sampleTrace.list,
              biggest: sampleTrace.biggest,
              comparisons: sampleTrace.comparisons,
            },
            proofTrees: [sampleTrace.tree],
            solutions,
            compression: null,
          },
        },
      };
    }

    function parseQueryWithSpecRequest(querySource) {
      const rawSpecificationText = normalizeQuerySourceText(querySource);
      const rawSpecificationRequest = detectSpecToAlgorithmRequest({
        type: "atom",
        value: rawSpecificationText,
      });

      if (rawSpecificationRequest) {
        return {
          query: {
            type: "atom",
            value: stripTrailingSentencePeriod(rawSpecificationRequest.entry.label),
          },
          request: rawSpecificationRequest,
        };
      }

      const query = parseQuery(querySource);
      return {
        query,
        request: detectSpecToAlgorithmRequest(query),
      };
    }

    function resolve(programSource, querySource) {
      const { query, request: specToAlgorithmRequest } = parseQueryWithSpecRequest(querySource);
      const queryVariables = collectQueryVariables(query);

      if (specToAlgorithmRequest) {
        return resolveSpecToAlgorithm(query, specToAlgorithmRequest);
      }

      if (
        query.type === "compound" &&
        query.functor === "discover_formula" &&
        query.args.length === 2 &&
        query.args[0].type === "list"
      ) {
        const sequence = query.args[0].items
          .filter((item) => item.type === "number")
          .map((item) => item.value);

        if (sequence.length !== query.args[0].items.length || sequence.length < 2) {
          return {
            query: termToString(query),
            success: false,
            answer: "discover_formula needs a list with at least two numbers.",
            solutions: [],
            steps: ["Please provide a numeric list such as [1,4,9,16,25]."],
            visual: {
              type: "formula",
              data: {
                query: termToString(query),
                sequence,
                differences: [],
                formula: null,
                degree: null,
                compression: null,
              },
            },
          };
        }

        const differences = buildFiniteDifferences(sequence);
        const degree = Math.min(findConstantDifferenceDegree(differences), sequence.length - 1);
        const coefficients = solvePolynomialCoefficients(sequence, degree);

        if (!coefficients) {
          return {
            query: termToString(query),
            success: false,
            answer: "Could not infer a polynomial formula from this sequence.",
            solutions: [],
            steps: [],
            visual: {
              type: "formula",
              data: {
                query: termToString(query),
                sequence,
                differences,
                formula: null,
                degree,
                compression: null,
              },
            },
          };
        }

        const formula = formatPolynomialFormula(coefficients);
        const target = query.args[1];
        const targetName = target.type === "var" ? target.name : null;
        const solutions = targetName
          ? [{ [targetName]: formula }]
          : target.type === "atom" && target.value.replace(/\s+/g, "") === formula.replace(/\s+/g, "")
              ? [{}]
              : [];
        const success = solutions.length > 0;
        const steps = [
          "The numbers are:",
          sequence.join(", "),
        ];

        for (let index = 1; index < differences.length; index += 1) {
          steps.push(`${capitalizeFirst(ordinalWord(index))} differences:`);
          steps.push(differences[index].join(", "));
        }

        if (degree > 0) {
          steps.push(`Because the ${ordinalWord(degree)} difference is constant, the rule is ${polynomialKind(degree)}.`);
        } else {
          steps.push("Because the numbers stay constant, the rule is constant.");
        }
        steps.push("The discovered rule is:");
        steps.push(`a(N) = ${formula}`);

        let answer = `No formula match found for ${termToString(query)}.`;
        if (success) {
          answer = targetName
            ? `${targetName} = ${formula}.`
            : `${termToString(query)} is true.`;
        }

        return {
          query: termToString(query),
          success,
          answer,
          solutions,
          steps,
          visual: {
            type: "formula",
            data: {
              query: termToString(query),
              sequence,
              differences,
              degree,
              kind: polynomialKind(degree),
              formula,
              solutions,
              compression: null,
            },
          },
        };
      }

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

      if (
        query.type === "compound" &&
        query.functor === "apply" &&
        query.args.length === 1 &&
        (query.args[0].type === "atom" || query.args[0].type === "number")
      ) {
        const clauses = parseProgram(programSource);
        const graphProgram = parseGraphProgram(clauses);
        const ruleName = termToString(query.args[0]);
        const ruleBody = graphProgram.rules.get(ruleName);

        if (!ruleBody) {
          return {
            query: termToString(query),
            success: false,
            answer: `No graph rule named ${ruleName} was found.`,
            solutions: [],
            steps: [`Please define rule(${ruleName}) with edge/2 and add_edge/2 goals.`],
            visual: {
              type: "graph",
              data: {
                query: termToString(query),
                rule: ruleName,
                before: {
                  nodes: graphProgram.nodes,
                  edges: graphProgram.edges,
                },
                after: {
                  nodes: graphProgram.nodes,
                  edges: graphProgram.edges,
                },
                addedEdges: [],
                transformations: [],
                compression: null,
              },
            },
          };
        }

        const candidateEdges = applyGraphRule(ruleBody, graphProgram.edges);
        const existingEdgeKeys = new Set(graphProgram.edges.map((edge) => edgeKey(edge.from, edge.to)));
        const addedEdges = candidateEdges.filter((edge) => !existingEdgeKeys.has(edgeKey(edge.from, edge.to)));
        const afterEdges = graphProgram.edges.concat(addedEdges.map((edge) => ({ from: edge.from, to: edge.to })));
        const answer =
          addedEdges.length > 0
            ? `${ruleName} added ${addedEdges.length} edge${addedEdges.length === 1 ? "" : "s"}.`
            : `${ruleName} did not add any new edges.`;

        return {
          query: termToString(query),
          success: true,
          answer,
          solutions: [{}],
          steps: buildGraphSteps(ruleName, addedEdges),
          visual: {
            type: "graph",
            data: {
              query: termToString(query),
              rule: ruleName,
              before: {
                nodes: graphProgram.nodes,
                edges: graphProgram.edges,
              },
              after: {
                nodes: graphProgram.nodes,
                edges: afterEdges,
              },
              addedEdges: addedEdges.map((edge) => ({ from: edge.from, to: edge.to })),
              transformations: addedEdges.map((edge) => ({
                type: "add_edge",
                from: edge.from,
                to: edge.to,
              })),
              compression: null,
            },
          },
        };
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

        if (currentGoal.type === "compound" && currentGoal.functor === "not" && currentGoal.args.length === 1) {
          const negatedGoal = substitute(currentGoal.args[0], bindings);
          const negatedSolutions = prove([negatedGoal], bindings, [], depth + 1);
          if (!negatedSolutions.length) {
            const stepText = `Check ${currentGoalText}: ${termToString(negatedGoal)} is false, so ${currentGoalText} is true.`;
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

      let stage7World = null;
      const stage7Steps = [];
      if (
        query.type === "compound" &&
        query.functor === "can_enter" &&
        query.args.length === 1 &&
        (query.args[0].type === "atom" || query.args[0].type === "number")
      ) {
        const symbolicWorld = parseSymbolicWorldProgram(clauses);
        if (hasSymbolicWorldFacts(symbolicWorld)) {
          stage7World = buildSymbolicWorldResult(query, symbolicWorld, uniqueSolutions.length > 0);
          stage7Steps.push(...stage7World.steps);
        }
      }

      return {
        query: termToString(query),
        success: uniqueSolutions.length > 0,
        answer,
        solutions: uniqueSolutions.map((solution) => solution.bindings),
        steps: firstSolution ? firstSolution.steps.concat(stage2Steps, stage7Steps) : fallbackSteps,
        visual: {
          type: stage7World ? "graph" : "tree",
          data: stage7World
            ? stage7World.visual
            : {
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
