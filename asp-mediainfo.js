/**
 * Auto-Seedbox-PT (ASP) MediaInfo 极客前端扩展
 * 由 Nginx 底层动态注入
 */
(function() {
    console.log("🚀 [ASP] MediaInfo v1.1 已加载 (优化 PT 发种体验)！");
    
    // 兼容剪贴板复制逻辑
    const copyText = (text) => {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        } else {
            let textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.opacity = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            return new Promise((res, rej) => {
                document.execCommand('copy') ? res() : rej();
                textArea.remove();
            });
        }
    };

    // 动态引入弹窗 UI 库
    const script = document.createElement('script');
    script.src = "/sweetalert2.all.min.js";
    document.head.appendChild(script);

    function getCurrentPath() {
        let path = window.location.pathname.replace(/^\/files/, '');
        return decodeURIComponent(path) || '/';
    }

    let lastRightClickedFile = "";

    // 捕获右键选中目标
    document.addEventListener('contextmenu', function(e) {
        let row = e.target.closest('.item');
        if (row) {
            let nameEl = row.querySelector('.name');
            if (nameEl) lastRightClickedFile = nameEl.innerText.trim();
        } else {
            lastRightClickedFile = "";
        }
    }, true);

    // 左键点击任意非按钮区域，清空右键记忆，防止幽灵状态
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.asp-mi-btn-class') && !e.target.closest('.item[aria-selected="true"]')) {
            lastRightClickedFile = "";
        }
    }, true);

        const openMediaInfo = (fileName) => {
        const fullPath = (getCurrentPath() + '/' + fileName).replace(/\/\//g, '/');
        if (typeof Swal === 'undefined') {
            alert('界面组件加载中，请稍后重试...');
            return;
        }

        const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

        Swal.fire({
            title: '解析中...',
            text: '正在读取媒体轨道信息',
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => Swal.showLoading()
        });

        fetch(`/api/mi?file=${encodeURIComponent(fullPath)}`)
            .then((r) => r.json())
            .then((data) => {
                if (data.error) throw new Error(data.error);

                let rawText = '';
                let html = `<style>
                    .mi-wrap{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px;color:#111827;text-align:left}
                    .mi-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
                    .mi-btn{border:1px solid #d1d5db;background:#fff;color:#111827;border-radius:8px;padding:7px 12px;font-size:13px;cursor:pointer}
                    .mi-btn:hover{background:#f9fafb}
                    .mi-status{font-size:12px;color:#4b5563}
                    .mi-box{max-height:540px;overflow:auto;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa;padding:12px;font-family:Consolas,'Courier New',monospace;font-size:13px;line-height:1.6}
                    .mi-track{margin-bottom:14px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px}
                    .mi-track:last-child{margin-bottom:0}
                    .mi-track-header{font-size:14px;font-weight:700;color:#111827;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #e5e7eb}
                    .mi-item{display:flex;gap:10px;padding:4px 0;border-bottom:1px dashed #e5e7eb}
                    .mi-item:last-child{border-bottom:none}
                    .mi-key{width:200px;flex-shrink:0;color:#4b5563}
                    .mi-val{flex:1;color:#111827;word-break:break-word}
                    @media (max-width:760px){.mi-item{flex-direction:column;gap:2px}.mi-key{width:auto}}
                </style>`;

                html += `<div class='mi-wrap'>`;
                html += `<div class='mi-toolbar'>`;
                html += `<button type='button' class='mi-btn' id='mi_copy_raw'>复制纯文本</button>`;
                html += `<button type='button' class='mi-btn' id='mi_copy_bbcode'>复制 BBCode</button>`;
                html += `<span class='mi-status' id='mi_status'>复制操作不会关闭弹窗，点“关闭”才会退出。</span>`;
                html += `</div>`;
                html += `<div class='mi-box'>`;

                if (data.media && Array.isArray(data.media.track)) {
                    data.media.track.forEach((t) => {
                        const type = t['@type'] || 'Unknown';
                        rawText += `${type}\n`;
                        html += `<div class='mi-track'><div class='mi-track-header'>${esc(type)}</div>`;

                        Object.keys(t).forEach((k) => {
                            if (k === '@type') return;
                            let val = t[k];
                            if (typeof val === 'object') val = JSON.stringify(val);
                            const valStr = String(val ?? '');
                            const paddedKey = String(k).padEnd(32, ' ');
                            rawText += `${paddedKey}: ${valStr}\n`;
                            html += `<div class='mi-item'><div class='mi-key'>${esc(k)}</div><div class='mi-val'>${esc(valStr)}</div></div>`;
                        });

                        rawText += `\n`;
                        html += `</div>`;
                    });
                } else {
                    rawText = JSON.stringify(data, null, 2);
                    html += `<pre>${esc(rawText)}</pre>`;
                }

                html += `</div></div>`;

                Swal.fire({
                    title: `MediaInfo：${fileName}`,
                    html,
                    width: '920px',
                    showCancelButton: true,
                    showConfirmButton: false,
                    cancelButtonText: '关闭',
                    cancelButtonColor: '#6b7280',
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    didOpen: () => {
                        const rawBtn = document.getElementById('mi_copy_raw');
                        const bbBtn = document.getElementById('mi_copy_bbcode');
                        const status = document.getElementById('mi_status');

                        if (rawBtn) {
                            rawBtn.addEventListener('click', () => {
                                copyText(rawText.trim()).then(() => {
                                    if (status) status.textContent = '纯文本已复制到剪贴板。';
                                }).catch(() => {
                                    if (status) status.textContent = '复制失败，请手动复制下方内容。';
                                });
                            });
                        }

                        if (bbBtn) {
                            bbBtn.addEventListener('click', () => {
                                const bbcode = `[quote]\n${rawText.trim()}\n[/quote]`;
                                copyText(bbcode).then(() => {
                                    if (status) status.textContent = 'BBCode 已复制到剪贴板。';
                                }).catch(() => {
                                    if (status) status.textContent = '复制失败，请手动复制下方内容。';
                                });
                            });
                        }
                    }
                });
            })
            .catch((e) => Swal.fire('解析失败', e.toString(), 'error'));
    };

    // 性能优化：加入防抖 (Debounce) 机制
    let observerTimer = null;
    const observer = new MutationObserver(() => {
        if (observerTimer) clearTimeout(observerTimer);
        
        observerTimer = setTimeout(() => {
            let targetFile = "";
            if (lastRightClickedFile) {
                targetFile = lastRightClickedFile;
            } else {
                let selectedRows = document.querySelectorAll('.item[aria-selected="true"], .item.selected');
                if (selectedRows.length === 1) {
                    let nameEl = selectedRows[0].querySelector('.name');
                    if (nameEl) targetFile = nameEl.innerText.trim();
                }
            }

            // 扩展支持：添加原盘 index.bdmv 及无损音频格式
            let isMedia = targetFile && targetFile.match(/\.(mp4|mkv|avi|ts|iso|rmvb|wmv|flv|mov|webm|vob|m2ts|bdmv|flac|wav|ape|alac)$/i);

            let menus = new Set();
            document.querySelectorAll('button[aria-label="Info"]').forEach(btn => {
                if (btn.parentElement) menus.add(btn.parentElement);
            });

            menus.forEach(menu => {
                let existingBtn = menu.querySelector('.asp-mi-btn-class');
                if (isMedia) {
                    if (!existingBtn) {
                        let btn = document.createElement('button');
                        btn.className = 'action asp-mi-btn-class';
                        btn.setAttribute('title', 'MediaInfo');
                        btn.setAttribute('aria-label', 'MediaInfo');
                        btn.innerHTML = '<i class="material-icons">movie</i><span>MediaInfo</span>';
                        
                        btn.onclick = function(ev) {
                            ev.preventDefault();
                            ev.stopPropagation();
                            document.body.click(); 
                            openMediaInfo(targetFile);
                        };
                        
                        let infoBtn = menu.querySelector('button[aria-label="Info"]');
                        if (infoBtn) {
                            infoBtn.insertAdjacentElement('afterend', btn);
                        } else {
                            menu.appendChild(btn);
                        }
                    }
                } else {
                    if (existingBtn) existingBtn.remove();
                }
            });
        }, 100); // 100ms 延迟，极大降低浏览器性能开销
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();
