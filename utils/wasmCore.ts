// Thin wrapper around the Rust/WASM adaptive stereographic tessellator (see /wasm).
// @ts-ignore - Vite's ?init returns a function that instantiates the module
import initWasm from './riemann_core.wasm?init';

export interface WasmCore {
  memory: WebAssembly.Memory;
  set_view: (...args: number[]) => void;
  reset: () => void;
  out_ptr: () => number;
  out_len: () => number;
  curve: (kind: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number,
    t0: number, t1: number, base: number, minDt: number) => void;
}

let core: WasmCore | null = null;
export const wasmReady: Promise<WasmCore> = (initWasm({}) as Promise<WebAssembly.Instance>).then(inst => {
  core = inst.exports as unknown as WasmCore;
  return core;
});
export const getWasm = () => core;

/** Returns a view over the tessellated output (x,y pairs; NaN pair = pen-up). Valid until next wasm call. */
export function readOut(c: WasmCore): Float64Array {
  return new Float64Array(c.memory.buffer, c.out_ptr(), c.out_len());
}
