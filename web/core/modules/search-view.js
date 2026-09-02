(function (global) {
  'use strict';
  function open() {
    return global.openSearch();
  }
  global.AtriaSearchView = Object.freeze({ open });
})(window);
