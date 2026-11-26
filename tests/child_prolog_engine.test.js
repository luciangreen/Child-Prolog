const test = require("node:test");
const assert = require("node:assert/strict");

const { createEngine } = require("../child_prolog_engine.js");

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
    assert.match(result.steps.join(" "), new RegExp(`a\\(N\\) = ${escapeRegex(formula)}`));
  });
});

test("runs stage 5 graph transformation for apply(connect_grandparent)", () => {
  const engine = createEngine();
  const stage5Program = `node(a).
node(b).
node(c).
edge(a,b).
edge(b,c).
rule(connect_grandparent) :-
  edge(X,Y),
  edge(Y,Z),
  add_edge(X,Z).`;

  const result = engine.resolve(stage5Program, "apply(connect_grandparent).");

  assert.equal(result.success, true);
  assert.equal(result.visual.type, "graph");
  assert.match(result.answer, /added 1 edge/);
  assert.deepEqual(result.solutions, [{}]);
  assert.deepEqual(result.visual.data.addedEdges, [{ from: "a", to: "c" }]);
  assert.ok(
    result.visual.data.after.edges.some((edge) => edge.from === "a" && edge.to === "c")
  );
  assert.match(result.steps.join(" "), /Because a connects to b, and b connects to c,/);
  assert.match(result.steps.join(" "), /shortcut from a to c/);
});

test("runs stage 6 spec-to-algorithm from a plain-language specification", () => {
  const engine = createEngine();
  const result = engine.resolve("", "Find the biggest number in a list.");

  assert.equal(result.success, true);
  assert.equal(result.answer, "Generated a recursive algorithm for finding the biggest number in a list.");
  assert.deepEqual(result.solutions, [{}]);
  assert.equal(result.visual.type, "tree");
  assert.match(result.steps.join(" "), /If the list has one number, that number is biggest/);
  assert.match(result.visual.data.generatedProgram, /biggest\(\[X\], X\)\./);
  assert.match(result.visual.data.generatedProgram, /biggest\(\[X\|Rest\], Biggest\) :-/);
  assert.deepEqual(result.visual.data.sampleTrace.comparisons, [
    "compare 3 with biggest([8,2,5])",
    "compare 8 with biggest([2,5])",
    "compare 2 with biggest([5])",
    "answer = 8",
  ]);
});

test("binds the generated algorithm for stage 6 spec_to_algorithm/2 queries", () => {
  const engine = createEngine();
  const result = engine.resolve("", "spec_to_algorithm(find_the_biggest_number_in_a_list, Algorithm).");

  assert.equal(result.success, true);
  assert.deepEqual(result.solutions, [{
    Algorithm: `biggest([X], X).
biggest([X|Rest], Biggest) :-
  biggest(Rest, RestBiggest),
  max(X, RestBiggest, Biggest).`,
  }]);
  assert.equal(result.visual.data.specification, "Find the biggest number in a list.");
});

test("runs stage 7 symbolic world query for can_enter(tower)", () => {
  const engine = createEngine();
  const stage7Program = `room(garden).
room(cave).
room(tower).
path(garden,cave).
path(cave,tower).
has_key(garden).
locked(tower).
can_enter(Room) :-
  room(Room),
  not(locked(Room)).
can_enter(tower) :-
  has_key(garden).`;

  const result = engine.resolve(stage7Program, "can_enter(tower).");

  assert.equal(result.success, true);
  assert.equal(result.answer, "can_enter(tower) is true.");
  assert.equal(result.visual.type, "graph");
  assert.match(result.steps.join(" "), /You can enter the tower because the garden has a key\./);
  assert.match(result.steps.join(" "), /The key unlocks the tower\./);
  assert.deepEqual(result.visual.data.unlockedByKeyRooms, ["tower"]);
  assert.ok(result.visual.data.before.edges.some((edge) => edge.from === "garden" && edge.to === "cave"));
  assert.ok(result.visual.data.before.edges.some((edge) => edge.from === "cave" && edge.to === "tower"));
});

test("a query with a comma proves both goals", () => {
  const engine = createEngine();
  const result = engine.resolve("p(1). p(2). p(3).", "p(X), X > 1.");
  assert.equal(result.success, true);
  assert.deepEqual(result.solutions, [{ X: "2" }, { X: "3" }]);
});

test("equals, multiplication and comparisons are supported", () => {
  const engine = createEngine();
  assert.equal(engine.resolve("likes(mary, X) :- X = wine.", "likes(mary, wine).").success, true);
  assert.deepEqual(engine.resolve("x(Y) :- Y is 2 * 3.", "x(Z).").solutions, [{ Z: "6" }]);
  assert.deepEqual(engine.resolve("p(1). p(2). p(3).", "p(X), X =< 2.").solutions, [{ X: "1" }, { X: "2" }]);
});

test("an undefined predicate is named in the answer", () => {
  const engine = createEngine();
  const result = engine.resolve("p(a).", "q(a).");
  assert.equal(result.success, false);
  assert.equal(result.reason, "unknown_predicate");
  assert.match(result.answer, /no facts or rules for q\/1/);
});

test("a loop is reported as stopping, not as false", () => {
  const engine = createEngine();
  const result = engine.resolve("loop(X) :- loop(X).", "loop(a).");
  assert.equal(result.reason, "stopped");
  assert.match(result.answer, /stopped after many steps/);
});

test("arithmetic it cannot work out is named", () => {
  const engine = createEngine();
  const result = engine.resolve("p(X) :- X is foo.", "p(Y).");
  assert.equal(result.reason, "not_supported");
  assert.match(result.answer, /do not know how to work out foo/);
});

test("the occurs check stops f(Y, g(Y)) instead of crashing", () => {
  const engine = createEngine();
  const result = engine.resolve("f(X, X).", "f(Y, g(Y)).");
  assert.equal(result.success, false);
});

test("a rule typed as a query gets a helpful message", () => {
  const engine = createEngine();
  assert.throws(() => engine.resolve("p(1).", "p(X) :- q(X)."), /looks like a rule/);
});
