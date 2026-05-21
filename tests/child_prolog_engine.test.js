const test = require("node:test");
const assert = require("node:assert/strict");

const { createEngine } = require("../child_prolog_engine.js");

const program = `parent(alice,bob).
parent(bob,charlie).
ancestor(X,Y) :- parent(X,Y).
ancestor(X,Y) :- parent(X,Z), ancestor(Z,Y).`;

test("proves a recursive ancestor query", () => {
  const engine = createEngine();
  const result = engine.resolve(program, "ancestor(alice,charlie).");

  assert.equal(result.success, true);
  assert.equal(result.answer, "ancestor(alice,charlie) is true.");
  assert.match(result.steps.join(" "), /ancestor\(X,Y\) :- parent\(X,Z\), ancestor\(Z,Y\)\./);
});

test("returns bindings for a variable query", () => {
  const engine = createEngine();
  const result = engine.resolve(program, "ancestor(alice,Y).");

  assert.equal(result.success, true);
  assert.deepEqual(result.solutions, [{ Y: "bob" }, { Y: "charlie" }]);
});

test("parses list arguments in facts", () => {
  const engine = createEngine();
  const result = engine.resolve("likes(snack,[apple,pear]).", "likes(snack,[apple,pear]).");

  assert.equal(result.success, true);
  assert.equal(result.visual.type, "tree");
});

test("runs stage 2 recursive compression for sum_to", () => {
  const engine = createEngine();
  const stage2Program = `sum_to(0,0).
sum_to(N,Sum) :-
  N > 0,
  N1 is N - 1,
  sum_to(N1,Prev),
  Sum is N + Prev.`;

  const result = engine.resolve(stage2Program, "sum_to(5,S).");

  assert.equal(result.success, true);
  assert.equal(result.answer, "S = 15.");
  assert.deepEqual(result.solutions, [{ S: "15" }]);
  assert.match(result.steps.join(" "), /sum_to\(5\) means:/);
  assert.match(result.steps.join(" "), /S = N\(N\+1\)\/2/);
  assert.equal(result.visual.data.compression.formula, "sum_to(N) = N * (N + 1) / 2");
});

test("runs stage 3 CFG generation for generate(sentence,S)", () => {
  const engine = createEngine();
  const stage3Program = `sentence --> noun_phrase, verb_phrase.
noun_phrase --> determiner, noun.
verb_phrase --> verb, noun_phrase.
determiner --> [the].
determiner --> [a].
noun --> [robot].
noun --> [dragon].
verb --> [builds].
verb --> [finds].`;

  const result = engine.resolve(stage3Program, "generate(sentence,S).");

  assert.equal(result.success, true);
  assert.equal(result.visual.type, "grammar");
  assert.match(result.steps.join(" "), /A sentence is made from:/);
  assert.match(result.steps.join(" "), /A noun phrase is:/);
  assert.ok(result.solutions.length >= 2);
  assert.match(result.solutions[0].S, /^[A-Z].*\.$/);
  assert.ok(result.solutions.every((solution) => /^[A-Z].*\.$/.test(solution.S)));
  const generated = result.solutions.map((solution) => solution.S);
  assert.ok(generated.includes("The robot finds a dragon."));
});

test("runs stage 4 formula discovery examples", () => {
  const engine = createEngine();
  const cases = [
    { query: "discover_formula([1,2,3,4,5],F).", formula: "N" },
    { query: "discover_formula([1,4,9,16,25],F).", formula: "N^2" },
    { query: "discover_formula([1,8,27,64,125],F).", formula: "N^3" },
    { query: "discover_formula([2,4,6,8,10],F).", formula: "2N" },
    { query: "discover_formula([3,6,11,18,27],F).", formula: "N^2 + 2" },
  ];

  cases.forEach(({ query, formula }) => {
    const result = engine.resolve("", query);
    assert.equal(result.success, true);
    assert.equal(result.visual.type, "formula");
    assert.deepEqual(result.solutions, [{ F: formula }]);
    assert.match(result.steps.join(" "), /The discovered rule is:/);
    assert.match(result.steps.join(" "), new RegExp(`a\\(N\\) = ${formula.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  });
});
