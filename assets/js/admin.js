// confirm-before-submit for admin forms
document.addEventListener("DOMContentLoaded", function () {
  var forms = document.querySelectorAll("form[data-confirm]");
  forms.forEach(function (f) {
    f.addEventListener("submit", function (ev) {
      var msg = f.getAttribute("data-confirm") || "Are you sure?";
      if (!window.confirm(msg)) ev.preventDefault();
    });
  });
});
