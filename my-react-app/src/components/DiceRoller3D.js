import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useRoom } from "../context/RoomContext";
import { useAuth } from "../auth/AuthContext";
import dmTokenImg from "../assets/dm-token.png";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Constants
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const DICE_TYPES = [4, 6, 8, 10, 12, 20, 100];
const MAX_DICE = 5;
const CFG = {
  4:   { label: "d4",  ms: 650 },
  6:   { label: "d6",  ms: 750 },
  8:   { label: "d8",  ms: 800 },
  10:  { label: "d10", ms: 850 },
  12:  { label: "d12", ms: 950 },
  20:  { label: "d20", ms: 1100 },
  100: { label: "d%",  ms: 900 },
};

const DIE_COLORS = {
  4:   "#c0392b",
  6:   "#2471a3",
  8:   "#1e8449",
  10:  "#d4ac0d",
  12:  "#7d3c98",
  20:  "#ca6f1e",
  100: "#148f77",
};

let uid = 0;
const rnd = (n) => Math.floor(Math.random() * n) + 1;

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Geometry helpers
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/** Ensure every triangle's normal points away from origin (convex shapes only) */
function fixWinding(geo) {
  const pos = geo.attributes.position;
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3(),
    ab = new THREE.Vector3(),
    ac = new THREE.Vector3(),
    n = new THREE.Vector3(),
    cen = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    cen.copy(a).add(b).add(c).divideScalar(3);
    n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
    if (n.dot(cen) < 0) {
      pos.setXYZ(i + 1, c.x, c.y, c.z);
      pos.setXYZ(i + 2, b.x, b.y, b.z);
    }
  }
}

