(function (global) {
  'use strict';
  function render() {
    return global.renderNormas();
  }
  global.AtriaRulesView = Object.freeze({ render });
})(window);
