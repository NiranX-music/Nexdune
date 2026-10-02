#ifndef NEXDUNE_EDGE_ADAPTERS_H
#define NEXDUNE_EDGE_ADAPTERS_H

/* Explicit registration keeps the ordinary Nexdune CLI initialization and
 * Windows/MSVC builds independent from the distributed Edge runtime. */

#ifdef __cplusplus
extern "C" {
#endif

int nexdune_glm_edge_adapter_register(void);
int nexdune_glm53_edge_adapter_register(void);
int nexdune_inkling_edge_adapter_register(void);
int nexdune_kimi_edge_adapter_register(void);
int nexdune_olmoe_edge_adapter_register(void);
int nexdune_qwen36_edge_adapter_register(void);
int nexdune_qwen38_edge_adapter_register(void);
int nexdune_deepseek_v4_edge_adapter_register(void);

#ifdef __cplusplus
}
#endif

#endif /* NEXDUNE_EDGE_ADAPTERS_H */
