# Riemann Sketch

Riemann Sketch is a digital drawing aid for artists studying **5-point perspective** (curvilinear perspective).

Traditional linear perspective works well for narrow fields of view, but fails when trying to capture a wide, immersive scene. 5-point perspective maps the world onto a hemisphere, allowing you to draw wide-angle views up to 180° that feel natural and expansive.

This tool helps you visualize this distortion. You can use it to:
*   **Generate accurate grids** to guide your sketches.
*   **Verify curvilinear lines** and spherical geometry.
*   **Visualize cubes** to study how basic forms distort in 5-point perspective.

## How to Use

The tool runs directly in your browser.
**[Launch Riemann Sketch](https://freiberg-roman.github.io/riemann-sketch/)**

## Features

*   **Interactive Camera**: Rotate, pan and zoom to explore the spherical field of view (up to 180°).
*   **Dynamic Grids**: Toggle and adjust perspective lines to help construct your drawing.
*   **Cube Study**: Place and rotate 3D cubes (with infinite edge guides) to understand form and distortion.
*   **STL Import**: Load any `.stl` model (ASCII or binary) and see it shaded in curvilinear perspective.
*   **Mobile Friendly**: Drag to rotate, pinch or scroll to zoom; the settings panel folds into a bottom sheet on small screens.
*   **Export**: Save your views to verify your work or use as an underlay for digital painting.

---

### For Developers

If you want to run this project locally:

1.  Clone the repo.
2.  Run `npm install`.
3.  Run `npm run dev` to start the local server.

## WASM acceleration

Curve tessellation (grid, cube edges, perspective guides) runs in a Rust/WASM module (`wasm/`) using
adaptive, screen-space subdivision with off-screen culling. The compiled `utils/riemann_core.wasm` is
committed, so no Rust toolchain is required to build the app. To rebuild it after changing `wasm/src/lib.rs`:

```sh
rustup target add wasm32-unknown-unknown
./wasm/build.sh
```
