/**
 * HỆ THỐNG GIÁM SÁT TRẠM SCADA - TOÀN BỘ LOGIC XỬ LÝ FRONTEND
 */

// Biến toàn cục để quản lý thực thể Line Chart (Tránh lỗi giật hình, đè chuột)
let myLineChart = null;

// =========================================================================
// HÀM CHỨC NĂNG 1: Gọi API để kéo dữ liệu JSON từ Server về Trình duyệt
// =========================================================================
async function fetchWaterData() {
    try {
        const response = await fetch('/api/water-data');
        const data = await response.json();
        console.log('Dữ liệu nhận được từ API:', data);        

        // Kích hoạt đồng thời 3 tầng xử lý:
        renderTable(data);  // 1. Đổ bảng chữ thô
        updateCharts(data); // 2. Vẽ đồ thị & Vặn kim đồng hồ SVG

    } catch (error) {
        console.error('Lỗi khi lấy dữ liệu từ API:', error);
    }
}

// =========================================================================
// HÀM CHỨC NĂNG 2: Duyệt mảng đổ dữ liệu vào bảng HTML
// =========================================================================
function renderTable(data) {
    const tableBody = document.getElementById('data-table-body1');
    tableBody.innerHTML = ''; // Reset bảng cũ

    if (!Array.isArray(data)) return;

    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.id}</td>
            <td>${row.station_id}</td>
            <td>${row.ts}</td>
            <td><strong>${row.parameter.toUpperCase()}</strong></td>
            <td>${row.value}</td>
        `;
        tableBody.appendChild(tr);
    });
}

// =========================================================================
// HÀM CHỨC NĂNG 3: Xử lý dữ liệu và Điều khiển đồ họa thời gian thực
// =========================================================================
function updateCharts(data) {
    if (!Array.isArray(data) || data.length === 0) return;

    // -----------------------------------------------------------------
    // XỬ LÝ PHẦN A: TRÍCH XUẤT DỮ LIỆU ĐƯỜNG TUYẾN (LINE CHART - TDS)
    // -----------------------------------------------------------------
    const tdsData = data.filter(row => row.parameter === 'tds').reverse();
    const timelines = tdsData.map(row => row.ts && row.ts.includes(' ') ? row.ts.split(' ')[1] : row.ts);
    const values = tdsData.map(row => row.value);

    const ctxLine = document.getElementById('lineChart').getContext('2d');
    if (myLineChart) myLineChart.destroy();

    myLineChart = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: timelines,
            datasets: [{
                label: 'Chỉ số TDS (mg/L)',
                data: values,
                borderColor: '#007bff',
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                borderWidth: 2,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });

    // -----------------------------------------------------------------
    // XỬ LÝ PHẦN B: ĐIỀU KHIỂN HÌNH HỌC CHO ĐỒNG HỒ KIM QUÉT SVG (pH)
    // -----------------------------------------------------------------
    const currentPHRow = data.find(row => row.parameter === 'ph');
    const currentPH = currentPHRow ? currentPHRow.value : 7.0;
    const safePH = Math.max(0, Math.min(14, currentPH));

    setGauge(safePH);
}

// =========================================================================
// HÀM TIỆN ÍCH: Cập nhật toàn bộ trạng thái đồng hồ SVG theo giá trị pH
// =========================================================================
function setGauge(pH) {
    const safePH = Math.max(0, Math.min(14, pH));

    // 1. Cập nhật nhãn số
    const valueTextElement = document.getElementById('gauge-value');
    if (valueTextElement) {
        valueTextElement.textContent = safePH.toFixed(2);
    }

    // 2. Tính góc quay: pH=0 → deg = 135°(tổng cung 270°)    
    const degrees = 135 + (safePH / 14) * 270;

    // 3. Xoay kim — PHẢI dùng setAttribute với tọa độ pivot (150,175)
    //    KHÔNG dùng style.transform vì SVG không hỗ trợ transform-origin bằng pixel
    const needleElement = document.getElementById('gauge-needle');
    if (needleElement) {
        needleElement.setAttribute('transform', `rotate(${degrees}, 150, 175)`);
    }

    // 4. Co dãn cung xanh — PHẢI dùng setAttribute, KHÔNG dùng style.strokeDasharray
    const progressElement = document.getElementById('gauge-progress');
    if (progressElement) {
        const maxStroke = 471.23;
        const progressStroke = (safePH / 14) * maxStroke;
        progressElement.setAttribute('stroke-dasharray', `${progressStroke}, 628.31`);
    }
}

// =========================================================================
// KHỞI ĐỘNG VÀ ĐẶT LỊCH QUÉT TỰ ĐỘNG (REALTIME MONITORING)
// =========================================================================
document.addEventListener('DOMContentLoaded', fetchWaterData);
setInterval(fetchWaterData, 10000);


// =========================================================================
// NÚT TEST: Xoay kim ngẫu nhiên
// =========================================================================
function testGaugeWithRandomValue() {
    const randomPH = Math.random() * 14;
    console.log("Góc test ngẫu nhiên - pH =", randomPH.toFixed(2));
    setGauge(randomPH);
}

document.addEventListener('DOMContentLoaded', () => {
    const testBtn = document.getElementById('btn-test-gauge');
    if (testBtn) {
        testBtn.addEventListener('click', testGaugeWithRandomValue);
    }
});