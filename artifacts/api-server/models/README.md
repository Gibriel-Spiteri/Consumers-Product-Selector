# Models

`u2netp.onnx` (4.6 MB) cuts the product out of a vendor picture before it is saved for the printouts (`src/lib/spCutout.ts`).

- Model: U^2-Net "u2netp" (small) by Xuebin Qin et al., https://github.com/xuebinqin/U-2-Net, Apache License 2.0.
- ONNX file: from the rembg project's releases, https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx (MIT).
- sha256 `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8` (checked when the model loads).
- Input 1 x 3 x 320 x 320, RGB scaled to 0..1 then ImageNet mean / std; output 0 is the saliency map.

Chosen 2026-11-06 over silueta (44 MB, 3x slower, no better) and isnet-general-use (179 MB, 6x slower, worse on a tub in a tiled
bathroom) on real vendor pictures.
