"""Independent check of free square plate frequencies (Kirchhoff plate, all edges free).

Conforming C1 Argyris triangles (scikit-fem), unit square, D = rho*h = 1, so the
frequency parameter is lambda = omega * a^2 * sqrt(rho*h/D) = sqrt(eigenvalue).
No boundary conditions: free edges are natural. Three rigid-body modes come out at ~0.
"""

import sys

import numpy as np
from scipy.sparse.linalg import eigsh
from skfem import Basis, BilinearForm, ElementTriArgyris, MeshTri, asm
from skfem.helpers import dd, ddot, trace

NU = 0.3


@BilinearForm
def bending(u, v, w):
    # D * [ (1-nu) u_ij v_ij + nu * lap u * lap v ]  with D = 1
    return (1 - NU) * ddot(dd(u), dd(v)) + NU * trace(dd(u)) * trace(dd(v))


@BilinearForm
def mass(u, v, w):
    return u * v


def solve(refine: int, k: int = 40):
    mesh = MeshTri.init_symmetric().refined(refine)  # symmetric about both centre lines and diagonals
    basis = Basis(mesh, ElementTriArgyris())
    K = asm(bending, basis)
    M = asm(mass, basis)
    vals, vecs = eigsh(K, k=k, M=M, sigma=-1.0, which="LM")
    order = np.argsort(vals)
    vals, vecs = vals[order], vecs[:, order]
    lam = np.sqrt(np.clip(vals, 0, None))
    return basis, lam, vecs


def symmetry(basis, vec):
    """Classify a mode by its parity under x -> 1-x, y -> 1-y and the diagonal swap x <-> y."""
    rng = np.random.default_rng(0)
    p = rng.uniform(0.05, 0.95, size=(2, 400))
    f = basis.probes(p) @ vec
    fx = basis.probes(np.vstack([1 - p[0], p[1]])) @ vec
    fy = basis.probes(np.vstack([p[0], 1 - p[1]])) @ vec
    fd = basis.probes(np.vstack([p[1], p[0]])) @ vec
    n = np.linalg.norm(f)

    def par(g):
        if np.linalg.norm(g - f) < 1e-3 * n:
            return "S"
        if np.linalg.norm(g + f) < 1e-3 * n:
            return "A"
        return "-"  # degenerate pair: mixed in the solver's basis

    return par(fx) + par(fy) + par(fd)


if __name__ == "__main__":
    levels = [int(a) for a in sys.argv[1:]] or [3, 4, 5]
    results = {}
    for r in levels:
        basis, lam, vecs = solve(r)
        results[r] = lam
        print(f"refine {r}: {basis.N} dofs")
    r = levels[-1]
    basis, lam, vecs = solve(r)
    print("\nmode  " + "  ".join(f"r{lv:<9}" for lv in levels) + " symmetry(x,y,diag)")
    for i in range(3, len(lam)):
        if lam[i] > 215:
            break
        row = "  ".join(f"{results[lv][i]:10.4f}" for lv in levels)
        print(f"{i - 2:4d}  {row}  {symmetry(basis, vecs[:, i])}")
    for target in (65.368, 173.695):
        nearest = lam[np.argmin(np.abs(lam - target))]
        print(f"\nnearest mode to {target}: {nearest:.4f} (gap {abs(nearest - target):.3f})")
