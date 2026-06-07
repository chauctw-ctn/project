function initHeader() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const menuBtn = document.getElementById('menu-btn');

    const userMenuBtn = document.getElementById('user-menu-btn');
    const userDropdown = document.getElementById('user-dropdown');

    // Lấy role/username theo thứ tự ưu tiên:
    // 1. sessionStorage  2. localStorage (userRole)  3. decode JWT token
    let username = sessionStorage.getItem('username') || localStorage.getItem('username');
    let role     = sessionStorage.getItem('role')     || localStorage.getItem('userRole');

    if (!username || !role) {
        try {
            const token = localStorage.getItem('token');
            if (token) {
                const payload = JSON.parse(atob(token.split('.')[1]));
                username = username || payload.username || payload.name || 'Admin';
                role     = role     || payload.role     || 'user';
            }
        } catch (e) {
            console.warn('Không decode được JWT:', e);
        }
    }

    username = username || 'Admin';
    role     = role     || 'user';

    setText('username-display', username);
    setText('dropdown-username', username);
    setText('dropdown-role', role === 'admin' ? 'Quản trị viên' : 'Người dùng');

    if (role === 'admin') {
        showElement('add-user-btn');
        showElement('manage-users-btn');
        showElement('telegram-config-btn');
        showElement('coordinates-config-btn');
    }

    // Biến lưu trạng thái cấu hình
    let cachedModalsConfig = { telegram: {}, coordinates: {} };
    let selectedUserToDelete = '';
    let selectedUserToEdit = '';

    function setMenuIcon(name) {
        const icon = menuBtn?.querySelector('.material-icons-round');
        if (icon) icon.textContent = name;
    }

    function closeMobileSidebar() {
        sidebar?.classList.remove('open');
        overlay?.classList.remove('show');
        setMenuIcon('menu');
    }

    function setDesktopSidebarExpanded(expanded) {
        document.body.classList.toggle('sidebar-expanded', expanded);
        sidebar?.classList.toggle('expanded', expanded);
        setMenuIcon(expanded ? 'menu_open' : 'menu');
    }

    function syncSidebarButtonState() {
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            sidebar?.classList.remove('expanded');
            document.body.classList.remove('sidebar-expanded');
            setMenuIcon(sidebar?.classList.contains('open') ? 'close' : 'menu');
            return;
        }

        sidebar?.classList.remove('open');
        overlay?.classList.remove('show');
        setDesktopSidebarExpanded(document.body.classList.contains('sidebar-expanded'));
    }

    // Tải cấu hình từ Backend khi trang tải
    async function loadModalsConfig() {
        try {
            const res = await fetch('/api/config/modals');
            const data = await res.json();
            if (data.success && data.data) {
                cachedModalsConfig = data.data;
                // Đồng bộ hóa với localStorage để các hệ thống trạm/realtime khác vẫn hoạt động mượt mà
                if (cachedModalsConfig.telegram) {
                    localStorage.setItem('telegramConfig', JSON.stringify(cachedModalsConfig.telegram));
                }
                if (cachedModalsConfig.coordinates) {
                    localStorage.setItem('stationCoordinates', JSON.stringify(cachedModalsConfig.coordinates));
                }
            }
        } catch (err) {
            console.error('Không tải được cấu hình modals từ server:', err);
        }
    }

    loadModalsConfig();

    syncSidebarButtonState();

    // ===== SIDEBAR =====
    menuBtn?.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            sidebar?.classList.toggle('open');
            overlay?.classList.toggle('show');
            setMenuIcon(sidebar?.classList.contains('open') ? 'close' : 'menu');
            return;
        }

        const expanded = !document.body.classList.contains('sidebar-expanded');
        setDesktopSidebarExpanded(expanded);
    });

    overlay?.addEventListener('click', () => {
        closeMobileSidebar();
    });

    window.addEventListener('resize', syncSidebarButtonState);

    // ===== USER DROPDOWN =====
    userMenuBtn?.addEventListener('click', e => {
        e.stopPropagation();
        userDropdown?.classList.toggle('show');
        userMenuBtn.classList.toggle('open');
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.user-menu-container')) {
            userDropdown?.classList.remove('show');
            userMenuBtn?.classList.remove('open');
        }
    });

    // ===== LOGOUT =====
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (e) {
            console.error('Lỗi khi gọi API logout:', e);
        }
        sessionStorage.clear();
        localStorage.removeItem('username');
        localStorage.removeItem('role');
        localStorage.removeItem('userRole');
        localStorage.removeItem('token');
        window.location.href = '/login.html';
    });

    // ===== MODAL TRIGGERS =====
    const modalTriggers = [
        { btn: 'change-password-btn',    modal: 'change-password-modal'    },
        { btn: 'add-user-btn',           modal: 'add-user-modal'           },
        { btn: 'manage-users-btn',       modal: 'manage-users-modal'       },
        { btn: 'telegram-config-btn',    modal: 'telegram-config-modal'    },
        { btn: 'coordinates-config-btn', modal: 'coordinates-config-modal' },
    ];

    modalTriggers.forEach(({ btn, modal }) => {
        document.getElementById(btn)?.addEventListener('click', () => {
            userDropdown?.classList.remove('show');
            userMenuBtn?.classList.remove('open');
            openModal(modal);
        });
    });

    // Đóng modal: nút data-auth-close
    document.addEventListener('click', e => {
        const closeTarget = e.target.closest('[data-auth-close]');
        if (closeTarget) closeModal(closeTarget.dataset.authClose);
    });

    // Đóng modal: click backdrop
    document.querySelectorAll('.auth-modal').forEach(modal => {
        modal.addEventListener('click', e => {
            if (e.target === modal) closeModal(modal.id);
        });
    });

    // Đóng modal: phím Escape
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.auth-modal.show').forEach(m => closeModal(m.id));
        }
    });

    // ===== CHANGE PASSWORD FORM SUBMIT =====
    document.getElementById('change-password-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const currentPassword = document.getElementById('current-password')?.value;
        const newPassword = document.getElementById('new-password')?.value;
        const confirmPassword = document.getElementById('confirm-password')?.value;
        const errorEl = document.getElementById('change-password-error');

        if (newPassword !== confirmPassword) {
            if (errorEl) {
                errorEl.textContent = 'Mật khẩu xác nhận không trùng khớp!';
                errorEl.style.display = 'block';
            }
            return;
        }

        try {
            const res = await fetch('/api/users/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, currentPassword, newPassword })
            });
            const data = await res.json();
            if (data.success) {
                alert('Đổi mật khẩu thành công!');
                closeModal('change-password-modal');
                e.target.reset();
                if (errorEl) {
                    errorEl.textContent = '';
                    errorEl.style.display = 'none';
                }
            } else {
                if (errorEl) {
                    errorEl.textContent = data.message || 'Lỗi đổi mật khẩu!';
                    errorEl.style.display = 'block';
                }
            }
        } catch (err) {
            if (errorEl) {
                errorEl.textContent = 'Lỗi kết nối máy chủ!';
                errorEl.style.display = 'block';
            }
        }
    });

    // ===== ADD USER FORM SUBMIT =====
    document.getElementById('add-user-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const newUsername = document.getElementById('new-username')?.value.trim();
        const newPassword = document.getElementById('new-user-password')?.value;
        const newRole = document.getElementById('new-user-role')?.value;
        const newStatus = document.getElementById('new-user-status')?.value;
        const errorEl = document.getElementById('add-user-error');

        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole, status: newStatus })
            });
            const data = await res.json();
            if (data.success) {
                alert('Thêm người dùng mới thành công!');
                closeModal('add-user-modal');
                e.target.reset();
                if (errorEl) {
                    errorEl.textContent = '';
                    errorEl.style.display = 'none';
                }
                // Tải lại danh sách nếu đang mở manage-users-modal
                if (document.getElementById('manage-users-modal')?.classList.contains('show')) {
                    loadUsersList();
                }
            } else {
                if (errorEl) {
                    errorEl.textContent = data.message || 'Lỗi thêm người dùng!';
                    errorEl.style.display = 'block';
                }
            }
        } catch (err) {
            if (errorEl) {
                errorEl.textContent = 'Lỗi kết nối máy chủ!';
                errorEl.style.display = 'block';
            }
        }
    });

    // ===== USER LIST MANAGEMENT =====
    async function loadUsersList() {
        const container = document.getElementById('users-list-container');
        if (!container) return;

        container.innerHTML = '<div style="padding:10px;text-align:center;">Đang tải danh sách người dùng...</div>';

        try {
            const res = await fetch('/api/users');
            const data = await res.json();
            if (data.success && data.data) {
                const users = data.data;
                if (users.length === 0) {
                    container.innerHTML = '<div style="padding:10px;text-align:center;">Không có người dùng nào.</div>';
                    return;
                }

                let html = `
                    <table>
                        <thead>
                            <tr>
                                <th>Tên đăng nhập</th>
                                <th>Vai trò</th>
                                <th>Trạng thái</th>
                                <th style="text-align:right;">Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                users.forEach(u => {
                    const roleText = u.role === 'admin' ? 'Quản trị viên' : 'Người dùng';
                    const statusText = u.status === 'active' ? 'Hoạt động' : 'Bị khóa';
                    const statusClass = u.status === 'active' ? 'text-success' : 'text-danger';

                    html += `
                        <tr>
                            <td><strong>${u.username}</strong></td>
                            <td>${roleText}</td>
                            <td><span class="${statusClass}">${statusText}</span></td>
                            <td style="text-align:right;">
                                <button class="auth-btn edit-user-action-btn" data-username="${u.username}" data-role="${u.role}" data-status="${u.status || 'active'}" style="padding:4px 8px;font-size:12px;margin-right:4px;">
                                    Sửa
                                </button>
                                <button class="auth-btn danger delete-user-action-btn" data-username="${u.username}" style="padding:4px 8px;font-size:12px;">
                                    Xóa
                                </button>
                            </td>
                        </tr>
                    `;
                });

                html += `
                        </tbody>
                    </table>
                `;
                container.innerHTML = html;

                // Gắn sự kiện sửa/xóa
                container.querySelectorAll('.edit-user-action-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        selectedUserToEdit = btn.getAttribute('data-username');
                        const editRole = btn.getAttribute('data-role');
                        const editStatus = btn.getAttribute('data-status');

                        const uInput = document.getElementById('edit-username');
                        if (uInput) uInput.value = selectedUserToEdit;

                        const rSelect = document.getElementById('edit-user-role');
                        if (rSelect) rSelect.value = editRole;

                        const sSelect = document.getElementById('edit-user-status');
                        if (sSelect) sSelect.value = editStatus;

                        const pInput = document.getElementById('edit-user-password');
                        if (pInput) pInput.value = '';

                        const errEl = document.getElementById('edit-user-error');
                        if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

                        openModal('edit-user-modal');
                    });
                });

                container.querySelectorAll('.delete-user-action-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        selectedUserToDelete = btn.getAttribute('data-username');
                        const msgEl = document.getElementById('delete-user-message');
                        if (msgEl) {
                            msgEl.textContent = `Bạn chắc chắn muốn xóa người dùng "${selectedUserToDelete}"? Hành động này không thể hoàn tác.`;
                        }
                        const errEl = document.getElementById('delete-user-error');
                        if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

                        openModal('delete-user-modal');
                    });
                });

            } else {
                container.innerHTML = `<div style="padding:10px;text-align:center;color:var(--red);">${data.message || 'Lỗi tải danh sách người dùng!'}</div>`;
            }
        } catch (err) {
            container.innerHTML = '<div style="padding:10px;text-align:center;color:var(--red);">Lỗi kết nối máy chủ!</div>';
        }
    }

    document.getElementById('manage-users-btn')?.addEventListener('click', () => {
        loadUsersList();
    });

    // ===== EDIT USER FORM SUBMIT =====
    document.getElementById('edit-user-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const roleVal = document.getElementById('edit-user-role')?.value;
        const statusVal = document.getElementById('edit-user-status')?.value;
        const passwordVal = document.getElementById('edit-user-password')?.value;
        const errorEl = document.getElementById('edit-user-error');

        try {
            const res = await fetch(`/api/users/${selectedUserToEdit}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: roleVal, status: statusVal, password: passwordVal || undefined })
            });
            const data = await res.json();
            if (data.success) {
                alert('Cập nhật người dùng thành công!');
                closeModal('edit-user-modal');
                loadUsersList();
            } else {
                if (errorEl) {
                    errorEl.textContent = data.message || 'Lỗi cập nhật!';
                    errorEl.style.display = 'block';
                }
            }
        } catch (err) {
            if (errorEl) {
                errorEl.textContent = 'Lỗi kết nối máy chủ!';
                errorEl.style.display = 'block';
            }
        }
    });

    // ===== CONFIRM DELETE USER =====
    document.getElementById('confirm-delete-user')?.addEventListener('click', async () => {
        const errorEl = document.getElementById('delete-user-error');
        if (selectedUserToDelete === username) {
            if (errorEl) {
                errorEl.textContent = 'Bạn không thể tự xóa tài khoản của chính mình!';
                errorEl.style.display = 'block';
            }
            return;
        }

        try {
            const res = await fetch(`/api/users/${selectedUserToDelete}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                alert('Xóa người dùng thành công!');
                closeModal('delete-user-modal');
                loadUsersList();
            } else {
                if (errorEl) {
                    errorEl.textContent = data.message || 'Lỗi xóa!';
                    errorEl.style.display = 'block';
                }
            }
        } catch (err) {
            if (errorEl) {
                errorEl.textContent = 'Lỗi kết nối máy chủ!';
                errorEl.style.display = 'block';
            }
        }
    });

    // ===== TELEGRAM CONFIG =====
    document.getElementById('telegram-config-btn')?.addEventListener('click', () => {
        try {
            const cfg = cachedModalsConfig.telegram || {};
            setInputValue('telegram-enabled',          cfg.enabled         ?? false, 'checkbox');
            setInputValue('telegram-bot-token',        cfg.botToken        ?? '');
            setInputValue('telegram-chat-id',          cfg.chatId          ?? '');
            setInputValue('telegram-refresh-interval', cfg.refreshInterval ?? 15);
            setInputValue('telegram-delay-threshold',  cfg.delayThreshold  ?? 60);
        } catch (e) { /* bỏ qua */ }
    });

    document.getElementById('telegram-config-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const cfg = {
            enabled:         document.getElementById('telegram-enabled')?.checked        ?? false,
            botToken:        document.getElementById('telegram-bot-token')?.value.trim() ?? '',
            chatId:          document.getElementById('telegram-chat-id')?.value.trim()   ?? '',
            refreshInterval: Number(document.getElementById('telegram-refresh-interval')?.value) || 15,
            delayThreshold:  Number(document.getElementById('telegram-delay-threshold')?.value)  || 60,
        };

        const errorEl = document.getElementById('telegram-config-error');

        try {
            const res = await fetch('/api/config/modals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telegram: cfg })
            });
            const data = await res.json();
            if (data.success) {
                cachedModalsConfig.telegram = cfg;
                localStorage.setItem('telegramConfig', JSON.stringify(cfg));
                alert('Lưu cấu hình Telegram thành công!');
                closeModal('telegram-config-modal');
            } else {
                if (errorEl) {
                    errorEl.textContent = data.message || 'Lỗi lưu cấu hình!';
                    errorEl.style.display = 'block';
                }
            }
        } catch (err) {
            if (errorEl) {
                errorEl.textContent = 'Lỗi kết nối máy chủ!';
                errorEl.style.display = 'block';
            }
        }
    });

    // ===== COORDINATES CONFIG =====    
    document.getElementById('coordinates-config-btn')?.addEventListener('click', () => {
        try {
            const saved = cachedModalsConfig.coordinates || {};
            
            if (Object.keys(saved).length > 0) {
                // Duyệt qua từng trạm và ép cấu hình của trạm đó thành 1 hàng
                const lines = Object.entries(saved).map(([stationId, geoData]) => {
                    return `  "${stationId}": ${JSON.stringify(geoData)}`;
                });
                // Nối các hàng lại bằng dấu xuống dòng \n
                const formattedJson = `{\n${lines.join(',\n')}\n}`;
                setInputValue('coordinates-json', formattedJson);
            } else {
                setInputValue('coordinates-json', '');
            }
        } catch (e) { /* bỏ qua */ }
    });

    document.getElementById('coordinates-config-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const raw   = document.getElementById('coordinates-json')?.value.trim();
        const errEl = document.getElementById('coordinates-config-error');
        let parsed = {};

        if (raw) {
            try {
                parsed = JSON.parse(raw);
            } catch {
                if (errEl) {
                    errEl.textContent    = 'JSON không hợp lệ, vui lòng kiểm tra lại.';
                    errEl.style.display  = 'block';
                }
                return;
            }
        }

        if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

        try {
            const res = await fetch('/api/config/modals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ coordinates: parsed })
            });
            const data = await res.json();
            if (data.success) {
                cachedModalsConfig.coordinates = parsed;
                localStorage.setItem('stationCoordinates', JSON.stringify(parsed));
                alert('Lưu cấu hình tọa độ thành công!');
                closeModal('coordinates-config-modal');
            } else {
                if (errEl) {
                    errEl.textContent = data.message || 'Lỗi lưu cấu hình!';
                    errEl.style.display = 'block';
                }
            }
        } catch (err) {
            if (errEl) {
                errEl.textContent = 'Lỗi kết nối máy chủ!';
                errEl.style.display = 'block';
            }
        }
    });

    updateClock();
    setInterval(updateClock, 1000);
}

// ===== HELPERS =====

function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('show');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.style.display = '';
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('show');
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function showElement(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
}

function setInputValue(id, value, type = 'text') {
    const el = document.getElementById(id);
    if (!el) return;
    if (type === 'checkbox') {
        el.checked = Boolean(value);
    } else {
        el.value = value;
    }
}

function updateClock() {
    const el = document.getElementById('current-time');
    if (!el) return;
    el.textContent = new Date().toLocaleTimeString('vi-VN', { hour12: false });
}

document.addEventListener('layout:ready', initHeader);