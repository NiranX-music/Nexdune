#ifndef NEXDUNE_SEGMENT_ADAPTERS_H
#define NEXDUNE_SEGMENT_ADAPTERS_H

/*
 * Explicit registration entry points for Nexdune's built-in model adapters.
 *
 * Each engine owns its implementation and is normally linked as a separate
 * executable/object.  A Segment consumer links the engines it wants and calls
 * the matching functions before the first adapter lookup.  The ordinary
 * Nexdune CLI/server paths do not call these functions, so adding an adapter
 * cannot change standalone inference or initialization order.
 */

#ifdef __cplusplus
extern "C" {
#endif

int nexdune_glm_segment_adapter_register(void);
int nexdune_glm53_segment_adapter_register(void);
int nexdune_inkling_segment_adapter_register(void);
int nexdune_kimi_segment_adapter_register(void);
int nexdune_olmoe_segment_adapter_register(void);
int nexdune_qwen36_segment_adapter_register(void);
int nexdune_qwen38_segment_adapter_register(void);
int nexdune_deepseek_v4_segment_adapter_register(void);

#ifdef __cplusplus
}
#endif

#endif /* NEXDUNE_SEGMENT_ADAPTERS_H */
