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
