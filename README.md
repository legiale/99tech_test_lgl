# 99Tech Backend Code Challenge

Backend interview assignment: problems **4, 5, and 6**.

See [CHALLENGE.md](CHALLENGE.md) for the supplied instructions and source links.

## Structure

```text
.
├── README.md
├── CHALLENGE.md
├── .gitignore
├── .nvmrc
├── .env.example
├── package.json
├── package-lock.json
├── tsconfig.json
└── src/
    ├── problem4/
    │   ├── README.md
    │   ├── solution.ts
    │   ├── example.ts
    │   └── tests/
    ├── problem5/
    │   ├── README.md
    │   ├── app.ts
    │   ├── server.ts
    │   ├── config.ts
    │   ├── store.ts
    │   ├── validation.ts
    │   ├── types.ts
    │   └── tests/
    └── problem6/
        ├── README.md
        └── tests/
```

## Getting started

1. Add each problem statement to its folder's README.
2. Put each solution in its `src/problemN/` folder and automated tests in that folder's `tests/` directory.
3. Document dependencies, setup, run and test commands, assumptions, and tradeoffs in each problem's README.

Use Node.js 24 or newer. From the repository root:

```sh
npm ci
npm run typecheck
npm test
```

Run `npm run demo:problem4` for the summation example, or `npm run start:problem5` for the Express task API at `http://127.0.0.1:3000`. See [Problem 5](src/problem5/README.md) for database configuration and request examples. [Problem 6](src/problem6/README.md) contains the live-scoreboard architecture specification, Mermaid execution diagrams, and acceptance criteria for a future implementation.

The selected folders follow the [official skeletal template](https://github.com/99techteam/code-challenge), whose problem 4 and 5 folders contain empty `.keep` files. Problem 6 was added using the same convention because the linked template currently only lists problems 1–5. README templates and test folders are local additions. Unselected problems are omitted.

## Selected problems

| Problem | Documentation | Status |
| --- | --- | --- |
| 4 | [Problem 4](src/problem4/README.md) | Implemented with tests |
| 5 | [Problem 5](src/problem5/README.md) | Implemented with tests |
| 6 | [Problem 6](src/problem6/README.md) | Specification and diagrams complete |
