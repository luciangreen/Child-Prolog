# Child-Prolog

Stage 7 now includes executable symbolic worlds on top of Stage 6 spec-to-algorithm generation, Stage 5 graph transformations, Stage 4 formula discovery, Stage 3 CFG sentence generation, Stage 2 recursive compression, and the Stage 1 engine.

## Features

- facts and rules
- variables and unification
- recursive proof search
- simple arithmetic goals (`>`, `is`, `+`, `-`) for recursive numeric examples
- trace steps for child-friendly explanations
- stage-2 recursive compression summary for `sum_to(N,S)`
- stage-3 CFG generation using grammar rules like `sentence --> noun_phrase, verb_phrase.`
- stage-4 formula discovery with `discover_formula([1,4,9,16,25],F).`
- stage-5 graph transformations with `apply(connect_grandparent).`
- stage-6 spec-to-algorithm generation from plain-language specs like `Find the biggest number in a list.`
- stage-7 executable symbolic worlds with queries like `can_enter(tower).`
- JSON output shaped for visualization panels

## Run in the browser

Open `index.html` in a browser from the project root.

The default example runs:

```prolog
sum_to(5,S).
```

from:

```prolog
sum_to(0,0).
sum_to(N,Sum) :-
  N > 0,
  N1 is N - 1,
  sum_to(N1,Prev),
  Sum is N + Prev.
```

Stage 3 grammar query example:

```prolog
sentence --> noun_phrase, verb_phrase.
noun_phrase --> determiner, noun.
verb_phrase --> verb, noun_phrase.
determiner --> [the].
determiner --> [a].
noun --> [robot].
noun --> [dragon].
verb --> [builds].
verb --> [finds].
query: generate(sentence,S).
```

Stage 4 formula discovery query example:

```prolog
query: discover_formula([1,4,9,16,25],F).
```

Stage 5 graph transformation query example:

```prolog
node(a).
node(b).
node(c).
edge(a,b).
edge(b,c).
rule(connect_grandparent) :-
  edge(X,Y),
  edge(Y,Z),
  add_edge(X,Z).
query: apply(connect_grandparent).
```

Stage 6 spec-to-algorithm query examples:

```text
query: Find the biggest number in a list.
```

or

```prolog
query: spec_to_algorithm(find_the_biggest_number_in_a_list, Algorithm).
```

Stage 7 symbolic world query example:

```prolog
room(garden).
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
  has_key(garden).
query: can_enter(tower).
```

## Run tests

```bash
cd /path/to/Child-Prolog
npm test
```
