/**
 * Auto-Seedbox-PT (ASP) MediaInfo 前端扩展
 * 由 Nginx 动态注入：/asp-mediainfo.js
 */
(function() {
  console.log("🎬 [ASP] MediaInfo 已加载");

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    return new Promise((resolve, reject) => {
      document.execCommand("copy") ? resolve() : reject(new Error("copy failed"));
      textArea.remove();
    });
  }

  const script = document.createElement("script");
  script.src = "/sweetalert2.all.min.js";
  document.head.appendChild(script);

  function getCurrentPath() {
    const path = window.location.pathname.replace(/^\/files/, "");
    return decodeURIComponent(path) || "/";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  let lastRightClickedFile = "";

  document.addEventListener("contextmenu", function(e) {
    const row = e.target.closest(".item");
    if (row) {
      const nameEl = row.querySelector(".name");
      if (nameEl) lastRightClickedFile = nameEl.innerText.trim();
    } else {
      lastRightClickedFile = "";
    }
  }, true);

  document.addEventListener("click", function(e) {
    if (!e.target.closest(".asp-mi-btn-class") && !e.target.closest('.item[aria-selected="true"]')) {
      lastRightClickedFile = "";
    }
  }, true);

  const openMediaInfo = (fileName) => {
    const fullPath = (getCurrentPath() + "/" + fileName).replace(/\/\//g, "/");

    if (typeof Swal === "undefined") {
      alert("界面组件加载中，请稍后重试...");
      return;
    }

    Swal.fire({
      title: "解析中...",
      text: "正在读取媒体轨道信息",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading()
    });

    fetch(`/api/mi?file=${encodeURIComponent(fullPath)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);

        let rawText = "";
        let html = `<style>
          .mi-wrap{background:#1e1e1e;color:#d4d4d4;border-radius:8px;padding:14px;text-align:left}
          .mi-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
          .mi-btn{border:0;border-radius:4px;padding:8px 12px;font-size:13px;color:#fff;cursor:pointer}
          .mi-btn:hover{filter:brightness(1.05)}
          .mi-btn-blue{background:#3085d6}
          .mi-btn-green{background:#28a745}
          .mi-status{font-size:12px;color:#bdbdbd}
          .mi-box{text-align:left;font-size:13px;background:#1e1e1e;color:#d4d4d4;padding:6px;max-height:550px;overflow-y:auto;font-family:Consolas,'Courier New',monospace;user-select:text}
          .mi-track{margin-bottom:18px}
          .mi-track-header{font-size:15px;font-weight:bold;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #444}
          .mi-Video .mi-track-header{color:#569cd6;border-bottom-color:#569cd6}
          .mi-Audio .mi-track-header{color:#4ec9b0;border-bottom-color:#4ec9b0}
          .mi-Text .mi-track-header{color:#ce9178;border-bottom-color:#ce9178}
          .mi-General .mi-track-header{color:#dcdcaa;border-bottom-color:#dcdcaa}
          .mi-Menu .mi-track-header{color:#c586c0;border-bottom-color:#c586c0}
          .mi-item{display:flex;padding:3px 0;line-height:1.5;border-bottom:1px dashed #333}
          .mi-key{width:180px;flex-shrink:0;color:#9cdcfe}
          .mi-val{flex-grow:1;color:#cecece;word-break:break-word}
        </style>`;

        html += `<div class="mi-wrap">`;
        html += `<div class="mi-actions">`;
        html += `<button type="button" class="mi-btn mi-btn-blue" id="mi_copy_plain">复制纯文本</button>`;
        html += `<button type="button" class="mi-btn mi-btn-green" id="mi_copy_bbcode">复制 BBCode</button>`;
        html += `<span class="mi-status" id="mi_status">复制操作不会关闭弹窗，点击“关闭”才会退出。</span>`;
        html += `</div>`;
        html += `<div class="mi-box">`;

        if (data.media && data.media.track) {
          data.media.track.forEach((t) => {
            const type = t["@type"] || "Unknown";
            rawText += `${type}\n`;
            html += `<div class="mi-track mi-${type}"><div class="mi-track-header">${escapeHtml(type)}</div>`;

            Object.keys(t).forEach((k) => {
              if (k === "@type") return;
              let val = t[k];
              if (typeof val === "object") val = JSON.stringify(val);
              const valStr = String(val ?? "");
              const paddedKey = String(k).padEnd(32, " ");
              rawText += `${paddedKey}: ${valStr}\n`;
              html += `<div class="mi-item"><div class="mi-key">${escapeHtml(k)}</div><div class="mi-val">${escapeHtml(valStr)}</div></div>`;
            });

            rawText += "\n";
            html += `</div>`;
          });
        } else {
          rawText = JSON.stringify(data, null, 2);
          html += `<pre>${escapeHtml(rawText)}</pre>`;
        }

        html += `</div></div>`;

        Swal.fire({
          title: fileName,
          html,
          width: "850px",
          showCancelButton: true,
          showConfirmButton: false,
          cancelButtonText: "关闭",
          cancelButtonColor: "#555",
          allowOutsideClick: false,
          allowEscapeKey: false,
          didOpen: () => {
            const plainBtn = document.getElementById("mi_copy_plain");
            const bbcodeBtn = document.getElementById("mi_copy_bbcode");
            const status = document.getElementById("mi_status");

            if (plainBtn) {
              plainBtn.addEventListener("click", () => {
                copyText(rawText.trim()).then(() => {
                  if (status) status.textContent = "纯文本已复制到剪贴板。";
                }).catch(() => {
                  if (status) status.textContent = "复制失败，请手动复制下方内容。";
                });
              });
            }

            if (bbcodeBtn) {
              bbcodeBtn.addEventListener("click", () => {
                const bbcode = `[quote]\n${rawText.trim()}\n[/quote]`;
                copyText(bbcode).then(() => {
                  if (status) status.textContent = "BBCode 已复制到剪贴板。";
                }).catch(() => {
                  if (status) status.textContent = "复制失败，请手动复制下方内容。";
                });
              });
            }
          }
        });
      })
      .catch((e) => Swal.fire("解析失败", e.toString(), "error"));
  };

  let observerTimer = null;
  const observer = new MutationObserver(() => {
    if (observerTimer) clearTimeout(observerTimer);

    observerTimer = setTimeout(() => {
      let targetFile = "";
      if (lastRightClickedFile) {
        targetFile = lastRightClickedFile;
      } else {
        const selectedRows = document.querySelectorAll('.item[aria-selected="true"], .item.selected');
        if (selectedRows.length === 1) {
          const nameEl = selectedRows[0].querySelector(".name");
          if (nameEl) targetFile = nameEl.innerText.trim();
        }
      }

      const isMedia = targetFile && targetFile.match(/\.(mp4|mkv|avi|ts|iso|rmvb|wmv|flv|mov|webm|vob|m2ts|bdmv|flac|wav|ape|alac)$/i);
      const menus = new Set();

      document.querySelectorAll('button[aria-label="Info"]').forEach((btn) => {
        if (btn.parentElement) menus.add(btn.parentElement);
      });

      menus.forEach((menu) => {
        const existingBtn = menu.querySelector(".asp-mi-btn-class");
        if (isMedia) {
          if (!existingBtn) {
            const btn = document.createElement("button");
            btn.className = "action asp-mi-btn-class";
            btn.setAttribute("title", "MediaInfo");
            btn.setAttribute("aria-label", "MediaInfo");
            btn.innerHTML = '<i class="material-icons">movie</i><span>MediaInfo</span>';

            btn.onclick = function(ev) {
              ev.preventDefault();
              ev.stopPropagation();
              document.body.click();
              openMediaInfo(targetFile);
            };

            const infoBtn = menu.querySelector('button[aria-label="Info"]');
            if (infoBtn) infoBtn.insertAdjacentElement("afterend", btn);
            else menu.appendChild(btn);
          }
        } else if (existingBtn) {
          existingBtn.remove();
        }
      });
    }, 100);
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();