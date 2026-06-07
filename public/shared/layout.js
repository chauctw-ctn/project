async function loadLayout() {
    const container = document.getElementById('layout-container');

    if (!container) {
        console.error('Không tìm thấy #layout-container');
        return;
    }

    try {
        const response = await fetch('/shared/layout.html');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        container.innerHTML = await response.text();

        document.dispatchEvent(new CustomEvent('layout:ready'));
    } catch (error) {
        console.error('Không load được layout.html:', error);
    }
}

document.addEventListener('DOMContentLoaded', loadLayout);