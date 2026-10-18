# Problem 4: Three ways to sum to n

## Problem statement

Provide three unique TypeScript implementations of the following functions, with comments on their complexity or efficiency:

```ts
function sum_to_n_a(n: number): number;
function sum_to_n_b(n: number): number;
function sum_to_n_c(n: number): number;
```

Input: `n`, any integer. The input is guaranteed to produce a result less than `Number.MAX_SAFE_INTEGER`.

Output: the sum of integers from 1 through `n`. For example, `sum_to_n(5) === 1 + 2 + 3 + 4 + 5 === 15`.

## Assumptions

- For `n <= 0`, return `0`: there are no positive integers from 1 through `n`. The prompt does not specify negative-input behavior.
- Inputs are integers as specified. Non-integer and non-finite values throw `RangeError` as a defensive check.
- The supplied safe-result guarantee is trusted. Inputs whose sums exceed that bound are outside the contract.

## Approach

The implementations are exported from [solution.ts](solution.ts).

| Function | Approach | Time for positive n | Auxiliary space |
| --- | --- | --- | --- |
| `sum_to_n_a` | Iterate from 1 to n and accumulate | O(n) | O(1) |
| `sum_to_n_b` | Arithmetic-series formula | O(1) | O(1) |
| `sum_to_n_c` | Recursively halve n | O(log n) | O(log n) |

The loop is straightforward but does one addition per integer. The formula is the most efficient choice. It divides the even factor before multiplying so that the intermediate product also stays within the safe-integer range.

The recursive version uses the identity `S(2k) = 2*S(k) + k*k`, since the upper half of `1..2k` is `1..k` shifted by `k`. For odd `n = 2k + 1`, it adds the remaining term `n`. A single recursive call per level halves the input, avoiding the linear stack depth of recursing on `n - 1`. All intermediate integer values stay at or below the final positive sum.

## Setup

Use **Node.js 24 or newer**. No package installation or build step is required: the solution uses erasable TypeScript syntax supported by Node's [native TypeScript execution](https://nodejs.org/api/typescript.html). Native execution strips types; it does not perform static type checking.

If you use nvm, run `nvm install` and `nvm use` from the repository root.

## Run

From the repository root:

```sh
node src/problem4/example.ts
# Alternatively: npm run demo:problem4
```

Expected output:

```text
sum_to_n_a(5) = 15
sum_to_n_b(5) = 15
sum_to_n_c(5) = 15
```

## Test

From the repository root:

```sh
node --test src/problem4/tests/solution.test.ts
# Alternatively: npm test
```

Tests cover the example, zero, negative integers, odd and even inputs, invalid inputs, and the largest positive `n` whose sum is below the stated limit (`134,217,727`). An exact `BigInt` calculation acts as the oracle. The maximum-input test deliberately exercises all three implementations, including the linear loop.

## Complexity and limitations

Complexities assume constant-time operations on JavaScript numbers. For `n <= 0`, all three implementations take O(1) time and space.

The loop becomes slower for large inputs. The halving version uses stack space; under the safe-result constraint, it needs at most 28 simultaneous calls. The arithmetic formula has constant time and space and is the recommended implementation when only one is needed.
