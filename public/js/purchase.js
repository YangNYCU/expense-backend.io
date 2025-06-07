// 處理注意事項同意
function notationAcceptance() {
    if (document.getElementById("noted").checked) {
        document.getElementById("notation").style.display = "none";
        document.getElementById("purchase-sys").style.display = "block";
        loadAndRenderData("purchase-list-purchase");
    } else {
        alert("請勾選同意");
    }
}
// 開啟新增採購彈窗
function openPurchaseModal() {
    const modal = document.getElementById("purchase-modal");
    modal.style.display = "block";
}

// 關閉新增採購彈窗
function closePurchaseModal() {
    document.getElementById("purchase-modal").style.display = "none";
}

// 提交新採購申請
function submitPurchase() {
    // 表單驗證
    const team = document.getElementById("team").value;
    const purchase_desc = document.getElementById("purchase-desc").value;
    const system_type = document.getElementById("system-type").value;
    const use = document.getElementById("use").value;
    const amount = document.getElementById("amount").value;
    const total_cost = document.getElementById("total-cost").value;
    const purchase_import = document.getElementById("import").value;
    const purchase_note = document.getElementById("purchase-note").value;
    const username = localStorage.getItem('username');
    const purchaseData = {
        team,
        purchase_desc,
        system_type,
        use,
        amount,
        total_cost,
        purchase_import,
        purchase_note,
        username
    };

    console.log('提交的採購資料:', purchaseData); // 除錯用

    fetch(`${apiUrl}/purchase`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",

            },
            body: JSON.stringify(purchaseData)
        })
        .then(res => {
            if (!res.ok) {
                return res.text().then(text => {
                    throw new Error(text || '提交失敗');
                });
            }
            return res.json();
        })
        .then(data => {
            alert("採購申請已提交！");
            // 清空表單，重置到預設值
            document.getElementById("team").value = "車架";
            document.getElementById("purchase-desc").value = "";
            document.getElementById("system-type").value = ""; // 重置為空值
            document.getElementById("use").value = ""; // 重置為空值
            document.getElementById("amount").value = "";
            document.getElementById("total-cost").value = "";
            document.getElementById("import").value = "是";
            document.getElementById("purchase-note").value = "";

            closePurchaseModal();
            loadAndRenderData("purchase-list-purchase");
        })
        .catch(error => {
            alert(`提交失敗：${error.message}`);
            console.error("Error:", error);
        });
}

// 開啟修改彈窗
function openEditModal() {
    const modal = document.getElementById("edit-modal");
    const serialSelect = document.getElementById("edit-serial");

    // 清空現有選項
    serialSelect.innerHTML = '<option value="">請選擇申請編號</option>';

    // 獲取當前用戶的採購申請列表
    fetch(`${apiUrl}/purchase`, {
            headers: {

            }
        })
        .then(res => res.json())
        .then(data => {
            // 儲存資料到全域變數，供後續使用
            window.purchaseData = data;

            // 只顯示當前用戶且狀態為"待審核"的申請
            const userPurchases = data.filter(p =>
                p.username === localStorage.getItem("username") &&
                p.status === "待審核"
            );

            userPurchases.forEach(purchase => {
                const option = document.createElement("option");
                option.value = purchase.id;
                option.textContent = `${purchase.serial_number} - ${purchase.purchase_desc}`;
                serialSelect.appendChild(option);
            });
        });

    modal.style.display = "block";
}
// 載入採購清單
function loadPurchases() {
    loadAndRenderData("purchase-list-purchase");
}
// 當選擇申請編號時載入資料
document.getElementById("edit-serial").addEventListener("change", function() {
    const purchaseId = this.value;
    const editForm = document.getElementById("edit-form");

    if (!purchaseId) {
        editForm.style.display = "none";
        return;
    }
    // 從已儲存的資料中找出對應的申請
    const purchaseData = window.purchaseData.find(p => p.id === parseInt(purchaseId));
    if (purchaseData) {
        // 填充表單資料
        document.getElementById("edit-team").value = purchaseData.team;
        document.getElementById("edit-purchase-desc").value = purchaseData.purchase_desc;
        document.getElementById("edit-system-type").value = purchaseData.system_type;
        document.getElementById("edit-use").value = purchaseData.use;
        document.getElementById("edit-amount").value = purchaseData.amount;
        document.getElementById("edit-total-cost").value = purchaseData.total_cost;
        document.getElementById("edit-import").value = purchaseData.purchase_import;
        document.getElementById("edit-purchase-note").value = purchaseData.purchase_note || '';
        editForm.style.display = "block";
    }
});
// 提交修改
function submitEdit() {
    const purchaseId = document.getElementById("edit-serial").value;

    const updatedData = {
        id: purchaseId, // 添加 id
        team: document.getElementById("edit-team").value,
        purchase_desc: document.getElementById("edit-purchase-desc").value,
        system_type: document.getElementById("edit-system-type").value,
        use: document.getElementById("edit-use").value,
        amount: document.getElementById("edit-amount").value,
        total_cost: document.getElementById("edit-total-cost").value,
        purchase_import: document.getElementById("edit-import").value,
        purchase_note: document.getElementById("edit-purchase-note").value,
        status: "待審核" // 確保狀態保持不變
    };

    // 改用 POST 方法，並將資料放在請求體中
    fetch(`${apiUrl}/purchase/update`, {
            method: "POST", // 改用 POST 方法
            headers: {
                "Content-Type": "application/json",

            },
            body: JSON.stringify(updatedData)
        })
        .then(res => {
            if (!res.ok) {
                return res.text().then(text => {
                    throw new Error(text || '修改失敗');
                });
            }
            return res.json();
        })
        .then(data => {
            alert("修改成功！");
            closeEditModal();
            loadAndRenderData("purchase-list-purchase");
        })
        .catch(error => {
            alert(`修改失敗：${error.message}`);
            console.error("Error:", error);
        });
}

// 關閉修改彈窗
function closeEditModal() {
    document.getElementById("edit-modal").style.display = "none";
    document.getElementById("edit-form").style.display = "none";
}

// 刪除採購申請
function deletePurchase(id) {
    if (!confirm("確定要刪除這筆採購申請嗎？此操作不可恢復！")) {
        return;
    }

    fetch(`${apiUrl}/purchase/${id}`, {
            method: "DELETE",
            headers: {

            }
        })
        .then(res => {
            if (!res.ok) {
                return res.text().then(text => {
                    throw new Error(text || '刪除失敗');
                });
            }
            return res.json();
        })
        .then(data => {
            alert("採購申請已刪除！");
            loadAndRenderData("purchase-list-purchase");
        })
        .catch(error => {
            alert(`刪除失敗：${error.message}`);
            console.error("Error:", error);
        });
}