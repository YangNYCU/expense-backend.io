// **📌 註冊**
function register() {
    const username = document.getElementById("register-username").value;
    const password = document.getElementById("register-password").value;
    const role = document.getElementById("register-role").value;
    const email = document.getElementById("register-email").value;
    const bank = document.getElementById("register-bank").value;
    const bank_account = document.getElementById("register-bank-account").value;
    fetch(`${apiUrl}/auth/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            // 傳入 username、password 與 role 參數
            body: JSON.stringify({
                username,
                password,
                role,
                email,
                bank,
                bank_account
            })
        })
        .then(res => res.json())
        .then(data => alert(data.message));
}

// **📌 登入**
function login() {
    const usernameInput = document.getElementById("login-username");
    const passwordInput = document.getElementById("login-password");
    if (!usernameInput || !passwordInput) {
        alert("找不到登入表單元素，請聯絡管理員");
        return;
    }
    const username = usernameInput.value;
    const password = passwordInput.value;
    if (!username || !password) {
        alert("請輸入使用者名稱和密碼");
        return;
    }
    fetch(`${apiUrl}/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username,
                password
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.token) {
                localStorage.setItem("token", data.token);
                localStorage.setItem("role", data.role);
                localStorage.setItem("username", username);
                document.getElementById("login-form").style.display = "none";
                document.getElementById("register-section").style.display = "none";
                document.getElementById("function-section").style.display = "block";
                // 載入用戶資料
                loadUserInfo();
                // 根據用戶角色更新功能按鈕
                const approveButton = document.querySelector('button[onclick="approve()"]');
                if (data.role !== "finance") {
                    approveButton.style.display = "none";
                } else {
                    approveButton.style.display = "";
                }
                loadAndRenderData("purchase-list-purchase");
            } else {
                alert(data.message || "登入失敗");
            }
        })
        .catch(error => {
            console.error("登入錯誤:", error);
            alert("登入發生錯誤，請稍後再試");
        });
}

// **📌 登出**
function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    // 清空用戶資料顯示
    document.getElementById("info-username").textContent = '';
    document.getElementById("info-role").textContent = '';
    document.getElementById("info-email").textContent = '';
    document.getElementById("info-bank").textContent = '';
    document.getElementById("info-bank-account").textContent = '';
    location.reload();
}
// **📌 功能選擇**
function functionSelect() {
    const select = document.getElementById("function-list").value;
    const userRole = localStorage.getItem("role");
    const systems = {
        purchase: ["notation", "purchase-list-purchase"],
        invoice: ["invoice-sys", "purchase-list-invoice"],
        approve: ["approve-sys", "purchase-list-approve"]
    };
    // 隱藏所有系統
    ["notation", "purchase-sys", "invoice-sys", "approve-sys"].forEach(id => {
        document.getElementById(id).style.display = "none";
    });

    // 顯示選擇的系統
    if (select in systems) {
        // 檢查是否為財務人員才能訪問審核功能
        if (select === "approve" && userRole !== "finance") {
            alert("只有財務人員可以使用審核功能");
            return;
        }
        document.getElementById(systems[select][0]).style.display = "none";
        if (select !== "purchase") { // 採購系統需要先同意注意事項
            loadAndRenderData(systems[select][1]);
        }
    }
}