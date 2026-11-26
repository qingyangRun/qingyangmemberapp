/* 主题色：管理 → 外观 → 主题颜色 里选择，存本地并应用到所有页面 */
(function () {
  var KEY = 'qy-member-theme';
  var names = { blue: '经典蓝', green: '清样绿', violet: '雅紫', orange: '琥珀橙', rose: '玫瑰红', graphite: '石墨黑' };
  function read() {
    try {
      var saved = localStorage.getItem(KEY);
      if (saved) return saved;
    } catch (e) {}
    var hinted = document.documentElement.getAttribute('data-theme');
    return hinted || 'blue';
  }
  function apply(theme) {
    var root = document.documentElement;
    if (!theme || theme === 'blue') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }
  function paintActive(theme) {
    var list = document.querySelectorAll('[data-theme-option]');
    for (var i = 0; i < list.length; i++) {
      var on = list[i].getAttribute('data-theme-option') === theme;
      list[i].classList.toggle('on', on);
      list[i].setAttribute('aria-checked', on ? 'true' : 'false');
    }
    var label = document.querySelector('[data-theme-name]');
    if (label) label.textContent = names[theme] || names.blue;
  }
  window.qhTheme = {
    get: read,
    set: function (theme) {
      try { localStorage.setItem(KEY, theme); } catch (e) {}
      apply(theme);
      paintActive(theme);
    },
    names: names
  };
  apply(read());
  document.addEventListener('DOMContentLoaded', function () {
    paintActive(read());
    var opts = document.querySelectorAll('[data-theme-option]');
    for (var i = 0; i < opts.length; i++) {
      opts[i].addEventListener('click', function () {
        window.qhTheme.set(this.getAttribute('data-theme-option'));
      });
    }
    var reset = document.querySelector('[data-theme-reset]');
    if (reset) reset.addEventListener('click', function () { window.qhTheme.set('blue'); });
  });
})();
