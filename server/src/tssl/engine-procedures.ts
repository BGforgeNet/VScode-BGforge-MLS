/**
 * Standard Fallout script procedures called by the engine.
 * Shared between the TSSL transpiler (tree-shaking preservation)
 * and the TypeScript plugin (TS6133 diagnostic suppression).
 *
 * Documentation for these procedures lives in server/data/fallout-ssl-base.yml
 * and is served to the TS plugin via the generated hover.fallout-ssl.json.
 */

export const ENGINE_PROCEDURES: ReadonlySet<string> = new Set([
    'barter_init_p_proc',
    'barter_p_proc',
    'combat_is_over_p_proc',
    'combat_is_starting_p_proc',
    'combat_p_proc',
    'create_p_proc',
    'critter_p_proc',
    'damage_p_proc',
    'description_p_proc',
    'destroy_p_proc',
    'drop_p_proc',
    'is_dropping_p_proc',
    'look_at_p_proc',
    'map_enter_p_proc',
    'map_exit_p_proc',
    'map_update_p_proc',
    'pickup_p_proc',
    'push_p_proc',
    'spatial_p_proc',
    'start',
    'talk_p_proc',
    'timed_event_p_proc',
    'use_ad_on_p_proc',
    'use_disad_on_p_proc',
    'use_obj_on_p_proc',
    'use_p_proc',
    'use_skill_on_p_proc',
]);
