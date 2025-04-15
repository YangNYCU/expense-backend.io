// 日期格式化函數
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = ("0" + (date.getMonth() + 1)).slice(-2);
    const day = ("0" + date.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
}

// 新增功能按鈕點擊處理函數
function purchase() {
    const userRole = localStorage.getItem("role");
    // 隱藏所有系統
    ["notation", "purchase-sys", "invoice-sys", "approve-sys"].forEach(id => {
        document.getElementById(id).style.display = "none";
    });
    // 顯示採購須知系統
    document.getElementById("notation").style.display = "block";
}

function invoice() {
    const userRole = localStorage.getItem("role");
    // 隱藏所有系統
    ["notation", "purchase-sys", "invoice-sys", "approve-sys"].forEach(id => {
        document.getElementById(id).style.display = "none";
    });

    // 顯示發票上傳系統並載入資料
    document.getElementById("invoice-sys").style.display = "block";
    loadAndRenderData("purchase-list-invoice");
}

function approve() {
    const userRole = localStorage.getItem("role");
    // 檢查是否為財務人員
    if (userRole !== "finance") {
        alert("只有財務人員可以使用審核功能");
        return;
    }
    // 隱藏所有系統
    ["notation", "purchase-sys", "invoice-sys", "approve-sys"].forEach(id => {
        document.getElementById(id).style.display = "none";
    });
    // 顯示審核系統並載入資料
    document.getElementById("approve-sys").style.display = "block";
    loadAndRenderData("purchase-list-approve");
    // 預設顯示採購審核頁籤
    showTab('purchase-approval');
}
// **📌 匯出採購資料**
function exportToExcel() {
    // 先取得採購資料
    fetch(`${apiUrl}/purchase`, {
            headers: {
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            }
        })
        .then(res => res.json())
        .then(data => {
            // 將 JSON 資料轉換為工作表
            const worksheet = XLSX.utils.json_to_sheet(data);
            // 建立新的工作簿
            const workbook = XLSX.utils.book_new();
            // 將工作表加入工作簿，工作表名稱為 "Purchases"
            XLSX.utils.book_append_sheet(workbook, worksheet, "Purchases");
            // 觸發下載，檔名為 "purchases.xlsx"
            XLSX.writeFile(workbook, "purchases.xlsx");
        });
}

// 修改點擊彈窗外區域關閉的事件處理
window.onclick = function(event) {
    const purchaseModal = document.getElementById("purchase-modal");
    const editModal = document.getElementById("edit-modal");
    const editProfileModal = document.getElementById("edit-profile-modal");

    if (event.target == purchaseModal) {
        purchaseModal.style.display = "none";
    }
    if (event.target == editModal) {
        editModal.style.display = "none";
    }
    if (event.target == editProfileModal) {
        editProfileModal.style.display = "none";
    }
}

// 新增全螢幕查看圖片的功能
function showFullImage(src) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        cursor: pointer;
    `;

    const img = document.createElement('img');
    img.src = src;
    img.style.cssText = `
        max-width: 90%;
        max-height: 90%;
        object-fit: contain;
    `;

    modal.appendChild(img);
    document.body.appendChild(modal);

    modal.onclick = () => {
        document.body.removeChild(modal);
    };
}

// 修改刪除照片的函數
function deleteInvoiceImage(serialNumber, filename, button) {
    if (!confirm('確定要刪除這張發票照片嗎？')) {
        return;
    }

    // 對檔案名稱進行編碼
    const encodedFilename = encodeURIComponent(filename);

    fetch(`${apiUrl}/invoice/delete/${serialNumber}/${encodedFilename}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        })
        .then(res => {
            if (!res.ok) {
                throw new Error(`刪除失敗: ${res.status}`);
            }
            return res.json();
        })
        .then(data => {
            // 找到並移除圖片容器
            const imageWrapper = button.closest('.image-wrapper');
            if (imageWrapper) {
                imageWrapper.remove();
            }
            alert('照片已成功刪除');

            // 重新載入資料以確保顯示正確
            loadAndRenderData("purchase-list-invoice");
        })
        .catch(error => {
            console.error('刪除照片失敗：', error);
            alert(`刪除照片失敗: ${error.message}`);
        });
}