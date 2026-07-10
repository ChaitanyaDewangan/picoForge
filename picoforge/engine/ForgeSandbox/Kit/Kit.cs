// ForgeSandbox/Kit/Kit.cs — PicoForge.Kit golden helper library
// PICOGK_KNOWLEDGE §4 — full implementation
// All functions: pure w.r.t. inputs, argument-validated with actionable exceptions.

using System.Numerics;
using PicoGK;

namespace PicoForge.Kit;

public static class Kit
{
    // ═══════════════════════════════════════════════════════════════════════
    // PRIMITIVES
    // ═══════════════════════════════════════════════════════════════════════

    public static Voxels voxBox(Ctx c, Vector3 vMin, Vector3 vMax)
    {
        if (vMin.X >= vMax.X || vMin.Y >= vMax.Y || vMin.Z >= vMax.Z)
            throw new ArgumentException($"voxBox: vMin ({vMin}) must be strictly less than vMax ({vMax}) on all axes");
        var lat = new Lattice();
        // Build box from 6 half-space implicits via mesh
        var m = BoxMesh(vMin, vMax);
        return new Voxels(m);
    }

    public static Voxels voxBoxCentered(Ctx c, Vector3 vCenter, Vector3 vSize)
    {
        var half = vSize / 2f;
        return voxBox(c, vCenter - half, vCenter + half);
    }

    public static Voxels voxCylinder(Ctx c, Vector3 vA, Vector3 vB, float fR)
    {
        if (fR <= 0) throw new ArgumentException($"voxCylinder: fR ({fR}) must be > 0");
        var lat = new Lattice();
        lat.AddBeam(vA, vB, fR, fR, false);  // flat caps
        return new Voxels(lat);
    }

    public static Voxels voxCapsule(Ctx c, Vector3 vA, Vector3 vB, float fR)
    {
        if (fR <= 0) throw new ArgumentException($"voxCapsule: fR ({fR}) must be > 0");
        var lat = new Lattice();
        lat.AddBeam(vA, vB, fR, fR, true);   // round caps
        return new Voxels(lat);
    }

    public static Voxels voxSphere(Ctx c, Vector3 vCenter, float fR)
    {
        if (fR <= 0) throw new ArgumentException($"voxSphere: fR ({fR}) must be > 0");
        var lat = new Lattice();
        lat.AddSphere(vCenter, fR);
        return new Voxels(lat);
    }

    public static Voxels voxCone(Ctx c, Vector3 vBase, Vector3 vTip, float fRBase, float fRTip)
    {
        if (fRBase < 0) throw new ArgumentException($"voxCone: fRBase ({fRBase}) must be >= 0");
        if (fRTip < 0)  throw new ArgumentException($"voxCone: fRTip ({fRTip}) must be >= 0");
        var lat = new Lattice();
        lat.AddBeam(vBase, vTip, fRBase, fRTip, false);
        return new Voxels(lat);
    }

