# Child-Prolog

Stage 1 now includes a tiny browser-based Prolog-style interpreter.

## Features

- facts and rules
- variables and unification
- recursive proof search
- trace steps for child-friendly explanations
- JSON output shaped for visualization panels

## Run in the browser

Open `/home/runner/work/Child-Prolog/Child-Prolog/index.html` in a browser.

The default example proves:

```prolog
ancestor(alice,charlie).
```

from:

```prolog
parent(alice,bob).
parent(bob,charlie).
ancestor(X,Y) :- parent(X,Y).
ancestor(X,Y) :- parent(X,Z), ancestor(Z,Y).
```

## Run tests

```bash
cd /home/runner/work/Child-Prolog/Child-Prolog
npm test
```
