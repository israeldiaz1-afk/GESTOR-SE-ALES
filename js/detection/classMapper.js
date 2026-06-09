'use strict';
/* ═══════════════════════════════════════════════════════════
   CLASSMAPPER.JS — Traduce clases del modelo → catálogo DGT
   Adaptado al modelo "Traffic Signs Detection Europe" (55 clases).
   Cada clase del modelo entrenado se mapea a un signType del
   SIGN_CATALOG y su categoría correspondiente.
   ═══════════════════════════════════════════════════════════ */
const ClassMapper = (() => {

  // Mapa por NOMBRE de clase (el modelo europeo usa nombres, no índices GTSRB)
  // category: velocidad|prohibicion|prioridad|peligro|obligacion|informacion|horizontal|desconocido
  const NAME_TO_DGT = {
    // ── Prohibición (forb_*) ──
    'forb_ahead':            { signType:'R101', category:'prohibicion' },
    'forb_left':             { signType:'R101', category:'prohibicion' },
    'forb_right':            { signType:'R101', category:'prohibicion' },
    'forb_overtake':         { signType:'R103', category:'prohibicion' },
    'forb_stopping':         { signType:'R100', category:'prohibicion' },
    'forb_trucks':           { signType:'R101', category:'prohibicion' },
    'forb_u_turn':           { signType:'R101', category:'prohibicion' },
    'forb_weight_over_3.5t': { signType:'R101', category:'prohibicion' },
    'forb_weight_over_7.5t': { signType:'R101', category:'prohibicion' },
    'forb_speed_over_5':     { signType:'R200', category:'velocidad' },
    'forb_speed_over_10':    { signType:'R200', category:'velocidad' },
    'forb_speed_over_20':    { signType:'R201', category:'velocidad' },
    'forb_speed_over_30':    { signType:'R201', category:'velocidad' },
    'forb_speed_over_40':    { signType:'R202', category:'velocidad' },
    'forb_speed_over_50':    { signType:'R203', category:'velocidad' },
    'forb_speed_over_60':    { signType:'R204', category:'velocidad' },
    'forb_speed_over_70':    { signType:'R205', category:'velocidad' },
    'forb_speed_over_80':    { signType:'R206', category:'velocidad' },
    'forb_speed_over_90':    { signType:'R206', category:'velocidad' },
    'forb_speed_over_100':   { signType:'R206', category:'velocidad' },
    'forb_speed_over_130':   { signType:'R206', category:'velocidad' },

    // ── Información (info_*) ──
    'info_bus_station':      { signType:'S10', category:'informacion' },
    'info_crosswalk':        { signType:'S13', category:'informacion' },
    'info_highway':          { signType:'S10', category:'informacion' },
    'info_one_way_traffic':  { signType:'S10', category:'informacion' },
    'info_parking':          { signType:'S11', category:'informacion' },
    'info_taxi_parking':     { signType:'S11', category:'informacion' },

    // ── Obligación (mand_*) ──
    'mand_bike_lane':        { signType:'M501', category:'obligacion' },
    'mand_left':             { signType:'M501', category:'obligacion' },
    'mand_left_right':       { signType:'M501', category:'obligacion' },
    'mand_pass_left':        { signType:'M501', category:'obligacion' },
    'mand_pass_left_right':  { signType:'M501', category:'obligacion' },
    'mand_pass_right':       { signType:'M501', category:'obligacion' },
    'mand_right':            { signType:'M501', category:'obligacion' },
    'mand_roundabout':       { signType:'M501', category:'obligacion' },
    'mand_straigh_left':     { signType:'M501', category:'obligacion' },
    'mand_straight':         { signType:'M501', category:'obligacion' },
    'mand_straight_right':   { signType:'M501', category:'obligacion' },

    // ── Prioridad (prio_*) ──
    'prio_give_way':         { signType:'R1',  category:'prioridad' },
    'prio_priority_road':    { signType:'R100', category:'prioridad' },
    'prio_stop':             { signType:'R2',  category:'prioridad' },

    // ── Peligro (warn_*) ──
    'warn_children':         { signType:'P13', category:'peligro' },
    'warn_construction':     { signType:'P18', category:'peligro' },
    'warn_crosswalk':        { signType:'P13', category:'peligro' },
    'warn_cyclists':         { signType:'P18', category:'peligro' },
    'warn_domestic_animals': { signType:'P18', category:'peligro' },
    'warn_other_dangers':    { signType:'P18', category:'peligro' },
    'warn_poor_road_surface':{ signType:'P27', category:'peligro' },
    'warn_roundabout':       { signType:'P18', category:'peligro' },
    'warn_slippery_road':    { signType:'P27', category:'peligro' },
    'warn_speed_bumper':     { signType:'P25', category:'peligro' },
    'warn_traffic_light':    { signType:'P2',  category:'peligro' },
    'warn_tram':             { signType:'P18', category:'peligro' },
    'warn_two_way_traffic':  { signType:'P18', category:'peligro' },
    'warn_wild_animals':     { signType:'P18', category:'peligro' },
  };

  const CATEGORY_COLOR = {
    velocidad:'red', prohibicion:'red', prioridad:'red',
    peligro:'yellow', obligacion:'blue', informacion:'blue',
    horizontal:'white', desconocido:'gray',
  };

  function map(detection) {
    const label = detection.label || '';
    let mapped = NAME_TO_DGT[label];

    // Respaldo por heurística si el nombre no está en la tabla
    if (!mapped) mapped = _inferFromLabel(label);
    if (!mapped) mapped = { signType:'UNKNOWN', category:'desconocido' };

    const color = CATEGORY_COLOR[mapped.category] || 'gray';
    return { ...detection, signType: mapped.signType, category: mapped.category, color, dominantColor: color };
  }

  function _inferFromLabel(label) {
    const l = label.toLowerCase();
    if (l.startsWith('forb') && l.includes('speed')) return { signType:'R203', category:'velocidad' };
    if (l.startsWith('forb')) return { signType:'R100', category:'prohibicion' };
    if (l.startsWith('warn')) return { signType:'P18', category:'peligro' };
    if (l.startsWith('mand')) return { signType:'M501', category:'obligacion' };
    if (l.startsWith('info')) return { signType:'S10', category:'informacion' };
    if (l.startsWith('prio') && l.includes('stop')) return { signType:'R2', category:'prioridad' };
    if (l.startsWith('prio') && l.includes('give')) return { signType:'R1', category:'prioridad' };
    if (l.startsWith('prio')) return { signType:'R100', category:'prioridad' };
    return null;
  }

  return { map };
})();
