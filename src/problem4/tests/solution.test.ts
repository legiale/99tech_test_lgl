import assert from "node:assert/strict";
import { test } from "node:test";
import { sum_to_n_a, sum_to_n_b, sum_to_n_c } from "../solution.ts";

// BigInt supplies an exact oracle independent of floating-point arithmetic.
function expectedSum(n: number): number {
  if (n <= 0) return 0;
  const value = BigInt(n);
  return Number((value * (value + 1n)) / 2n);
}

for (const implementation of [sum_to_n_a, sum_to_n_b, sum_to_n_c]) {
  test(`${implementation.name}: examples and boundary inputs`, () => {
    for (const [n, expected] of [
      [-100, 0], [-1, 0], [-0, 0], [0, 0], [1, 1],
      [2, 3], [3, 6], [5, 15], [10, 55], [100, 5050],
    ] as const) {
      assert.equal(implementation(n), expected, `n=${n}`);
    }
  });

  test(`${implementation.name}: agrees with exact sums across odd and even inputs`, () => {
    for (let n = 0; n <= 1_000; n += 1) {
      assert.equal(implementation(n), expectedSum(n), `n=${n}`);
    }
  });

  test(`${implementation.name}: rejects inputs outside the integer contract`, () => {
    for (const n of [0.5, -1.5, NaN, Infinity, -Infinity]) {
      assert.throws(() => implementation(n), RangeError);
    }
  });

  test(`${implementation.name}: largest positive input with a safe sum`, () => {
    const n = 134_217_727;
    assert.ok(expectedSum(n) < Number.MAX_SAFE_INTEGER);
    assert.equal(implementation(n), expectedSum(n));
  });
}

test("formula and halving: large odd and even inputs remain exact", () => {
  for (const n of [1_000_000, 1_000_001, 100_000_000, 134_217_726]) {
    const expected = expectedSum(n);
    assert.equal(sum_to_n_b(n), expected);
    assert.equal(sum_to_n_c(n), expected);
  }
});
