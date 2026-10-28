// Nexus - the custom crew models (js/models_data.js) bound to the same joint hierarchy the code-built rigs use, so the
// motion-capture clips, the seated poses and the combat code drive them without change.
// The data holds four low-poly characters (quantised vertices, a skin of up to four joints per vertex, a texture and an emissive map for the cyan lights, per character) plus the joint positions fitted to each. Units are metres, feet at y = 0,
// facing +Z, the body centred on x = z = 0. Each character was modelled in an A-pose, so `tilt` records how far each arm is
// swung out; Chars.update undoes it so the clips (which assume arms hanging straight down) play correctly.
const Models = (() => {
  const D = typeof NX_MODELS !== 'undefined' ? NX_MODELS : null;
  const PARENT = { torso: 'hips', head: 'torso', hipL: 'hips', kneeL: 'hipL', ankL: 'kneeL', hipR: 'hips', kneeR: 'hipR', ankR: 'kneeR',
    shL: 'torso', elL: 'shL', wrL: 'elL', shR: 'torso', elR: 'shR', wrR: 'elR' };
  let bytes = null; const geos = {}, mats = {};

  function bin() {
    if (bytes) return bytes;
    const s = atob(D.bin); bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes;
  }
  function texture(src) {
    const img = new Image(), t = new THREE.Texture(img);
    t.encoding = THREE.sRGBEncoding; t.flipY = false; t.anisotropy = 4;
    img.onload = () => { t.needsUpdate = true; };
    img.src = src; return t;
  }
  function material(kind) {
    const m = D.meta[kind];
    if (!mats[kind]) mats[kind] = new THREE.MeshStandardMaterial({ map: texture(m.base), emissiveMap: texture(m.emissive), emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.85, metalness: 0, skinning: true });   // three r128 needs the flag for skinned meshes
    return mats[kind];
  }
  function geometry(kind) {
    if (geos[kind]) return geos[kind];
    const m = D.meta[kind], b = bin(), nv = m.nv, nt = m.nt;
    // The typed views need aligned offsets, so copy each slice out
    let o = m.offset; const slice = len => { const s = b.slice(o, o + len); o += len; return s.buffer; };
    const pq = new Uint16Array(slice(m.lens[0])), uq = new Uint16Array(slice(m.lens[1])), nq = new Int8Array(slice(m.lens[2]));
    const iq = new Uint8Array(slice(m.lens[3])), wq = new Uint8Array(slice(m.lens[4])), tq = new Uint16Array(slice(m.lens[5]));
    const pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), nor = new Float32Array(nv * 3), wt = new Float32Array(nv * 4);
    for (let i = 0; i < nv; i++) {
      for (let k = 0; k < 3; k++) { pos[i * 3 + k] = m.pmin[k] + pq[i * 3 + k] / 65535 * m.prange[k]; nor[i * 3 + k] = nq[i * 3 + k] / 127; }
      uv[i * 2] = uq[i * 2] / 65535; uv[i * 2 + 1] = uq[i * 2 + 1] / 65535;
      for (let k = 0; k < 4; k++) wt[i * 4 + k] = wq[i * 4 + k] / 255;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(iq), 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(wt, 4));
    g.setIndex(new THREE.BufferAttribute(tq, 1));
    return (geos[kind] = g);
  }

  // Which look the characters use: 'custom' (the custom meshes, cut into rigid parts) or 'built' (the same models rebuilt from boxes).
  // The choice is remembered; the game reads it when it starts, Model Check can show either or both.
  let style = 'custom';
  try { const v = localStorage.getItem('nexus.models'); if (v === 'built' || v === 'custom' || v === 'shapes') style = v; } catch (e) { /* storage can be blocked */ }
  const setStyle = v => { style = v; try { localStorage.setItem('nexus.models', v); } catch (e) { /* ignore */ } };
  const hasBuilt = kind => typeof NX_BUILT !== 'undefined' && !!NX_BUILT[kind];
  const has = kind => !!(D && D.meta[kind]);

  // Builds the joint hierarchy and the skinned mesh for one character; returns the rig base { root, hips, torso, head, j, hipsRest, armFix }
  function rig(kind, look = style) {
    const m = D.meta[kind], J = m.joints, joints = {};
    const root = new THREE.Group();
    for (const name of D.bones) {
      const g = new THREE.Group(), p = PARENT[name], w = J[name], pw = p ? J[p] : [0, 0, 0];
      g.position.set(w[0] - pw[0], w[1] - pw[1], w[2] - pw[2]); g.name = name;
      (p ? joints[p] : root).add(g); joints[name] = g;
    }
    if (look === 'shapes' && hasShapes(kind)) shapeMeshes(kind, joints);
    else if (look === 'built' && hasBuilt(kind)) builtMeshes(kind, joints);
    else {
      const mesh = new THREE.SkinnedMesh(geometry(kind), material(kind));
      mesh.frustumCulled = false;
      root.add(mesh); root.updateMatrixWorld(true);
      mesh.bind(new THREE.Skeleton(D.bones.map(n => joints[n])));
    }
    const c = { root, hips: joints.hips, torso: joints.torso, head: joints.head, j: {}, hipsRest: J.hips[1], armFix: m.tilt, headTop: [0, m.headTop - J.head[1], 0] };
    for (const n of D.bones) if (n !== 'hips') c.j[n] = joints[n];
    return c;
  }
  // The built look: for each bone, its boxes merged into one flat-shaded mesh (vertex colours), plus a second mesh for the glowing ones
  const mixM = new THREE.Matrix4(), qq = new THREE.Quaternion(), vp = new THREE.Vector3(), vs = new THREE.Vector3();
  let builtMat = null, glowMat = null;
  const lin = v => Math.pow(v / 255, 2.2);                               // the texture's sRGB to the linear colour the lighting works in
  function builtMeshes(kind, joints) {
    builtMat = builtMat || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05, flatShading: true });
    glowMat = glowMat || new THREE.MeshStandardMaterial({ color: 0x0a1418, emissive: 0x3ff0ff, emissiveIntensity: 1.3, roughness: 0.4, flatShading: true });   // vertex colours do not tint the emissive, so the glow is one cyan
    const unit = new THREE.BoxGeometry(1, 1, 1);
    const up = unit.attributes.position.array, un = unit.attributes.normal.array, ui = unit.index.array, nvU = up.length / 3;
    for (const bone in NX_BUILT[kind]) {
      const joint = joints[bone] || null; if (!joint) continue;
      for (const glow of [false, true]) {
        const list = NX_BUILT[kind][bone].filter(b => (b[11] > 160 && b[12] > 170 && b[10] < 140) === glow);
        if (!list.length) continue;
        const pos = new Float32Array(list.length * nvU * 3), nor = new Float32Array(list.length * nvU * 3), col = new Float32Array(list.length * nvU * 3);
        const idx = new Uint32Array(list.length * ui.length); const nm = new THREE.Matrix3();
        list.forEach((b, n) => {
          qq.set(b[6], b[7], b[8], b[9]); vp.set(b[0], b[1], b[2]); vs.set(b[3], b[4], b[5]); mixM.compose(vp, qq, vs);
          nm.getNormalMatrix(mixM);
          for (let v = 0; v < nvU; v++) {
            vp.set(up[v * 3], up[v * 3 + 1], up[v * 3 + 2]).applyMatrix4(mixM);
            const o = (n * nvU + v) * 3; pos[o] = vp.x; pos[o + 1] = vp.y; pos[o + 2] = vp.z;
            vp.set(un[v * 3], un[v * 3 + 1], un[v * 3 + 2]).applyMatrix3(nm).normalize(); nor[o] = vp.x; nor[o + 1] = vp.y; nor[o + 2] = vp.z;
            col[o] = lin(b[10]); col[o + 1] = lin(b[11]); col[o + 2] = lin(b[12]);
          }
          for (let k = 0; k < ui.length; k++) idx[n * ui.length + k] = ui[k] + n * nvU;
        });
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        g.setIndex(new THREE.BufferAttribute(idx, 1));
        const mesh = new THREE.Mesh(g, glow ? glowMat : builtMat); mesh.frustumCulled = false; joint.add(mesh);
      }
    }
  }
  // The shapes look: for each bone, large primitives (0 box, 1 cylinder, 2 triangular prism; a plane is a thin box), each with one flat colour,
  // merged into one mesh per joint. NX_PRIMS[kind][bone] = [[type, cx, cy, cz, sx, sy, sz, qx, qy, qz, qw, r, g, b], ...]
  let shapeMat = null, shapeGlow = null, protoGeo = null;
  function protos() {
    if (protoGeo) return protoGeo;
    const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 14).rotateX(Math.PI / 2);   // axis along z
    // right triangle in x,y (right angle at -0.5,-0.5) extruded along z
    const tri = new THREE.BufferGeometry(), a = [-0.5, -0.5], b = [0.5, -0.5], c = [-0.5, 0.5], z = 0.5, v = [];
    const quad = (p, q, r, s2) => v.push(...p, ...q, ...r, ...p, ...r, ...s2);
    v.push(a[0], a[1], z, b[0], b[1], z, c[0], c[1], z, a[0], a[1], -z, c[0], c[1], -z, b[0], b[1], -z);
    quad([a[0], a[1], -z], [b[0], b[1], -z], [b[0], b[1], z], [a[0], a[1], z]);
    quad([b[0], b[1], -z], [c[0], c[1], -z], [c[0], c[1], z], [b[0], b[1], z]);
    quad([c[0], c[1], -z], [a[0], a[1], -z], [a[0], a[1], z], [c[0], c[1], z]);
    tri.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    const ng = g => g.index ? g.toNonIndexed() : g;
    protoGeo = [ng(box), ng(cyl), tri];
    return protoGeo;
  }
  const sm = new THREE.Matrix4(), sq = new THREE.Quaternion(), sp = new THREE.Vector3(), ss = new THREE.Vector3(), sn = new THREE.Matrix3(), cA = new THREE.Vector3(), cB = new THREE.Vector3(), cC = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  function shapeMeshes(kind, joints) {
    shapeMat = shapeMat || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05, flatShading: true });
    shapeGlow = shapeGlow || new THREE.MeshStandardMaterial({ color: 0x0a1418, emissive: 0x3ff0ff, emissiveIntensity: 1.3, roughness: 0.4, flatShading: true });
    const P = protos();
    for (const bone in NX_PRIMS[kind]) {
      const joint = joints[bone]; if (!joint) continue;
      for (const glow of [false, true]) {
        const list = NX_PRIMS[kind][bone].filter(b => (b[12] > 190 && b[13] > 200 && b[11] < 110 && bone !== 'head') === glow);
        if (!list.length) continue;
        let nv = 0; for (const b of list) nv += P[b[0]].attributes.position.count;
        const pos = new Float32Array(nv * 3), col = new Float32Array(nv * 3); let o = 0;
        for (const b of list) {
          sq.set(b[7], b[8], b[9], b[10]); sp.set(b[1], b[2], b[3]); ss.set(b[4], b[5], b[6]); sm.compose(sp, sq, ss);
          const src = P[b[0]].attributes.position.array, cr = lin(b[11]), cg = lin(b[12]), cb = lin(b[13]);
          for (let i = 0; i < src.length; i += 3) {
            sp.set(src[i], src[i + 1], src[i + 2]).applyMatrix4(sm);
            pos[o] = sp.x; pos[o + 1] = sp.y; pos[o + 2] = sp.z; col[o] = cr; col[o + 1] = cg; col[o + 2] = cb; o += 3;
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
        const mesh = new THREE.Mesh(g, glow ? shapeGlow : shapeMat); mesh.frustumCulled = false; joint.add(mesh);
      }
    }
  }
  const hasShapes = kind => typeof NX_PRIMS !== 'undefined' && !!NX_PRIMS[kind];
  return { has, hasBuilt, hasShapes, rig, get style() { return style; }, setStyle };
})();
