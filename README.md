# Child-Prolog

Stage 2 now includes recursive compression on top of the Stage 1 engine.

## Features

- facts and rules
- variables and unification
- recursive proof search
- simple arithmetic goals (`>`, `is`, `+`, `-`) for recursive numeric examples
- trace steps for child-friendly explanations
- stage-2 recursive compression summary for `sum_to(N,S)`
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

## Run tests

```bash
cd /path/to/Child-Prolog
npm test
```
