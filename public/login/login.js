document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('error-message');
    const loginBtn = document.getElementById('btn-login-submit');
    const overlay = document.querySelector('.page-transition-overlay');

    if (!loginForm) {
        console.error('Không tìm thấy form đăng nhập!');
        return;
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            setError('Vui lòng nhập tên đăng nhập và mật khẩu!');
            return;
        }

        setError('');
        setLoading(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    password
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {

                // Xóa dữ liệu cũ
                localStorage.removeItem('token');
                localStorage.removeItem('userRole');
                localStorage.removeItem('username');

                // Lấy dữ liệu từ response
                const token =
                    data.token ||
                    data.accessToken ||
                    data.jwt ||
                    '';

                const userRole =
                    data.userRole ||
                    data.role ||
                    data.user?.role ||
                    'user';

                const userName =
                    data.username ||
                    data.user?.username ||
                    username;

                // Lưu localStorage
                if (token) {
                    localStorage.setItem('token', token);
                }

                localStorage.setItem('userRole', userRole);
                localStorage.setItem('username', userName);

                console.log('Login success');
                console.log('Token:', token);
                console.log('Role:', userRole);
                console.log('Username:', userName);

                // Hiệu ứng chuyển trang
                document.body.classList.add('transitioning');

                if (overlay) {
                    overlay.classList.add('active');
                }

                setTimeout(() => {
                    window.location.href =
                        data.redirectPath ||
                        '/index.html';
                }, 400);

            } else {
                setError(
                    data.message ||
                    'Đăng nhập thất bại. Vui lòng thử lại!'
                );
                setLoading(false);
            }

        } catch (error) {
            console.error('Login error:', error);

            setError(
                'Không thể kết nối đến máy chủ hệ thống!'
            );
            setLoading(false);
        }
    });

    function setLoading(isLoading) {
        if (!loginBtn) return;

        if (isLoading) {
            loginBtn.disabled = true;
            loginBtn.classList.add('loading');
        } else {
            loginBtn.disabled = false;
            loginBtn.classList.remove('loading');
        }
    }

    function setError(message) {
        if (!errorMessage) return;

        if (!message) {
            errorMessage.textContent = '';
            errorMessage.classList.remove('show');
        } else {
            errorMessage.textContent = message;
            errorMessage.classList.add('show');
        }
    }
});