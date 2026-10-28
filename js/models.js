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
  try { const v = localStorage.getItem('nexus.models'); if (v === 'built' || v === 'custom') style = v; } catch (e) { /* storage can be blocked */ }
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
    if (look === 'built' && hasBuilt(kind)) builtMeshes(kind, joints);
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
  return { has, hasBuilt, rig, get style() { return style; }, setStyle };
})();
