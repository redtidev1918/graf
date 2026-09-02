// Graf editor autogrow
document.addEventListener("DOMContentLoaded", function () {
  var ta = document.querySelector(".editor textarea[name=content]");
  if (!ta) return;
  function grow() {
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  }
  ta.addEventListener("input", grow);
  grow();
});
