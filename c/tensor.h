#ifndef NEXDUNE_TENSOR_H
#define NEXDUNE_TENSOR_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Storage/execution formats understood by a model backend.  A view describes
 * bytes owned by a model or ExpertStore; it never owns or frees those bytes. */
typedef enum {
    NEXDUNE_TENSOR_F32 = 0,
    NEXDUNE_TENSOR_Q8_ROW,
    NEXDUNE_TENSOR_Q4_ROW,
    NEXDUNE_TENSOR_Q2_ROW,
    NEXDUNE_TENSOR_FP8_E4M3_BLOCK,
    NEXDUNE_TENSOR_FP4_NATIVE_BLOCK,
    NEXDUNE_TENSOR_INT8_BLOCK,
    NEXDUNE_TENSOR_INT4_BLOCK
} NexduneTensorFormat;

typedef enum {
    NEXDUNE_SCALE_NONE = 0,
    NEXDUNE_SCALE_F32,
    NEXDUNE_SCALE_UE8M0
} NexduneScaleFormat;

typedef struct {
    NexduneTensorFormat format;
    NexduneScaleFormat scale_format;
    const void *data;
    const void *scales;
    size_t data_bytes;
    size_t scale_bytes;
    int64_t rows;
    int64_t columns;
    uint32_t block_rows;
    uint32_t block_columns;
    /* Optional backend-resident mirror of this weight (e.g. a Dsv4CudaTensor*).
     * NULL on the CPU-only paths; owned and freed by the backend tier, never by
     * the view. */
    void *gpu;
} NexduneTensorView;

#ifdef __cplusplus
}
#endif

#endif
