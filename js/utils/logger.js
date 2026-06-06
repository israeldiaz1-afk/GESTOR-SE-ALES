'use strict';
const Logger = {
  _p:'[RS]',
  info:(...a)=>console.log(Logger._p,...a),
  warn:(...a)=>console.warn(Logger._p,...a),
  error:(...a)=>console.error(Logger._p,...a),
  debug:(...a)=>{if(location.search.includes('debug'))console.debug(Logger._p,...a);},
};
