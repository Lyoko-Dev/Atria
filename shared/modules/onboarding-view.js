(function (global) {
  'use strict';
  function show(options) {
    return global.showOnboarding(options);
  }
  global.AtriaOnboardingView = Object.freeze({ show });
})(window);
