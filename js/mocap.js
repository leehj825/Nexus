// Nexus - plays the motion-capture clips in js/anims.js (DW_ANIMS) on the code-built rigs.
// The clips are Mixamo motion, already retargeted to this rig's convention (feet at y = 0, facing +Z, right hand on -X).
// Each frame of each clip is turned into a quaternion once; sample() slerps between frames.
// Clip bones use Mixamo-style names; BONE_TO_JOINT maps them onto Nexus's joints.
const Mocap = (() => {
  const BONES = ['hips', 'spine', 'head', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'handL', 'handR', 'hipL', 'hipR', 'kneeL', 'kneeR'];
  const BONE_TO_JOINT = { spine: 'torso', head: 'head', shoulderL: 'shL', shoulderR: 'shR', elbowL: 'elL', elbowR: 'elR', handL: 'wrL', handR: 'wrR', hipL: 'hipL', hipR: 'hipR', kneeL: 'kneeL', kneeR: 'kneeR' };
  const clips = {}, e = new THREE.Euler(), q = new THREE.Quaternion();
  for (const [name, c] of Object.entries(DW_ANIMS)) {
    const qs = {};
    for (const b of BONES) {
      if (!c.t[b]) continue;
      const arr = new Float32Array((c.n + 1) * 4);
      c.t[b].forEach((v, i) => { e.set(v[0], v[1], v[2]); q.setFromEuler(e); arr[i * 4] = q.x; arr[i * 4 + 1] = q.y; arr[i * 4 + 2] = q.z; arr[i * 4 + 3] = q.w; });
      qs[b] = arr;
    }
    clips[name] = { d: c.d, n: c.n, loop: !!c.loop, hit: c.hit || 0, q: qs, y: c.t.hipsY, z: c.t.hipsZ };
  }
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  // Writes clip `name` at time t (seconds) into the rig's joints. Returns the clip, or null if there is no such clip.
  // Standing rigs use hipsY (pelvis height, 0.9 m in the clips) and hipsZ (the forward shift), scaled to this rig's legs.
  function sample(rig, name, t) {
    const c = clips[name]; if (!c) return null;
    let u = t / c.d; u = c.loop ? u - Math.floor(u) : Math.min(1, Math.max(0, u));
    const f = u * c.n, i = Math.min(c.n - 1, Math.floor(f)), k = f - i;
    for (const b of BONES) {
      const a = c.q[b]; if (!a) continue;
      const joint = b === 'hips' ? rig.hips : rig.j[BONE_TO_JOINT[b]];
      if (!joint) continue;
      qa.fromArray(a, i * 4); qb.fromArray(a, Math.min(c.n, i + 1) * 4);
      joint.quaternion.copy(qa).slerp(qb, k);
    }
    {
      const y = c.y[i] + (c.y[Math.min(c.n, i + 1)] - c.y[i]) * k, z = c.z[i] + (c.z[Math.min(c.n, i + 1)] - c.z[i]) * k;
      rig.hips.position.y = rig.hipsRest + (y - 0.9) * 0.95;
      rig.hips.position.z = z;
    }
    return c;
  }
  return { clips, sample, has: n => !!clips[n] };
})();