function createD10Geo(radius) {
  /*
   * Pentagonal trapezohedron with exactly planar kite faces.
   * Geometric constraint for coplanar kite vertices:
   *   H / h = (1 + cos(π/5)) / (1 - cos(π/5))  ≈ 9.472
   * where H = apex half-height, h = ring half-height.
   */
  const cos36 = Math.cos(Math.PI / 5);          // 0.80902
  const h = 0.075;                               // ring half-height (normalised)
  const H = h * (1 + cos36) / (1 - cos36);      // apex half-height ≈ 0.710
  const R = 0.50;                                // ring radius

  const top = new THREE.Vector3(0,  H * radius, 0);
  const bot = new THREE.Vector3(0, -H * radius, 0);
  const upper = [], lower = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    upper.push(new THREE.Vector3(Math.cos(a) * R * radius, h * radius, Math.sin(a) * R * radius));
  }
  for (let i = 0; i < 5; i++) {
    const a = ((i + 0.5) / 5) * Math.PI * 2;
    lower.push(new THREE.Vector3(Math.cos(a) * R * radius, -h * radius, Math.sin(a) * R * radius));
  }
  const v = [];
  const tri = (p, q, r) => v.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
  for (let i = 0; i < 5; i++) {
    const ni = (i + 1) % 5;
    // Upper kite: top, upper[i], lower[i], upper[ni]  (2 tris)
    tri(top, upper[i], lower[i]);
    tri(top, lower[i], upper[ni]);
    // Lower kite: bot, lower[i], upper[ni], lower[ni]  (2 tris)
    tri(bot, lower[i], upper[ni]);
    tri(bot, upper[ni], lower[ni]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  fixWinding(geo);
  geo.computeVertexNormals();
  return geo;
}

function buildGeo(sides) {
  const r = 0.65;
  switch (sides) {
    case 4:  return new THREE.TetrahedronGeometry(r);
    case 6: {
      const g = new THREE.BoxGeometry(r * 1.1, r * 1.1, r * 1.1);
      return g.index ? g.toNonIndexed() : g;
    }
    case 8:  return new THREE.OctahedronGeometry(r);
    case 10:
    case 100: return createD10Geo(r);
    case 12: return new THREE.DodecahedronGeometry(r);
    case 20: return new THREE.IcosahedronGeometry(r);
    default: return new THREE.IcosahedronGeometry(r);
  }
}

/** Cluster triangles by shared normal to identify logical faces */
function extractFaces(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position;
  const tris = [];
  for (let i = 0; i < pos.count; i += 3) {
    const a = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const b = new THREE.Vector3(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
    const c = new THREE.Vector3(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
    const n = new THREE.Vector3()
      .crossVectors(
        new THREE.Vector3().subVectors(b, a),
        new THREE.Vector3().subVectors(c, a)
      )
      .normalize();
    tris.push({ v: [a, b, c], n });
  }
  const faces = [];
  const used = new Set();
  for (let i = 0; i < tris.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    const grp = [tris[i]];
    for (let j = i + 1; j < tris.length; j++) {
      if (used.has(j)) continue;
      if (tris[i].n.distanceTo(tris[j].n) < 0.05) {
        grp.push(tris[j]);
        used.add(j);
      }
    }
    const all = grp.flatMap((t) => t.v);
    const c = new THREE.Vector3();
    all.forEach((v) => c.add(v));
    c.divideScalar(all.length);
    faces.push({ centroid: c, normal: tris[i].n.clone() });
  }
  return faces;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Number textures on die faces (cached)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const _texCache = {};
function numTex(num) {
  if (_texCache[num]) return _texCache[num];
  const sz = 256;
  const c = document.createElement("canvas");
  c.width = sz;
  c.height = sz;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${sz * 0.6}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const str = num === 0 ? "00" : String(num);
  ctx.fillText(str, sz / 2, sz / 2);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  _texCache[num] = t;
  return t;
}

/* Label plane size per die type — tuned after scale normalisation */
const LABEL_SZ = { 4: 0.38, 6: 0.38, 8: 0.36, 10: 0.35, 12: 0.32, 20: 0.26, 100: 0.35 };

const PLANE_Z = new THREE.Vector3(0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);
/* Camera sits at [0, 4.5, 3] — result face should point toward it */
const CAM_POS = new THREE.Vector3(0, 4.5, 3);
const TOWARD_CAM = CAM_POS.clone().normalize();

/**
 * Build a quaternion that orients a plane so its +Z axis aligns with `normal`
 * and its +Y axis is as close to world-up as possible → text reads right-side-up.
 */
function faceQuat(normal) {
  const z = normal.clone().normalize();
  let ref = UP.clone();
  if (Math.abs(z.dot(ref)) > 0.99) ref.set(0, 0, 1);
  const x = new THREE.Vector3().crossVectors(ref, z).normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Precomputed die data cache (geometry + faces)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
let _dieDataCache = {};
function getDieData(sides) {
  if (_dieDataCache[sides]) return _dieDataCache[sides];
  const raw = buildGeo(sides);
  const geometry = raw.index ? raw.toNonIndexed() : raw;

  /* Normalise all dice to the same bounding-sphere radius so they appear
     the same size regardless of polyhedron type. */
  geometry.computeBoundingSphere();
  const TARGET_R = 0.65;
  const s = TARGET_R / geometry.boundingSphere.radius;
  geometry.scale(s, s, s);

  const faces = extractFaces(geometry);
  _dieDataCache[sides] = { geometry, faces };
  return _dieDataCache[sides];
}
/* Clear cache on hot-reload so geometry changes take effect */
if (module.hot) { module.hot.dispose(() => { _dieDataCache = {}; }); }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Die3D — single 3D die with face labels + animation
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function Die3D({ sides, resultFaceIdx, rolling, selected, onClick, onRemove, position, color }) {
  const groupRef = useRef();
  const { geometry, faces } = getDieData(sides);
  const numFaces = sides === 100 ? 10 : sides;

  /* Face label planes — oriented so text reads right-side-up */
  const labels = useMemo(() => {
    const out = [];
    const count = Math.min(faces.length, numFaces);
    for (let i = 0; i < count; i++) {
      const num = sides === 100 ? i * 10 : i + 1;
      const q = faceQuat(faces[i].normal);
      const p = faces[i].centroid.clone().addScaledVector(faces[i].normal, 0.007);
      out.push({ pos: p.toArray(), quat: [q.x, q.y, q.z, q.w], tex: numTex(num) });
    }
    return out;
  }, [faces, numFaces, sides]);

  const sz = LABEL_SZ[sides] || 0.25;

  /* Compute an initial upright orientation so the die looks correct before any roll.
     Uses face 0 as the default visible face and the same twist-correction logic. */
  const initialQ = useMemo(() => {
    if (!faces.length) return new THREE.Quaternion();
    const fNormal = faces[0].normal;
    const q1 = new THREE.Quaternion().setFromUnitVectors(fNormal, TOWARD_CAM);
    const labelQ = faceQuat(fNormal);
    const labelUp = new THREE.Vector3(0, 1, 0).applyQuaternion(labelQ);
    const labelUpAfter = labelUp.clone().applyQuaternion(q1);
    const projLabel = labelUpAfter.clone()
      .addScaledVector(TOWARD_CAM, -labelUpAfter.dot(TOWARD_CAM));
    const projScreen = UP.clone()
      .addScaledVector(TOWARD_CAM, -UP.dot(TOWARD_CAM));
    if (projLabel.length() > 1e-4 && projScreen.length() > 1e-4) {
      projLabel.normalize();
      projScreen.normalize();
      let angle = Math.acos(Math.min(1, Math.max(-1, projLabel.dot(projScreen))));
      const cross = new THREE.Vector3().crossVectors(projLabel, projScreen);
      if (cross.dot(TOWARD_CAM) < 0) angle = -angle;
      const qTwist = new THREE.Quaternion().setFromAxisAngle(TOWARD_CAM, angle);
      return new THREE.Quaternion().multiplyQuaternions(qTwist, q1);
    }
    return q1;
  }, [faces]);

  /* Apply initial orientation on mount */
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.quaternion.copy(initialQ);
    }
  }, [initialQ]);

  /* Animation state */
  const anim = useRef({
    phase: "idle",
    sx: 0, sy: 0, sz: 0,
    elapsed: 0,
    duration: 1,
    settleAt: 0,
    startQ: new THREE.Quaternion(),
    targetQ: new THREE.Quaternion(),
  });

  /* Kick off roll when `rolling` flips true */
  const prevRolling = useRef(false);
  useEffect(() => {
    if (rolling && !prevRolling.current && groupRef.current) {
      const a = anim.current;
      a.phase = "spin";
      a.elapsed = 0;
      const sign = () => (Math.random() < 0.5 ? 1 : -1);
      a.sx = (14 + Math.random() * 16) * sign();
      a.sy = (14 + Math.random() * 16) * sign();
      a.sz = (14 + Math.random() * 16) * sign();
      a.duration = (CFG[sides]?.ms || 900) / 1000;
      a.settleAt = a.duration * 0.45;

      /* Target: result face normal → toward camera, then twist-correct
         so the face-label text reads upright on screen.
         We use the label's own +Y axis (from faceQuat) as the reference
         instead of world-up, which degenerates when the face normal ≈ UP. */
      if (resultFaceIdx != null && faces[resultFaceIdx]) {
        const fNormal = faces[resultFaceIdx].normal;
        const q1 = new THREE.Quaternion().setFromUnitVectors(fNormal, TOWARD_CAM);

        /* Label's local +Y in die-local space */
        const labelQ = faceQuat(fNormal);
        const labelUp = new THREE.Vector3(0, 1, 0).applyQuaternion(labelQ);

        /* Where does the label's up end up after q1? */
        const labelUpAfter = labelUp.clone().applyQuaternion(q1);

        /* Project both onto the plane ⊥ TOWARD_CAM (= screen plane) */
        const projLabel = labelUpAfter.clone()
          .addScaledVector(TOWARD_CAM, -labelUpAfter.dot(TOWARD_CAM));
        const projScreen = UP.clone()
          .addScaledVector(TOWARD_CAM, -UP.dot(TOWARD_CAM));

        if (projLabel.length() > 1e-4 && projScreen.length() > 1e-4) {
          projLabel.normalize();
          projScreen.normalize();
          let angle = Math.acos(
            Math.min(1, Math.max(-1, projLabel.dot(projScreen)))
          );
          const cross = new THREE.Vector3().crossVectors(projLabel, projScreen);
          if (cross.dot(TOWARD_CAM) < 0) angle = -angle;
          const qTwist = new THREE.Quaternion().setFromAxisAngle(TOWARD_CAM, angle);
          a.targetQ.multiplyQuaternions(qTwist, q1);
        } else {
          a.targetQ.copy(q1);
        }
      }
    }
    prevRolling.current = rolling;
  }, [rolling, resultFaceIdx, faces, sides]);

  /* Per-frame animation */
  useFrame((_, dt) => {
    if (!groupRef.current) return;
    const a = anim.current;
    if (a.phase === "idle") return;
    a.elapsed += dt;

    if (a.phase === "spin") {
      const t = a.elapsed / a.duration;
      const slow = Math.max(0.15, 1 - t * 1.1);
      groupRef.current.quaternion.multiply(
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(a.sx * dt * slow, a.sy * dt * slow, a.sz * dt * slow)
        )
      );
      if (a.elapsed >= a.settleAt) {
        a.phase = "settle";
        a.startQ.copy(groupRef.current.quaternion);
      }
    } else if (a.phase === "settle") {
      const remaining = a.duration - a.settleAt;
      const t = Math.min((a.elapsed - a.settleAt) / remaining, 1);
      const e = 1 - Math.pow(1 - t, 3);
      groupRef.current.quaternion.slerpQuaternions(a.startQ, a.targetQ, e);
      if (t >= 1) {
        groupRef.current.quaternion.copy(a.targetQ);
        a.phase = "idle";
      }
    }
  });

  const onOver = useCallback(() => { document.body.style.cursor = "pointer"; }, []);
  const onOut  = useCallback(() => { document.body.style.cursor = "auto"; }, []);

  const matColor = selected ? "#818cf8" : color;
  const emissive = selected ? "#6366f1" : "#000000";
  const emissiveI = selected ? 0.5 : 0;

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onContextMenu={(e) => { e.nativeEvent?.preventDefault?.(); e.stopPropagation(); onRemove(); }}
      onPointerOver={onOver}
      onPointerOut={onOut}
    >
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={matColor}
          emissive={emissive}
          emissiveIntensity={emissiveI}
          roughness={0.85}
          metalness={0.0}
          flatShading
        />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[geometry, 15]} />
        <lineBasicMaterial color={selected ? "#a5b4fc" : "#1a1a2e"} />
      </lineSegments>
      {labels.map((lbl, i) => (
        <mesh key={i} position={lbl.pos} quaternion={lbl.quat}>
          <planeGeometry args={[sz, sz]} />
          <meshBasicMaterial map={lbl.tex} transparent depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   FloatingNumber — animated pop-up sprite above a die
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const _floatTexCache = {};
function floatTex(value) {
  if (_floatTexCache[value]) return _floatTexCache[value];
  const sz = 256;
  const c = document.createElement("canvas");
  c.width = sz;
  c.height = sz;
  const ctx = c.getContext("2d");
  /* dark pill background */
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  const pad = 16, rr = 24, w = sz - pad * 2, h2 = sz * 0.54;
  const y0 = (sz - h2) / 2;
  ctx.beginPath();
  ctx.roundRect(pad, y0, w, h2, rr);
  ctx.fill();
  /* white number */
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${sz * 0.48}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(value), sz / 2, sz / 2);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  _floatTexCache[value] = t;
  return t;
}

const FLOAT_TARGET = 0.9;
const FLOAT_POP_MS = 350;

function FloatingNumber({ value, position }) {
  const ref = useRef();
  const tex = useMemo(() => floatTex(value), [value]);
  const birth = useRef(performance.now());

  useFrame(() => {
    if (!ref.current) return;
    const t = Math.min((performance.now() - birth.current) / FLOAT_POP_MS, 1);
    /* back-ease-out: overshoots ~20% then settles */
    const c = 2.2;
    const e = t >= 1 ? 1 : 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    const s = e * FLOAT_TARGET;
    ref.current.scale.set(s, s, 1);
  });

  return (
    <sprite ref={ref} position={position} scale={[0, 0, 1]}>
      <spriteMaterial map={tex} transparent depthWrite={false} depthTest={false} />
    </sprite>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DiceTray3D — the <Canvas> scene
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function DiceTray3D({ dice, onToggleSelect, onRemoveDie }) {
  const spacing = 1.5;
  const cols = 5;
  const rows = Math.ceil(dice.length / cols);
  const canvasH = rows <= 1 ? 240 : 380;

  return (
    <div className="dice-canvas-wrap" onContextMenu={(e) => e.preventDefault()}>
      <Canvas
        camera={{ position: [0, 4.5, 3], fov: 45 }}
        style={{ width: "100%", height: `${canvasH}px` }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ camera, gl }) => { camera.lookAt(0, 0, 0); gl.setClearColor(0x000000, 0); }}
      >
        <ambientLight intensity={1.1} />
        <directionalLight position={[4, 10, 6]} intensity={0.35} />
        <directionalLight position={[-3, 6, -4]} intensity={0.15} />

        {dice.map((d, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const countInRow = row === Math.floor((dice.length - 1) / cols)
            ? ((dice.length - 1) % cols) + 1
            : cols;
          const x = (col - (countInRow - 1) / 2) * spacing;
          const z = (row - (Math.ceil(dice.length / cols) - 1) / 2) * spacing;
          return (
            <group key={d.id}>
              <Die3D
                sides={d.sides}
                resultFaceIdx={d.resultFace}
                rolling={d.rolling}
                selected={d.selected}
                onClick={() => onToggleSelect(d.id)}
                onRemove={() => onRemoveDie(d.id)}
                position={[x, 0, z]}
                color={DIE_COLORS[d.sides] || "#888"}
              />
              {/* floating labels removed — results shown in popup */}
            </group>
          );
        })}
      </Canvas>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DieShape SVG (picker buttons)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function DieShape({ sides }) {
  switch (sides) {
    case 4:   return <polygon points="50,8 94,88 6,88" />;
    case 6:   return <rect x="10" y="10" width="80" height="80" rx="6" />;
    case 8:   return <polygon points="50,7 93,50 50,93 7,50" />;
    case 10:  return <polygon points="50,7 89,38 78,90 22,90 11,38" />;
    case 12:  return <polygon points="50,5 86,19 96,57 74,93 26,93 4,57 14,19" />;
    case 20:  return <polygon points="50,5 92,27 92,73 50,95 8,73 8,27" />;
    case 100: return <circle cx="50" cy="50" r="42" />;
    default:  return <circle cx="50" cy="50" r="42" />;
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DiceRollPopup — shows results with character info
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const POPUP_DURATION = 6000;

function DiceRollPopup({ roll, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, POPUP_DURATION);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="dice-roll-popup">
      <div className="dice-roll-popup-inner">
        <button className="dice-roll-popup-close" onClick={onDismiss} title="Dismiss">&times;</button>
        <div className="dice-roll-popup-header">
          {roll.imageUrl
            ? <img className="dice-roll-popup-avatar" src={roll.imageUrl} alt={roll.characterName} />
            : <div className="dice-roll-popup-avatar dice-roll-popup-avatar-placeholder" />}
          <span className="dice-roll-popup-name">{roll.characterName}</span>
        </div>
        <div className="dice-roll-popup-dice">
          {roll.results.map((r, i) => (
            <span key={i} className="dice-roll-popup-die">{r.value}</span>
          ))}
        </div>
        <div className="dice-roll-popup-total">
          Total: <strong>{roll.total}</strong>
        </div>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Main DiceRoller3D component
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default function DiceRoller3D() {
  const [open, setOpen] = useState(false);
  const [dice, setDice] = useState([]);
  const [rolling, setRolling] = useState(false);
  const [popups, setPopups] = useState([]);
  const rollTimer = useRef(null);

  const { room, broadcastDiceRoll, onDiceRolled, offDiceRolled } = useRoom();
  const { auth } = useAuth();

  /* Listen for remote dice rolls from other players */
  useEffect(() => {
    const handler = (rollData) => {
      setPopups((prev) => [...prev, { ...rollData, id: uid++ }]);
    };
    onDiceRolled(handler);
    return () => offDiceRolled(handler);
  }, [onDiceRolled, offDiceRolled]);

  const dismissPopup = useCallback((popupId) => {
    setPopups((prev) => prev.filter((p) => p.id !== popupId));
  }, []);

  const addDie = (sides) => {
    if (dice.length >= MAX_DICE || rolling) return;
    setDice((d) => [
      ...d,
      { id: uid++, sides, display: "--", rolling: false, selected: false, resultFace: 0 },
    ]);
  };

  const computeResult = useCallback((d) => {
    const value = rnd(d.sides);
    const { faces } = getDieData(d.sides);
    const numFaces = d.sides === 100 ? 10 : d.sides;
    const clamped = Math.min(faces.length, numFaces);
    let faceIdx;
    if (d.sides === 100) {
      faceIdx = Math.floor((value - 1) / 10) % clamped;
    } else {
      faceIdx = (value - 1) % clamped;
    }
    return { ...d, rolling: true, selected: false, display: value, resultFace: faceIdx };
  }, []);

  /** Get current player's character info from the room */
  const getMyCard = useCallback(() => {
    if (!room || !auth) return null;
    return room.members.find((m) => m.ownerUserId === auth.userId) ?? null;
  }, [room, auth]);

  /** Show local popup and broadcast to room */
  const showRollResult = useCallback((updatedDice) => {
    const results = updatedDice
      .filter((d) => typeof d.display === "number")
      .map((d) => ({ sides: d.sides, value: d.display }));
    const total = results.reduce((s, r) => s + r.value, 0);

    const myCard = getMyCard();
    const isRoomOwner = room && auth && room.ownerId === auth.userId;
    const rollData = {
      characterName: myCard?.name ?? auth?.username ?? "Unknown",
      imageUrl: isRoomOwner ? dmTokenImg : (myCard?.imageUrl ?? null),
      results,
      total,
    };

    /* Show popup locally */
    setPopups((prev) => [...prev, { ...rollData, id: uid++ }]);

    /* Broadcast to room if in one */
    if (room) {
      broadcastDiceRoll(rollData);
    }
  }, [getMyCard, auth, room, broadcastDiceRoll]);

  const finishRoll = useCallback((ms, updatedDice) => {
    if (rollTimer.current) clearTimeout(rollTimer.current);
    rollTimer.current = setTimeout(() => {
      setDice((prev) => prev.map((d) => ({ ...d, rolling: false })));
      setRolling(false);
      showRollResult(updatedDice);
    }, ms + 250);
  }, [showRollResult]);

  const handleRoll = () => {
    if (!dice.length || rolling) return;
    setRolling(true);
    const updated = dice.map(computeResult);
    setDice(updated);
    finishRoll(Math.max(...updated.map((d) => CFG[d.sides]?.ms || 1800)), updated);
  };

  const handleReroll = () => {
    if (rolling) return;
    const sel = dice.filter((d) => d.selected);
    if (!sel.length) return;
    setRolling(true);
    const updated = dice.map((d) => (d.selected ? computeResult(d) : d));
    setDice(updated);
    finishRoll(Math.max(...sel.map((d) => CFG[d.sides]?.ms || 1800)), updated);
  };

  const toggleSelect = (id) => {
    if (rolling) return;
    setDice((prev) => prev.map((d) => (d.id === id ? { ...d, selected: !d.selected } : d)));
  };

  const removeDie = useCallback((id) => {
    if (rolling) return;
    setDice((prev) => prev.filter((d) => d.id !== id));
  }, [rolling]);

  const handleClear = () => {
    if (rollTimer.current) clearTimeout(rollTimer.current);
    setDice([]);
    setRolling(false);
  };

  const selCount = dice.filter((d) => d.selected).length;

  return (
    <>
      <div className="dice-tray">
        <button className="dice-toggle-btn" onClick={() => setOpen((o) => !o)} title="Dice Roller">
          🎲
        </button>

        {open && (
          <div className="dice-panel">
            <div className="dice-panel-header">
              <span className="dice-panel-title">Dice Roller</span>
              <span className="dice-count-badge">
                {dice.length} / {MAX_DICE}
              </span>
            </div>

            {dice.length > 0 && (
              <DiceTray3D dice={dice} onToggleSelect={toggleSelect} onRemoveDie={removeDie} />
            )}

            <div className="dice-picker">
              {DICE_TYPES.map((s) => {
                /* Count how many of this type are in the tray for right-click removal */
                const ofType = dice.filter((d) => d.sides === s);
                return (
                  <button
                    key={s}
                    className="die-btn"
                    onClick={() => addDie(s)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (rolling || !ofType.length) return;
                      removeDie(ofType[ofType.length - 1].id);
                    }}
                    disabled={dice.length >= MAX_DICE || rolling}
                    title={`Add ${CFG[s].label}`}
                  >
                    <svg className="die-btn-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                      <DieShape sides={s} />
                    </svg>
                    <span className="die-btn-label">{CFG[s].label}</span>
                  </button>
                );
              })}
            </div>

            <div className="dice-actions">
              <button className="btn-secondary dice-clear" onClick={handleClear}>
                Clear
              </button>
              {selCount > 0 && (
                <button className="dice-reroll" onClick={handleReroll} disabled={rolling}>
                  Reroll {selCount}
                </button>
              )}
              <button className="dice-roll" onClick={handleRoll} disabled={!dice.length || rolling}>
                Roll{dice.length ? ` ${dice.length}` : ""}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Roll result popups — bottom-left */}
      <div className="dice-roll-popup-stack">
        {popups.map((p) => (
          <DiceRollPopup key={p.id} roll={p} onDismiss={() => dismissPopup(p.id)} />
        ))}
      </div>
    </>
  );
}
