#ifndef NEXDUNE_SEGMENT_CONFORMANCE_FIXTURES_H
#define NEXDUNE_SEGMENT_CONFORMANCE_FIXTURES_H

#include "../segment_runtime.h"

#include <stddef.h>
#include <stdint.h>

/*
 * Dependency-free contract fixtures for every Nexdune model family.
 *
 * These are deliberately not model adapters and do not execute model math.
 * They model the distinct remote-state topologies so the common Segment ABI
 * cannot accidentally collapse to the conventional-KV OLMoE case. A real
 * adapter must later pass the same lifecycle checks with its generated tiny
 * checkpoint and its own numerical oracle.
 */
typedef enum {
    NEXDUNE_SEGMENT_FIXTURE_KV             = UINT32_C(1) << 0,
    NEXDUNE_SEGMENT_FIXTURE_SLIDING_RING   = UINT32_C(1) << 1,
    NEXDUNE_SEGMENT_FIXTURE_MLA_LATENT     = UINT32_C(1) << 2,
    NEXDUNE_SEGMENT_FIXTURE_DSA_INDEXER    = UINT32_C(1) << 3,
    NEXDUNE_SEGMENT_FIXTURE_CONVOLUTION    = UINT32_C(1) << 4,
    NEXDUNE_SEGMENT_FIXTURE_RECURRENT      = UINT32_C(1) << 5,
    NEXDUNE_SEGMENT_FIXTURE_ATTN_RESIDUAL  = UINT32_C(1) << 6,
    NEXDUNE_SEGMENT_FIXTURE_MHC            = UINT32_C(1) << 7,
    NEXDUNE_SEGMENT_FIXTURE_COMPRESSOR     = UINT32_C(1) << 8,
    NEXDUNE_SEGMENT_FIXTURE_DEVICE_CACHE   = UINT32_C(1) << 9,
    NEXDUNE_SEGMENT_FIXTURE_HYPER_RESIDUAL = UINT32_C(1) << 10,
    NEXDUNE_SEGMENT_FIXTURE_SPARSE_ATTN    = UINT32_C(1) << 11,
    NEXDUNE_SEGMENT_FIXTURE_PLE            = UINT32_C(1) << 12,
    /* DeepSeek V4.1: the n-gram memory read from disk, and the ViT tower */
    NEXDUNE_SEGMENT_FIXTURE_ENGRAM         = UINT32_C(1) << 13,
    NEXDUNE_SEGMENT_FIXTURE_VISION_TOWER   = UINT32_C(1) << 14,
} NexduneSegmentFixtureState;

typedef struct {
    const char *family_id;
    const char *display_name;
    const char *state_schema;
    const char *state_description;
    const char *tiny_generator;
    uint32_t state_kinds;
    uint32_t state_lanes;
    uint32_t state_width;
    uint32_t num_layers;
    uint32_t max_context_tokens;
    uint32_t fixture_tag;
} NexduneSegmentConformanceFixture;

size_t nexdune_segment_conformance_fixture_count(void);
const NexduneSegmentConformanceFixture *
nexdune_segment_conformance_fixture_at(size_t index);

/* Explicit registration mirrors the consumer lifecycle required by the
 * production ABI and remains portable to MSVC. */
int nexdune_segment_conformance_register_fixtures(void);

/* Run lifecycle, isolation, ordering, range, snapshot and restore checks for
 * one registered fixture. Returns zero on success and writes a diagnostic on
 * failure. */
int nexdune_segment_conformance_run_fixture(
    const NexduneSegmentConformanceFixture *fixture,
    char *error, size_t error_size);

#endif /* NEXDUNE_SEGMENT_CONFORMANCE_FIXTURES_H */
