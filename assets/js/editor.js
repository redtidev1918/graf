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

// --- Graf 作者工具：自动保存草稿 + 字数统计（仅新文章页，编辑已有文章不覆盖） ---
(function () {
  var form = document.querySelector("form.editor");
  var ta = form ? form.querySelector("textarea[name=content]") : null;
  if (!form || !ta) return;
  var isNew = (form.getAttribute("action") || "").indexOf("edit") === -1;
  var KEY = "graf-draft-v1";
  var timer = null;

  function words() {
    var v = ta.value.trim();
    return v ? v.length : 0; // 中文按字符计数
  }
  function updateCount() {
    var el = document.querySelector("[data-graf-count]");
    if (el) el.textContent = "字数 " + words();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), text: ta.value, title: (form.querySelector("input[name=title]") || {}).value || "" })); } catch (e) {}
  }
  function clearDraft() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    var hint = document.querySelector("[data-graf-draft]");
    if (hint) hint.remove();
  }

  if (isNew) {
    ta.addEventListener("input", function () {
      updateCount();
      clearTimeout(timer);
      timer = setTimeout(save, 600);
    });
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
    if (saved && saved.text && saved.text !== ta.value) {
      var bar = document.createElement("p");
      bar.className = "row wrap dl-note";
      bar.setAttribute("data-graf-draft", "1");
      var restored = false;
      var fill = document.createElement("button");
      fill.type = "button";
      fill.className = "btn btn-sm";
      fill.textContent = "恢复上次草稿（" + words() + " 字）";
      fill.onclick = function () {
        if (restored) return;
        if (ta.value && !window.confirm("当前内容将被草稿覆盖，确定恢复？")) return;
        ta.value = saved.text || "";
        var t = form.querySelector("input[name=title]");
        if (t && saved.title) t.value = saved.title;
        ta.dispatchEvent(new Event("input"));
        restored = true;
        fill.textContent = "已恢复";
      };
      var rm = document.createElement("button");
      rm.type = "button";
      rm.className = "btn btn-sm ghost";
      rm.textContent = "丢弃草稿";
      rm.onclick = function () { clearDraft(); };
      bar.appendChild(fill);
      bar.appendChild(rm);
      form.parentNode.insertBefore(bar, form);
    }
  } else {
    var el = document.createElement("span");
    el.className = "meta";
    el.setAttribute("data-graf-count", "1");
    form.parentNode.insertBefore(el, form);
  }
  updateCount();
})();

