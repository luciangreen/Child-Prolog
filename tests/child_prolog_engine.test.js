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
