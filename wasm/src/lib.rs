//! Adaptive stereographic curve tessellator.
//! Curves are emitted as (x, y) f64 pairs into OUT; (NaN, NaN) marks a pen-up.
#![allow(static_mut_refs)]

#[derive(Clone, Copy)]
struct P { x: f64, y: f64, vis: bool }

struct View {
    m: [f64; 9], s: f64, cx: f64, cy: f64, jump: f64, tol: f64,
    vx0: f64, vy0: f64, vx1: f64, vy1: f64,
    kind: u32, a: [f64; 3], b: [f64; 3], min_dt: f64,
}

static mut V: View = View {
    m: [1., 0., 0., 0., 1., 0., 0., 0., 1.], s: 1., cx: 0., cy: 0., jump: 1e9, tol: 0.25,
    vx0: 0., vy0: 0., vx1: 0., vy1: 0., kind: 0, a: [0.; 3], b: [0.; 3], min_dt: 1e-6,
};
static mut OUT: Vec<f64> = Vec::new();

#[no_mangle]
pub extern "C" fn set_view(m0: f64, m1: f64, m2: f64, m3: f64, m4: f64, m5: f64, m6: f64, m7: f64, m8: f64,
    s: f64, cx: f64, cy: f64, jump: f64, tol: f64, vx0: f64, vy0: f64, vx1: f64, vy1: f64) {
    unsafe {
        V.m = [m0, m1, m2, m3, m4, m5, m6, m7, m8];
        V.s = s; V.cx = cx; V.cy = cy; V.jump = jump; V.tol = tol;
        V.vx0 = vx0; V.vy0 = vy0; V.vx1 = vx1; V.vy1 = vy1;
    }
}

#[no_mangle] pub extern "C" fn reset() { unsafe { OUT.clear(); } }
#[no_mangle] pub extern "C" fn out_ptr() -> *const f64 { unsafe { OUT.as_ptr() } }
#[no_mangle] pub extern "C" fn out_len() -> usize { unsafe { OUT.len() } }

#[inline(always)]
fn eval(v: &View, t: f64) -> [f64; 3] {
    let (a, b) = (&v.a, &v.b);
    if v.kind == 0 {
        let (s, c) = t.sin_cos();
        [a[0] * c + b[0] * s, a[1] * c + b[1] * s, a[2] * c + b[2] * s]
    } else {
        [a[0] + b[0] * t, a[1] + b[1] * t, a[2] + b[2] * t]
    }
}

#[inline(always)]
fn proj(v: &View, p: [f64; 3]) -> P {
    let m = &v.m;
    let x = m[0] * p[0] + m[1] * p[1] + m[2] * p[2];
    let y = m[3] * p[0] + m[4] * p[1] + m[5] * p[2];
    let z = m[6] * p[0] + m[7] * p[1] + m[8] * p[2];
    let r = (x * x + y * y + z * z).sqrt();
    if r < 1e-5 { return P { x: v.cx, y: v.cy, vis: true }; }
    let ny = y / r;
    if ny < -0.999 { return P { x: 0., y: 0., vis: false }; }
    let d = r * (1.0 + ny);
    P { x: v.cx + x / d * v.s, y: v.cy - z / d * v.s, vis: true }
}

#[inline(always)]
fn brk(out: &mut Vec<f64>) {
    let n = out.len();
    if n >= 2 && !out[n - 1].is_nan() { out.push(f64::NAN); out.push(f64::NAN); }
}
#[inline(always)]
fn emit(out: &mut Vec<f64>, p: P) { out.push(p.x); out.push(p.y); }

fn refine(v: &View, out: &mut Vec<f64>, ta: f64, pa: P, tb: f64, pb: P, depth: u32) {
    let tm = 0.5 * (ta + tb);
    let pm = proj(v, eval(v, tm));
    let can_split = (tb - ta).abs() > v.min_dt && depth < 48;
    if pa.vis && pb.vis && pm.vis {
        let dx = pm.x - 0.5 * (pa.x + pb.x);
        let dy = pm.y - 0.5 * (pa.y + pb.y);
        let dev = (dx * dx + dy * dy).sqrt();
        let minx = pa.x.min(pb.x).min(pm.x) - dev;
        let maxx = pa.x.max(pb.x).max(pm.x) + dev;
        let miny = pa.y.min(pb.y).min(pm.y) - dev;
        let maxy = pa.y.max(pb.y).max(pm.y) + dev;
        if maxx < v.vx0 || minx > v.vx1 || maxy < v.vy0 || miny > v.vy1 {
            brk(out); emit(out, pb); return; // fully off-screen: cull
        }
        let sx = pb.x - pa.x; let sy = pb.y - pa.y;
        let seg = (sx * sx + sy * sy).sqrt();
        if dev <= v.tol && seg <= v.jump { emit(out, pb); return; }
        if !can_split {
            if seg > v.jump { brk(out); }
            emit(out, pb); return;
        }
    } else if !can_split {
        brk(out);
        if pb.vis { emit(out, pb); }
        return;
    }
    refine(v, out, ta, pa, tm, pm, depth + 1);
    refine(v, out, tm, pm, tb, pb, depth + 1);
}

/// kind 0: p(t) = A cos t + B sin t ; kind 1: p(t) = A + B t
#[no_mangle]
pub extern "C" fn curve(kind: u32, ax: f64, ay: f64, az: f64, bx: f64, by: f64, bz: f64,
    t0: f64, t1: f64, base: u32, min_dt: f64) {
    unsafe {
        V.kind = kind; V.a = [ax, ay, az]; V.b = [bx, by, bz]; V.min_dt = min_dt.max(1e-9);
        let v = &V; let out = &mut OUT;
        brk(out);
        let n = base.max(1);
        let mut ta = t0;
        let mut pa = proj(v, eval(v, t0));
        if pa.vis { emit(out, pa); }
        for i in 1..=n {
            let tb = t0 + (t1 - t0) * (i as f64) / (n as f64);
            let pb = proj(v, eval(v, tb));
            refine(v, out, ta, pa, tb, pb, 0);
            ta = tb; pa = pb;
        }
    }
}
