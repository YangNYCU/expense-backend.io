function showDashboard() {
    // Hide all other sections
    document.getElementById("login-form").style.display = "none";
    document.getElementById("register-section").style.display = "none";
    document.getElementById("function-section").style.display = "none";
    document.getElementById("notation").style.display = "none";
    document.getElementById("purchase-sys").style.display = "none";
    document.getElementById("invoice-sys").style.display = "none";
    document.getElementById("approve-sys").style.display = "none";
    document.getElementById("dashboard-sys").style.display = "block";

    // Load dashboard data
    loadDashboardData();
}

function loadDashboardData() {
    fetch(`${apiUrl}/stats`, {
            headers: {
                
            }
        })
        .then(res => {
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    throw new Error('登入已過期，請重新登入');
                }
                throw new Error(`載入統計數據失敗 (${res.status})`);
            }
            return res.json();
        })
        .then(data => {
            // Update dashboard with fetched data
            document.getElementById("total-purchases").textContent = data.totalPurchases;
            document.getElementById("total-cost").textContent = `NT$${data.totalCost.toLocaleString()}`;
            document.getElementById("pending-approvals").textContent = data.pendingApprovals;
            document.getElementById("reimbursed-amount").textContent = `NT$${data.reimbursedAmount.toLocaleString()}`;
        })
        .catch(error => {
            console.error('載入統計數據失敗：', error);
            if (error.message.includes('登入已過期')) {
                alert('登入已過期，請重新登入');
                logout();
            } else {
                alert(`載入統計數據失敗：${error.message}`);
            }
        });
}