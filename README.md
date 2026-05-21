# Child-Prolog

Stage 5 now includes graph transformations on top of Stage 4 formula discovery, Stage 3 CFG sentence generation, Stage 2 recursive compression, and the Stage 1 engine.

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

## Run tests

```bash
cd /path/to/Child-Prolog
npm test
```
