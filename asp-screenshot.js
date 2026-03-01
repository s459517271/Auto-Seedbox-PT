/**
 * Auto-Seedbox-PT (ASP) Screenshot 前端扩展
 * 由 Nginx 动态注入：/asp-screenshot.js
 */
(function() {
  console.log("📸 [ASP] Screenshot v1.3 已加载！");

  const SS_API = "/api/ss";

  const script = document.createElement('script');
  script.src = "/sweetalert2.all.min.js";
  document.head.appendChild(script);

  function getCurrentDir() {
    let path = window.location.pathname.replace(/^\/files/, '');
    return decodeURIComponent(path) || '/';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  }

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


  let lastRightClickedFile = "";
  document.addEventListener('contextmenu', function(e) {
    let row = e.target.closest('.item');
    if (row) {
      let nameEl = row.querySelector('.name');
      if (nameEl) lastRightClickedFile = nameEl.innerText.trim();
    } else lastRightClickedFile = "";
  }, true);

  document.addEventListener('click', function(e) {
    if (!e.target.closest('.asp-ss-btn-class') && !e.target.closest('.item[aria-selected="true"]')) lastRightClickedFile = "";
  }, true);

  const isMedia = (file) => file && file.match(/\.(mp4|mkv|avi|ts|m2ts|mov|webm|mpg|mpeg|wmv|flv|vob|iso)$/i);

  async function probeVideo(fullPath) {
    try {
      const r = await fetch(`${SS_API}?file=${encodeURIComponent(fullPath)}&probe=1`, { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j && j.meta) return j.meta;
    } catch (e) {}
    return { width: null, height: null, duration: null };
  }

  function clamp(v, lo, hi, fallback) {
    v = parseInt(v, 10);
    if (!Number.isFinite(v)) return fallback;
    return Math.max(lo, Math.min(hi, v));
  }

    async function promptSettings(fileName) {
    if (typeof Swal === 'undefined') {
      alert('界面组件加载中，请稍后重试。');
      return null;
    }

    const fullPath = (getCurrentDir() + '/' + fileName).replace(/\/\//g, '/');

    Swal.fire({
      title: '读取视频信息中...',
      html: '正在探测原始分辨率，用于设置默认值。',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading()
    });

    const meta = await probeVideo(fullPath);
    const origW = clamp(meta.width, 320, 3840, 1280);
    const origH = meta.height ? clamp(meta.height, 240, 2160, null) : null;

    const presetWs = [origW, 3840, 2560, 1920, 1280, 960, 720]
      .filter((v, i, a) => a.indexOf(v) === i)
      .filter((v) => v >= 320 && v <= 3840);
    const presetNs = [6, 8, 10, 12, 16];

    const html = `
      <style>
        .ss-wrap{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:18px;color:#111827;text-align:left}
        .ss-head{margin-bottom:16px}
        .ss-title{font-size:17px;font-weight:700;line-height:1.4;margin-bottom:6px}
        .ss-sub{font-size:13px;color:#4b5563;line-height:1.6}
        .ss-sub code{background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;padding:2px 6px}
        .ss-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
        .ss-pill{font-size:12px;color:#374151;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:4px 8px}
        .ss-form{display:grid;grid-template-columns:150px 1fr;gap:14px 14px;align-items:start}
        .ss-form label{font-size:13px;font-weight:600;color:#111827;padding-top:8px}
        .ss-control{display:flex;flex-direction:column;gap:8px}
        .ss-form input[type='number']{width:100%;padding:10px 12px;border-radius:8px;border:1px solid #d1d5db;background:#fff;color:#111827;outline:none}
        .ss-form input[type='number']:focus{border-color:#2563eb;box-shadow:0 0 0 2px rgba(37,99,235,.15)}
        .ss-form input[type='range']{width:100%;accent-color:#2563eb}
        .ss-chiprow{display:flex;flex-wrap:wrap;gap:8px}
        .ss-chip{cursor:pointer;user-select:none;padding:5px 10px;border-radius:8px;border:1px solid #d1d5db;background:#fff;font-size:12px;color:#374151}
        .ss-chip:hover{background:#f9fafb;border-color:#9ca3af}
        .ss-help{font-size:12px;color:#6b7280;line-height:1.6}
        .ss-value{display:inline-block;padding:2px 8px;border-radius:6px;background:#f3f4f6;border:1px solid #e5e7eb;color:#111827}
        @media (max-width:760px){.ss-form{grid-template-columns:1fr}}
      </style>

      <div class='ss-wrap'>
        <div class='ss-head'>
          <div class='ss-title'>截图参数设置</div>
          <div class='ss-sub'>文件：<code>${escapeHtml(fileName)}</code></div>
          <div class='ss-meta'>
            <span class='ss-pill'>源分辨率：${origW}${origH ? 'x' + origH : ''}</span>
            <span class='ss-pill'>输出格式：JPG + ZIP</span>
            <span class='ss-pill'>临时目录：/tmp/asp_screens</span>
          </div>
        </div>

        <div class='ss-form'>
          <label>截图数量</label>
          <div class='ss-control'>
            <input id='ss_n' type='number' min='1' max='20' value='6'/>
            <div class='ss-chiprow' id='ss_n_chips'>
              ${presetNs.map((n) => `<span class='ss-chip' data-n='${n}'>${n} 张</span>`).join('')}
            </div>
          </div>

          <label>宽度</label>
          <div class='ss-control'>
            <input id='ss_w' type='number' min='320' max='3840' value='${origW}'/>
            <div class='ss-chiprow' id='ss_w_chips'>
              ${presetWs.map((w) => `<span class='ss-chip' data-w='${w}'>${w}${w === origW ? '（原始）' : ''}</span>`).join('')}
            </div>
          </div>

          <label>跳过片头（%）</label>
          <div class='ss-control'>
            <input id='ss_head' type='range' min='0' max='20' value='5'/>
            <div class='ss-help'>当前：<span class='ss-value'><span id='ss_head_v'>5</span>%</span></div>
          </div>

          <label>跳过片尾（%）</label>
          <div class='ss-control'>
            <input id='ss_tail' type='range' min='0' max='20' value='5'/>
            <div class='ss-help'>当前：<span class='ss-value'><span id='ss_tail_v'>5</span>%</span></div>
          </div>

          <label>说明</label>
          <div class='ss-help'>跳过片头/片尾可减少 OP/ED 或字幕影响；若需完整区间截图可设为 0。</div>
        </div>
      </div>
    `;

    const result = await Swal.fire({
      title: '截图设置',
      html,
      width: 860,
      showCancelButton: true,
      confirmButtonText: '开始截图',
      cancelButtonText: '取消',
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#6b7280',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        const head = document.getElementById('ss_head');
        const tail = document.getElementById('ss_tail');
        const hv = document.getElementById('ss_head_v');
        const tv = document.getElementById('ss_tail_v');
        head.addEventListener('input', () => { hv.textContent = head.value; });
        tail.addEventListener('input', () => { tv.textContent = tail.value; });

        const nInput = document.getElementById('ss_n');
        const wInput = document.getElementById('ss_w');

        document.getElementById('ss_n_chips').addEventListener('click', (e) => {
          const t = e.target.closest('.ss-chip');
          if (!t) return;
          const n = t.getAttribute('data-n');
          if (n) nInput.value = n;
        });

        document.getElementById('ss_w_chips').addEventListener('click', (e) => {
          const t = e.target.closest('.ss-chip');
          if (!t) return;
          const w = t.getAttribute('data-w');
          if (w) wInput.value = w;
        });
      },
      preConfirm: () => {
        const n = clamp(document.getElementById('ss_n').value, 1, 20, 6);
        const w = clamp(document.getElementById('ss_w').value, 320, 3840, origW);
        const head = clamp(document.getElementById('ss_head').value, 0, 20, 5);
        const tail = clamp(document.getElementById('ss_tail').value, 0, 20, 5);
        return { n, width: w, head, tail, fullPath, meta };
      }
    });

    if (!result.isConfirmed) {
      Swal.close();
      return null;
    }
    return result.value;
  }

    function openScreenshot(fileName) {
    promptSettings(fileName).then((opt) => {
      if (!opt) return;

      Swal.fire({
        title: '截图生成中...',
        html: `数量 <b>${opt.n}</b> / 宽度 <b>${opt.width}</b> / 跳过片头 <b>${opt.head}%</b> / 跳过片尾 <b>${opt.tail}%</b>`,
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading()
      });

      const url = `${SS_API}?file=${encodeURIComponent(opt.fullPath)}&n=${opt.n}&width=${opt.width}&head=${opt.head}&tail=${opt.tail}&fmt=jpg&zip=1`;

      fetch(url, { cache: 'no-store' })
        .then((r) => r.json().then((j) => ({ ok: r.ok, status: r.status, json: j })))
        .then(({ ok, status, json }) => {
          if (!ok || !json || !json.base || !Array.isArray(json.files) || json.files.length === 0) {
            const msg = (json && json.error) ? json.error : `请求失败 (HTTP ${status})`;
            throw new Error(msg);
          }

          const base = json.base;
          const imgs = json.files.map((f) => `${base}${f}`);
          const absoluteImgs = imgs.map((u) => new URL(u, window.location.origin).href);
          const allLinksText = absoluteImgs.join('\n');
          const zipUrl = json.zip ? `${base}${json.zip}` : null;

          let html = `<style>
            .ss-panel{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px;color:#111827}
            .ss-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:12px}
            .ss-file{font-size:13px;color:#374151;line-height:1.6}
            .ss-file code{background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;padding:2px 6px}
            .ss-meta{display:flex;gap:8px;flex-wrap:wrap}
            .ss-meta span{font-size:12px;color:#4b5563;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:4px 8px}
            .ss-action-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0 12px}
            .ss-btn{border:1px solid #d1d5db;background:#fff;color:#111827;border-radius:8px;padding:7px 12px;font-size:13px;cursor:pointer}
            .ss-btn:hover{background:#f9fafb}
            .ss-btn-primary{border-color:#2563eb;color:#1d4ed8}
            .ss-status{font-size:12px;color:#4b5563}
            .ss-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
            .ss-card{border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;background:#fff}
            .ss-bar{padding:8px 10px;display:flex;justify-content:space-between;align-items:center;background:#f9fafb;border-bottom:1px solid #e5e7eb;font-size:12px;color:#4b5563}
            .ss-idx{font-weight:700;color:#111827}
            .ss-img{display:block;width:100%}
            .ss-foot{margin-top:12px;padding:10px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa;font-size:12px;color:#374151;line-height:1.6}
            .ss-foot code{background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;padding:2px 6px}
            .ss-foot a{color:#1d4ed8;text-decoration:none;word-break:break-all}
            .ss-foot a:hover{text-decoration:underline}
            @media (max-width:760px){.ss-grid{grid-template-columns:1fr}}
          </style>`;

          html += `<div class='ss-panel'>`;
          html += `<div class='ss-top'><div class='ss-file'>文件：<code>${escapeHtml(fileName)}</code></div><div class='ss-meta'><span>${imgs.length} 张截图</span><span>宽度 ${opt.width}</span><span>片头/片尾 ${opt.head}% / ${opt.tail}%</span></div></div>`;
          html += `<div class='ss-action-row'>`;
          html += `<button type='button' class='ss-btn ss-btn-primary' id='ss_zip_btn'>下载 ZIP</button>`;
          html += `<button type='button' class='ss-btn' id='ss_copy_btn'>复制全部链接</button>`;
          html += `<span class='ss-status' id='ss_status'>操作按钮不会关闭此弹窗，点“关闭”才会退出。</span>`;
          html += `</div>`;
          html += `<div class='ss-grid'>` + imgs.map((u, i) => `
              <a href='${u}' target='_blank' style='text-decoration:none'>
                <div class='ss-card'>
                  <div class='ss-bar'><span class='ss-idx'>#${i + 1}</span><span>新标签打开</span></div>
                  <img class='ss-img' src='${u}' loading='lazy'/>
                </div>
              </a>`).join('') + `</div>`;
          html += `<div class='ss-foot'>ZIP 包：<code>${json.zip || '未生成'}</code><br/>${zipUrl ? `ZIP 地址：<a href='${zipUrl}' target='_blank'>${zipUrl}</a>` : '未生成 ZIP，可使用“复制全部链接”获取每张截图地址。'}</div>`;
          html += `</div>`;

          Swal.fire({
            title: '截图已生成',
            html,
            width: '980px',
            showCancelButton: true,
            showConfirmButton: false,
            cancelButtonText: '关闭',
            cancelButtonColor: '#6b7280',
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => {
              const zipBtn = document.getElementById('ss_zip_btn');
              const copyBtn = document.getElementById('ss_copy_btn');
              const status = document.getElementById('ss_status');

              if (zipBtn) {
                if (!zipUrl && !imgs[0]) {
                  zipBtn.disabled = true;
                  zipBtn.style.opacity = '0.5';
                  zipBtn.style.cursor = 'not-allowed';
                }
                zipBtn.addEventListener('click', () => {
                  if (zipUrl) {
                    window.open(zipUrl, '_blank');
                    if (status) status.textContent = '已在新标签页打开 ZIP 下载链接。';
                  } else if (imgs[0]) {
                    window.open(imgs[0], '_blank');
                    if (status) status.textContent = '未生成 ZIP，已打开第一张截图。';
                  }
                });
              }

              if (copyBtn) {
                copyBtn.addEventListener('click', () => {
                  copyText(allLinksText).then(() => {
                    if (status) status.textContent = `已复制 ${imgs.length} 条截图下载链接。`;
                  }).catch(() => {
                    if (status) status.textContent = '复制失败，请手动复制下方图片链接。';
                  });
                });
              }
            }
          });
        })
        .catch((e) => Swal.fire('截图失败', e.toString(), 'error'));
    });
  }

  // 注入按钮（仿 MediaInfo）
  let observerTimer = null;
  const observer = new MutationObserver(() => {
    if (observerTimer) clearTimeout(observerTimer);
    observerTimer = setTimeout(() => {
      let targetFile = "";
      if (lastRightClickedFile) targetFile = lastRightClickedFile;
      else {
        let selectedRows = document.querySelectorAll('.item[aria-selected="true"], .item.selected');
        if (selectedRows.length === 1) {
          let nameEl = selectedRows[0].querySelector('.name');
          if (nameEl) targetFile = nameEl.innerText.trim();
        }
      }

      let ok = isMedia(targetFile);

      let menus = new Set();
      document.querySelectorAll('button[aria-label="Info"]').forEach(btn => {
        if (btn.parentElement) menus.add(btn.parentElement);
      });

      menus.forEach(menu => {
        let existingBtn = menu.querySelector('.asp-ss-btn-class');
        if (ok) {
          if (!existingBtn) {
            let btn = document.createElement('button');
            btn.className = 'action asp-ss-btn-class';
            btn.setAttribute('title', 'Screenshot');
            btn.setAttribute('aria-label', 'Screenshot');
            btn.innerHTML = '<i class="material-icons">photo_camera</i><span>Screenshot</span>';

            btn.onclick = function(ev) {
              ev.preventDefault();
              ev.stopPropagation();
              document.body.click();
              openScreenshot(targetFile);
            };

            let miBtn = menu.querySelector('.asp-mi-btn-class');
            if (miBtn) miBtn.insertAdjacentElement('afterend', btn);
            else {
              let infoBtn = menu.querySelector('button[aria-label="Info"]');
              if (infoBtn) infoBtn.insertAdjacentElement('afterend', btn);
              else menu.appendChild(btn);
            }
          } else {
            let miBtn = menu.querySelector('.asp-mi-btn-class');
            if (miBtn && existingBtn.previousElementSibling !== miBtn) miBtn.insertAdjacentElement('afterend', existingBtn);
          }
        } else {
          if (existingBtn) existingBtn.remove();
        }
      });
    }, 100);
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
