/**
 * Small dense linear algebra, sufficient for compartmental systems.
 *
 * The only non-trivial routine is `expm`, a scaling-and-squaring Pade
 * approximant following Higham (2005), "The scaling and squaring method for
 * the matrix exponential revisited", SIAM J. Matrix Anal. Appl. 26(4):1179.
 *
 * Why a matrix exponential rather than a numerical integrator:
 * within a segment of the simulation every rate constant and the infusion
 * rate are constant, so the system is linear and time-invariant and has a
 * closed-form solution. Using it makes the primary solver exact to machine
 * precision, which in turn lets an independent Runge-Kutta implementation
 * serve as a genuine cross-check rather than as a second approximation.
 *
 * Matrices are arrays of row arrays. Sizes here are 2x2 to 4x4, so clarity is
 * worth more than cache behaviour.
 */

/** @typedef {number[][]} Matrix */

/** @param {number} n @returns {Matrix} */
export function identity(n) {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );
}

/** @param {number} rows @param {number} cols @returns {Matrix} */
export function zeros(rows, cols) {
  return Array.from({ length: rows }, () => new Array(cols).fill(0));
}

/** @param {Matrix} a @param {Matrix} b @returns {Matrix} */
export function matMul(a, b) {
  const n = a.length;
  const m = b[0].length;
  const k = b.length;
  const out = zeros(n, m);
  for (let i = 0; i < n; i++) {
    for (let p = 0; p < k; p++) {
      const aip = a[i][p];
      if (aip === 0) continue;
      for (let j = 0; j < m; j++) out[i][j] += aip * b[p][j];
    }
  }
  return out;
}

/** @param {Matrix} a @param {Matrix} b @returns {Matrix} */
export function matAdd(a, b) {
  return a.map((row, i) => row.map((v, j) => v + b[i][j]));
}

/** @param {Matrix} a @param {Matrix} b @returns {Matrix} */
export function matSub(a, b) {
  return a.map((row, i) => row.map((v, j) => v - b[i][j]));
}

/** @param {Matrix} a @param {number} s @returns {Matrix} */
export function matScale(a, s) {
  return a.map((row) => row.map((v) => v * s));
}

/** @param {Matrix} a @param {number[]} v @returns {number[]} */
export function matVec(a, v) {
  return a.map((row) => row.reduce((acc, x, j) => acc + x * v[j], 0));
}

/** Maximum absolute column sum. @param {Matrix} a @returns {number} */
export function norm1(a) {
  const n = a.length;
  const m = a[0].length;
  let best = 0;
  for (let j = 0; j < m; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += Math.abs(a[i][j]);
    if (s > best) best = s;
  }
  return best;
}

/**
 * Solve A X = B by Gaussian elimination with partial pivoting.
 * @param {Matrix} A
 * @param {Matrix} B
 * @returns {Matrix}
 */
export function solve(A, B) {
  const n = A.length;
  const m = B[0].length;
  const a = A.map((row) => row.slice());
  const b = B.map((row) => row.slice());

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    }
    if (Math.abs(a[pivot][col]) < 1e-300) {
      throw new Error('solve: matrix is numerically singular');
    }
    if (pivot !== col) {
      [a[col], a[pivot]] = [a[pivot], a[col]];
      [b[col], b[pivot]] = [b[pivot], b[col]];
    }
    const d = a[col][col];
    for (let r = col + 1; r < n; r++) {
      const f = a[r][col] / d;
      if (f === 0) continue;
      for (let c = col; c < n; c++) a[r][c] -= f * a[col][c];
      for (let c = 0; c < m; c++) b[r][c] -= f * b[col][c];
    }
  }

  const x = zeros(n, m);
  for (let r = n - 1; r >= 0; r--) {
    for (let c = 0; c < m; c++) {
      let s = b[r][c];
      for (let k = r + 1; k < n; k++) s -= a[r][k] * x[k][c];
      x[r][c] = s / a[r][r];
    }
  }
  return x;
}

/* Pade-13 coefficients (Higham 2005, Table 2.3). */
const PADE13 = [
  64764752532480000, 32382376266240000, 7771770303897600, 1187353796428800,
  129060195264000, 10559470521600, 670442572800, 33522128640,
  1323241920, 40840800, 960960, 16380, 182, 1,
];

/** Higham's theta_13 backward-error bound for double precision. */
const THETA13 = 5.371920351148152;

/**
 * Matrix exponential by scaling and squaring with a degree-13 Pade
 * approximant. Accurate to close to machine precision for the well-scaled,
 * small matrices produced by compartmental models.
 *
 * @param {Matrix} A
 * @returns {Matrix} exp(A)
 */
export function expm(A) {
  const n = A.length;
  const nrm = norm1(A);

  if (nrm === 0) return identity(n);

  const s = Math.max(0, Math.ceil(Math.log2(nrm / THETA13)));
  const As = s > 0 ? matScale(A, 1 / 2 ** s) : A.map((r) => r.slice());

  const I = identity(n);
  const A2 = matMul(As, As);
  const A4 = matMul(A2, A2);
  const A6 = matMul(A2, A4);
  const b = PADE13;

  // U = As * ( A6*(b13*A6 + b11*A4 + b9*A2) + b7*A6 + b5*A4 + b3*A2 + b1*I )
  const inner = matAdd(
    matAdd(matScale(A6, b[13]), matScale(A4, b[11])),
    matScale(A2, b[9])
  );
  const uTail = matAdd(
    matAdd(matScale(A6, b[7]), matScale(A4, b[5])),
    matAdd(matScale(A2, b[3]), matScale(I, b[1]))
  );
  const U = matMul(As, matAdd(matMul(A6, inner), uTail));

  // V = A6*(b12*A6 + b10*A4 + b8*A2) + b6*A6 + b4*A4 + b2*A2 + b0*I
  const innerV = matAdd(
    matAdd(matScale(A6, b[12]), matScale(A4, b[10])),
    matScale(A2, b[8])
  );
  const vTail = matAdd(
    matAdd(matScale(A6, b[6]), matScale(A4, b[4])),
    matAdd(matScale(A2, b[2]), matScale(I, b[0]))
  );
  const V = matAdd(matMul(A6, innerV), vTail);

  let R = solve(matSub(V, U), matAdd(V, U));
  for (let i = 0; i < s; i++) R = matMul(R, R);
  return R;
}
