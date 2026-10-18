/** The prompt guarantees integer input and a result below MAX_SAFE_INTEGER. */
function assertInteger(n: number): void {
  if (!Number.isInteger(n)) {
    throw new RangeError("n must be a finite integer");
  }
}

/**
 * Add every integer from 1 through n.
 * Time: O(n) for positive n. Auxiliary space: O(1).
 * Assumption shared by all implementations: n <= 0 gives the empty sum, 0.
 */
export function sum_to_n_a(n: number): number {
  assertInteger(n);
  let sum = 0;

  for (let value = 1; value <= n; value += 1) {
    sum += value;
  }

  return sum;
}

/**
 * Use the arithmetic-series formula n(n + 1) / 2.
 * Time: O(1). Auxiliary space: O(1).
 * Divide the even factor first so the intermediate product stays safe too.
 */
export function sum_to_n_b(n: number): number {
  assertInteger(n);
  if (n <= 0) return 0;

  return n % 2 === 0 ? (n / 2) * (n + 1) : n * ((n + 1) / 2);
}

/**
 * Recursively halve n. For k = floor(n / 2):
 * S(2k) = 2*S(k) + k*k; S(2k + 1) = S(2k) + (2k + 1).
 * Time: O(log n). Auxiliary space: O(log n) for the call stack.
 * Only one recursive call per level; every partial sum is <= the final sum.
 */
export function sum_to_n_c(n: number): number {
  assertInteger(n);

  function sumByHalving(value: number): number {
    if (value <= 0) return 0;

    const half = Math.floor(value / 2);
    const halfSum = sumByHalving(half);
    const evenSum = 2 * halfSum + half * half;

    return value % 2 === 0 ? evenSum : evenSum + value;
  }

  return sumByHalving(n);
}
