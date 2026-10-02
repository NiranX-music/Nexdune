#ifndef NEXDUNE_NATIVE_QUANT_BATCH_H
#define NEXDUNE_NATIVE_QUANT_BATCH_H

#include "tensor.h"

/* inputs and outputs are batch-major. Every batch element preserves the exact
 * scalar column accumulation order of the single-token reference kernels. */
int nexdune_fp8_matmul_batch_ref(float *outputs, const NexduneTensorView *weight,
                              const float *inputs, int batch);
int nexdune_fp4_matmul_batch_ref(float *outputs, const NexduneTensorView *weight,
                              const float *inputs, int batch);

/* Hoisted-qdq variant: `activations` were qdq'd once by the caller (batch-
 * major, same layout the _ref computes internally); `inputs` stays raw for
 * the GPU path, exactly as in _ref. Bit-identical to _ref. */
int nexdune_fp8_matmul_batch_pre(float *outputs, const NexduneTensorView *weight,
                              const float *inputs, const float *activations,
                              int batch);

#endif