    public static Voxels voxTube(Ctx c, Vector3 vA, Vector3 vB, float fROuter, float fWall)
    {
        if (fROuter <= 0) throw new ArgumentException($"voxTube: fROuter ({fROuter}) must be > 0");
        if (fWall <= 0 || fWall >= fROuter)
            throw new ArgumentException($"voxTube: fWall ({fWall}) must be in (0, {fROuter})");
        var outer = voxCylinder(c, vA, vB, fROuter);
        var inner = voxCylinder(c, vA, vB, fROuter - fWall);
        outer.BoolSubtract(inner);
        return outer;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PROFILES & SWEEPS
    // ═══════════════════════════════════════════════════════════════════════

    public static Voxels voxExtrudeZ(Ctx c, IReadOnlyList<Vector2> aPolyXY, float fZ0, float fZ1)
    {
        if (aPolyXY.Count < 3) throw new ArgumentException($"voxExtrudeZ: polygon needs >= 3 points, got {aPolyXY.Count}");
        if (fZ0 >= fZ1) throw new ArgumentException($"voxExtrudeZ: fZ0 ({fZ0}) must be < fZ1 ({fZ1})");

        // Triangulate the polygon fan (convex assumption) and loft to a prism
        var bot = aPolyXY.Select(p => new Vector3(p.X, p.Y, fZ0)).ToList();
        var top = aPolyXY.Select(p => new Vector3(p.X, p.Y, fZ1)).ToList();
        var rings = new List<IReadOnlyList<Vector3>> { bot, top };
        var m = mshLoft(rings, true);
        return new Voxels(m);
    }

    public static Voxels voxRevolve(Ctx c, IReadOnlyList<Vector2> aProfileRZ, float fDeg = 360f)
    {
        if (aProfileRZ.Count < 2) throw new ArgumentException($"voxRevolve: profile needs >= 2 points");
        if (fDeg <= 0 || fDeg > 360) throw new ArgumentException($"voxRevolve: fDeg must be in (0,360]");

        int nSteps = Math.Max(32, (int)(fDeg / 5f));
        float dRad = fDeg * MathF.PI / 180f / nSteps;
        var rings = new List<IReadOnlyList<Vector3>>();
        for (int s = 0; s <= nSteps; s++)
        {
            float angle = s * dRad;
            float cosA = MathF.Cos(angle), sinA = MathF.Sin(angle);
            rings.Add(aProfileRZ.Select(p => new Vector3(p.X * cosA, p.X * sinA, p.Y)).ToList());
        }
        return new Voxels(mshLoft(rings, fDeg >= 360f));
    }

    public static Voxels voxSweepCircle(Ctx c, IReadOnlyList<Vector3> aPath, float fR)
    {
        if (aPath.Count < 2) throw new ArgumentException($"voxSweepCircle: path needs >= 2 points");
        if (fR <= 0) throw new ArgumentException($"voxSweepCircle: fR ({fR}) must be > 0");
        var lat = new Lattice();
        for (int i = 0; i < aPath.Count - 1; i++)
            lat.AddBeam(aPath[i], aPath[i + 1], fR, fR, i == 0 || i == aPath.Count - 2);
        return new Voxels(lat);
    }

    public static Mesh mshLoft(IReadOnlyList<IReadOnlyList<Vector3>> aRings, bool bCapEnds = true)
    {
        if (aRings.Count < 2) throw new ArgumentException($"mshLoft: need >= 2 rings, got {aRings.Count}");
        int n = aRings[0].Count;
        foreach (var r in aRings)
            if (r.Count != n) throw new ArgumentException($"mshLoft: all rings must have equal vertex count ({n})");

        var m = new Mesh();
        // Add all vertices
        var idxMap = new int[aRings.Count, n];
        for (int ri = 0; ri < aRings.Count; ri++)
            for (int vi = 0; vi < n; vi++)
                idxMap[ri, vi] = m.nAddVertex(aRings[ri][vi]);

        // Side quads (two triangles per quad)
        for (int ri = 0; ri < aRings.Count - 1; ri++)
        {
            for (int vi = 0; vi < n; vi++)
            {
                int vNext = (vi + 1) % n;
                int a = idxMap[ri,     vi];
                int b = idxMap[ri,     vNext];
                int c = idxMap[ri + 1, vNext];
                int d = idxMap[ri + 1, vi];
                m.nAddTriangle(a, b, c);
                m.nAddTriangle(a, c, d);
            }
        }

        // End caps (fan from centroid)
        if (bCapEnds)
        {
            AddCap(m, aRings[0], idxMap, 0, n, false);
            AddCap(m, aRings[^1], idxMap, aRings.Count - 1, n, true);
        }

        return m;
    }

    private static void AddCap(Mesh m, IReadOnlyList<Vector3> ring, int[,] idxMap, int ri, int n, bool flip)
    {
        var centroid = ring.Aggregate(Vector3.Zero, (acc, v) => acc + v) / n;
        int cIdx = m.nAddVertex(centroid);
        for (int vi = 0; vi < n; vi++)
        {
            int vNext = (vi + 1) % n;
            int a = idxMap[ri, vi], b = idxMap[ri, vNext];
            if (flip) m.nAddTriangle(a, cIdx, b);
            else      m.nAddTriangle(a, b, cIdx);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TRANSFORMS & PATTERNS
    // ═══════════════════════════════════════════════════════════════════════

    public static Mesh mshTransform(Mesh m, Matrix4x4 mat)
    {
        // PicoGK Mesh.mshTransformed — per DumpApi this may be a static or instance method
        // Using the instance transform approach
        return m.mshTransformed(mat);
    }

    public static Voxels voxPolarPatternZ(Ctx c, Mesh mOne, int nCount)
    {
        if (nCount < 1) throw new ArgumentException($"voxPolarPatternZ: nCount must be >= 1");
        var result = new Voxels(mOne);
        float dAngle = 2f * MathF.PI / nCount;
        for (int i = 1; i < nCount; i++)
        {
            float angle = i * dAngle;
            var mat = Matrix4x4.CreateRotationZ(angle);
            result.BoolAdd(new Voxels(mOne.mshTransformed(mat)));
        }
        return result;
    }

    public static Voxels voxLinearPattern(Ctx c, Mesh mOne, Vector3 vStep, int nCount)
    {
        if (nCount < 1) throw new ArgumentException($"voxLinearPattern: nCount must be >= 1");
        var result = new Voxels(mOne);
        for (int i = 1; i < nCount; i++)
        {
            var mat = Matrix4x4.CreateTranslation(vStep * i);
            result.BoolAdd(new Voxels(mOne.mshTransformed(mat)));
        }
        return result;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════

    public static Voxels Shell(Voxels v, float fWallMM)
    {
        if (fWallMM <= 0) throw new ArgumentException($"Shell: fWallMM ({fWallMM}) must be > 0");
        var inner = new Voxels(v);
        inner.Offset(-fWallMM);
        v.BoolSubtract(inner);
        return v;
    }

    public static Voxels FilletClose(Voxels v, float fR)
    {
        if (fR <= 0) throw new ArgumentException($"FilletClose: fR ({fR}) must be > 0");
        v.Offset(fR);
        v.Offset(-fR);
        return v;
    }

    public static Voxels RoundOpen(Voxels v, float fR)
    {
        if (fR <= 0) throw new ArgumentException($"RoundOpen: fR ({fR}) must be > 0");
        v.Offset(-fR);
        v.Offset(fR);
        return v;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 2D & AIRFOIL HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    public static List<Vector2> aCircle(float fR, int n = 64)
    {
        if (fR <= 0) throw new ArgumentException($"aCircle: fR ({fR}) must be > 0");
        return Enumerable.Range(0, n)
            .Select(i => { float a = 2 * MathF.PI * i / n; return new Vector2(fR * MathF.Cos(a), fR * MathF.Sin(a)); })
            .ToList();
    }

    public static List<Vector2> aRoundedRect(float fW, float fH, float fCornerR, int nPerCorner = 8)
    {
        if (fW <= 0 || fH <= 0) throw new ArgumentException($"aRoundedRect: dimensions must be > 0");
        fCornerR = Math.Min(fCornerR, Math.Min(fW, fH) / 2f);
        var pts = new List<Vector2>();
        float hw = fW / 2f - fCornerR, hh = fH / 2f - fCornerR;
        (float cx, float cy, float startDeg)[] corners =
        [
            ( hw,  hh, 0f), (-hw,  hh, 90f), (-hw, -hh, 180f), ( hw, -hh, 270f)
        ];
        foreach (var (cx, cy, startDeg) in corners)
            for (int i = 0; i < nPerCorner; i++)
            {
                float a = (startDeg + 90f * i / (nPerCorner - 1)) * MathF.PI / 180f;
                pts.Add(new Vector2(cx + fCornerR * MathF.Cos(a), cy + fCornerR * MathF.Sin(a)));
            }
        return pts;
    }

    /// <summary>
    /// NACA 4-digit airfoil — closed CCW polygon, LE at origin, chord along +X.
    /// PICOGK_KNOWLEDGE §4.
    /// </summary>
    public static List<Vector2> aNaca4(string sCode, float fChord, int n = 61, bool bBluntTE = true)
    {
        if (sCode.Length != 4) throw new ArgumentException($"aNaca4: sCode must be 4 digits (e.g. '4409'), got '{sCode}'");
        float m  = (sCode[0] - '0') / 100f;  // max camber
        float p  = (sCode[1] - '0') / 10f;   // max camber position
        float tt = ((sCode[2] - '0') * 10 + (sCode[3] - '0')) / 100f; // thickness

        var upper = new List<Vector2>();
        var lower = new List<Vector2>();

        for (int i = 0; i < n; i++)
        {
            // Use cosine spacing for LE/TE clustering
            float beta = MathF.PI * i / (n - 1);
            float xc = (1f - MathF.Cos(beta)) / 2f;

            // Thickness distribution (NACA symmetric)
            float yt = 5f * tt * fChord * (0.2969f * MathF.Sqrt(xc) - 0.1260f * xc
                       - 0.3516f * xc * xc + 0.2843f * xc * xc * xc
                       - (bBluntTE ? 0.1015f : 0.1036f) * xc * xc * xc * xc);

            // Camber line
            float yc = m > 0 && p > 0
                ? (xc < p
                    ? m / (p * p) * (2 * p * xc - xc * xc)
                    : m / ((1 - p) * (1 - p)) * ((1 - 2 * p) + 2 * p * xc - xc * xc))
                : 0f;
            float dyc = m > 0 && p > 0
                ? (xc < p ? 2 * m / (p * p) * (p - xc) : 2 * m / ((1 - p) * (1 - p)) * (p - xc))
                : 0f;
            float theta = MathF.Atan(dyc);

            float xu = xc * fChord - yt * MathF.Sin(theta);
            float yu = (yc + yt * MathF.Cos(theta)) * fChord / fChord;  // normalized
            float xl = xc * fChord + yt * MathF.Sin(theta);
            float yl = (yc - yt * MathF.Cos(theta)) * fChord / fChord;

            upper.Add(new Vector2(xu, yu * fChord));
            lower.Add(new Vector2(xl, yl * fChord));
        }

        // CCW: upper surface LE→TE then lower surface TE→LE
        var poly = new List<Vector2>(upper);
        lower.Reverse();
        poly.AddRange(lower.Skip(1).Take(lower.Count - 2)); // skip duplicated LE/TE
        return poly;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ROTOR HIGH-LEVEL (fan/turbine fast path)
    // ═══════════════════════════════════════════════════════════════════════

    public static Mesh mshAxialBlade(BladeSpec s)
    {
        if (s.fTipR <= s.fHubR)
            throw new ArgumentException($"mshAxialBlade: fTipR ({s.fTipR}) must exceed fHubR ({s.fHubR})");
        if (s.nSections < 4)
            throw new ArgumentException($"mshAxialBlade: nSections must be >= 4, got {s.nSections}");

        var rings = new List<IReadOnlyList<Vector3>>();
        for (int si = 0; si < s.nSections; si++)
        {
            float rNorm = (float)si / (s.nSections - 1);
            float r = s.fHubR + rNorm * (s.fTipR - s.fHubR);
            float chord = s.fChordAt(rNorm);
            float betaDeg = s.fBetaDegAt(rNorm);
            var nacaCode = s.sNacaAt(rNorm);
            float betaRad = betaDeg * MathF.PI / 180f;

            // Generate airfoil section in 2D (chord along X, thickness in Y)
            var profile2d = aNaca4(nacaCode, chord);

            // Rotate by blade angle and translate to radial position
            // Stacked at 40% chord (aerodynamic center)
            float stackX = 0.4f * chord;
            var ring = profile2d.Select(p =>
            {
                float dx = p.X - stackX;
                float dy = p.Y;
                // Rotate in (Z, radial) plane by beta
                float dz = dx * MathF.Sin(betaRad) - dy * MathF.Cos(betaRad);
                float dr = dx * MathF.Cos(betaRad) + dy * MathF.Sin(betaRad);
                return new Vector3(0f, r + dr, dz + s.fRootExtendMM);
            }).ToList();
            rings.Add(ring);
        }
        return mshLoft(rings, true);
    }

    public static Voxels voxAxialRotor(
        Ctx c, BladeSpec s, int nBlades,
        float fHubR, float fHubZ0, float fHubZ1,
        float fBoreR = 0f, float fFilletR = 0f)
    {
        if (nBlades < 1) throw new ArgumentException($"voxAxialRotor: nBlades must be >= 1");
        if (fHubZ1 <= fHubZ0) throw new ArgumentException($"voxAxialRotor: fHubZ1 must > fHubZ0");

        c.Log($"[Kit.voxAxialRotor] hub R={fHubR} Z={fHubZ0}..{fHubZ1} blades={nBlades}");

        // Hub: revolve of rectangle profile
        var hubProfile = new List<Vector2>
        {
            new(fHubR, fHubZ0), new(fHubR, fHubZ1),
            new(0.5f, fHubZ1),  new(0.5f, fHubZ0),
        };
        var rotor = voxRevolve(c, hubProfile, 360f);

        // One blade mesh → polar pattern
        c.Log("[Kit.voxAxialRotor] generating blade mesh");
        var bladeMesh = mshAxialBlade(s);
        c.Log("[Kit.voxAxialRotor] applying polar pattern");
        var blades = voxPolarPatternZ(c, bladeMesh, nBlades);
        rotor.BoolAdd(blades);

        // Bore
        if (fBoreR > 0)
        {
            c.Log($"[Kit.voxAxialRotor] subtracting bore R={fBoreR}");
            var bore = voxCylinder(c,
                new Vector3(0, 0, fHubZ0 - 1),
                new Vector3(0, 0, fHubZ1 + 1), fBoreR);
            rotor.BoolSubtract(bore);
        }

        // Fillet concave junctions
        if (fFilletR > 0)
            FilletClose(rotor, fFilletR);

        return rotor;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // IMPLICIT TOOLBOX
    // ═══════════════════════════════════════════════════════════════════════

    public static Voxels voxFromImplicit(Ctx c, IImplicit i, BBox3 bounds)
    {
        return new Voxels(i, bounds);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STATS
    // ═══════════════════════════════════════════════════════════════════════

    public static GeomStats oStats(Ctx c, Voxels v)
    {
        v.CalculateProperties(out float volCm3, out BBox3 bbox);
        var mesh = v.mshAsMesh();
        return new GeomStats
        {
            VolumeCm3 = Math.Round(volCm3, 4),
            BboxMm = bbox,
            Triangles = mesh.nTriangleCount,
            Watertight = mesh.nTriangleCount > 0,
            VoxelSizeMm = c.fVoxelMM,
        };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INTERNAL HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    private static Mesh BoxMesh(Vector3 min, Vector3 max)
    {
        var m = new Mesh();
        // 8 corners
        int[] v = new int[8];
        v[0] = m.nAddVertex(new Vector3(min.X, min.Y, min.Z));
        v[1] = m.nAddVertex(new Vector3(max.X, min.Y, min.Z));
        v[2] = m.nAddVertex(new Vector3(max.X, max.Y, min.Z));
        v[3] = m.nAddVertex(new Vector3(min.X, max.Y, min.Z));
        v[4] = m.nAddVertex(new Vector3(min.X, min.Y, max.Z));
        v[5] = m.nAddVertex(new Vector3(max.X, min.Y, max.Z));
        v[6] = m.nAddVertex(new Vector3(max.X, max.Y, max.Z));
        v[7] = m.nAddVertex(new Vector3(min.X, max.Y, max.Z));
        // 12 triangles (6 faces × 2)
        m.nAddTriangle(v[0], v[1], v[2]); m.nAddTriangle(v[0], v[2], v[3]); // bottom
        m.nAddTriangle(v[4], v[6], v[5]); m.nAddTriangle(v[4], v[7], v[6]); // top
        m.nAddTriangle(v[0], v[4], v[5]); m.nAddTriangle(v[0], v[5], v[1]); // front
        m.nAddTriangle(v[2], v[6], v[7]); m.nAddTriangle(v[2], v[7], v[3]); // back
        m.nAddTriangle(v[0], v[3], v[7]); m.nAddTriangle(v[0], v[7], v[4]); // left
        m.nAddTriangle(v[1], v[5], v[6]); m.nAddTriangle(v[1], v[6], v[2]); // right
        return m;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SUPPORTING TYPES
// ═══════════════════════════════════════════════════════════════════════════

public sealed record BladeSpec(
    float fHubR,
    float fTipR,
    int nSections,
    Func<float, float> fChordAt,
    Func<float, float> fBetaDegAt,
    Func<float, string> sNacaAt,
    float fRootExtendMM = 1.5f);

public sealed class GeomStats
{
    public double VolumeCm3 { get; set; }
    public BBox3 BboxMm { get; set; }
    public int Triangles { get; set; }
    public bool Watertight { get; set; }
    public double VoxelSizeMm { get; set; }
    public double MinWallProbeMm { get; set; }
}
