#ifndef NEXDUNE_NATIVE_QUANT_DUAL_H
#define NEXDUNE_NATIVE_QUANT_DUAL_H

#include "tensor.h"

int nexdune_fp4_dual_matvec_ref(float *output_a, float *output_b,
                             const NexduneTensorView *weight_a,
                             const NexduneTensorView *weight_b,
                             const float *input);
int nexdune_fp8_dual_matvec_ref(float *output_a, float *output_b,
                             const NexduneTensorView *weight_a,
                             const NexduneTensorView *weight_b,
                             const float *input);

#endif
