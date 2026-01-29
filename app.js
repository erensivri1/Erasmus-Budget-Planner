// 1. İlk Ayarları Kaydetme (Total Grant & End Date)
const TRY_RATE = 52.05; // 1 EUR = 52.05 TL
let myChart = null; // Global variable to store the chart instance
function saveInitialSettings() {
    const grant = document.getElementById('total-grant').value;
    const date = document.getElementById('end-date').value;

    if (grant && date) {
        localStorage.setItem('totalBudget', grant);
        localStorage.setItem('endDate', date);
        // Eğer ilk kez kuruluyorsa harcama listesini boş olarak oluştur
        if (!localStorage.getItem('expenses')) {
            localStorage.setItem('expenses', JSON.stringify([]));
        }
        renderApp();
        alert("Budget settings saved, Manager! 🚀");
    } else {
        alert("Please fill in both grant amount and end date.");
    }
}

// 2. Harcama Ekleme Fonksiyonu
function addExpense() {
    const amountInput = document.getElementById('expense-amount');
    const currencyInput = document.getElementById('expense-currency'); // HTML'deki yeni select
    const categoryInput = document.getElementById('expense-category');
    
    let amount = parseFloat(amountInput.value);
    if (!amount || amount <= 0) return;

    // TL seçiliyse Euro'ya çevir
    if (currencyInput.value === "TRY") {
        amount = amount / TRY_RATE;
    }

    const newExpense = {
        amount: amount, // Artık her zaman Euro cinsinden kaydedilir
        category: categoryInput.value,
        date: new Date().toLocaleDateString('en-GB')
    };

    const expenses = JSON.parse(localStorage.getItem('expenses')) || [];
    expenses.push(newExpense);
    localStorage.setItem('expenses', JSON.stringify(expenses));

    amountInput.value = '';
    document.getElementById('expense-amount').value = '';      // Miktarı temizle
    document.getElementById('expense-category').value = '';
    renderApp();
}

function renderApp() {
    // Add this line inside the renderApp function, at the very end
    
    const budget = parseFloat(localStorage.getItem('totalBudget'));
    const endDateStr = localStorage.getItem('endDate');
    
    if (!budget || !endDateStr) return;

    const endDate = new Date(endDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = endDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // 1. DEĞİŞİKLİK: Toplam harcama hesaplaması
    // Artık "current" bir sayı değil, bir obje. O yüzden "current.amount" diyoruz.
    const expenses = JSON.parse(localStorage.getItem('expenses')) || [];
    const totalSpent = expenses.reduce((sum, current) => sum + parseFloat(current.amount), 0);

    const remaining = budget - totalSpent;
    document.getElementById('total-remaining-eur').innerText = "€" + remaining.toFixed(2);
    document.getElementById('total-remaining-try').innerText = "(" + (remaining * TRY_RATE).toFixed(2) + " TL)";
    if (diffDays > 0) {
        const safeEur = (budget - totalSpent) / diffDays;
        const safeTry = safeEur * TRY_RATE; // TL karşılığını hesapla
    
        // Euro limitini yazdır
        document.getElementById('daily-limit-display').innerText = "€" + safeEur.toFixed(2);
        
        // TL limitini yazdır (HTML'e eklediğimiz yeni ID)
        document.getElementById('daily-limit-try').innerText = "(" + safeTry.toFixed(2) + " TL)";
    }

    // 2. DEĞİŞİKLİK: Liste oluşturma kısmı
    const listElement = document.getElementById('expense-list');
    listElement.innerHTML = '';

    expenses.slice().reverse().forEach((exp, revIndex) => {
        const originalIndex = expenses.length - 1 - revIndex;
        const amountTry = exp.amount * TRY_RATE; // Euro değerini TL'ye çeviriyoruz
        const li = document.createElement('li');
        li.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #eee; font-size: 0.9rem;";

        // Liste içeriğinde kategori ve tarihi de gösteriyoruz
        li.innerHTML = `
            <div>
                <span style="color: #888; font-size: 0.8rem;">${exp.date}</span><br>
                <strong>${exp.category}</strong>: €${exp.amount.toFixed(2)} <span style="color: #7f8c8d; font-size: 0.85rem;">(${amountTry.toFixed(2)} TL)</span>
            </div>
            <button onclick="deleteExpense(${originalIndex})" 
                style="background:#e74c3c; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:bold;">
                Delete
            </button>
        `;
        listElement.appendChild(li);
    });
    updateChart();
}

window.onload = () => {
    getLiveExchangeRate(); // Önce canlı kuru çek
    renderApp();           // Sonra uygulamayı başlat
};

function deleteExpense(index) {
    // Serious confirmation message for technical documentation standards
    if (confirm("Are you sure you want to delete this expense?")) {
        const expenses = JSON.parse(localStorage.getItem('expenses')) || [];
        
        // Remove the selected item from the array
        expenses.splice(index, 1);
        
        // Update LocalStorage and refresh the UI
        localStorage.setItem('expenses', JSON.stringify(expenses));
        renderApp();
    }
}
function updateChart() {
    const expenses = JSON.parse(localStorage.getItem('expenses')) || [];
    const ctx = document.getElementById('expenseChart').getContext('2d');

    // 1. Kategorilere göre harcamaları topla
    const totals = expenses.reduce((acc, current) => {
        acc[current.category] = (acc[current.category] || 0) + parseFloat(current.amount);
        return acc;
    }, {});

    const labels = Object.keys(totals);
    const dataValues = Object.values(totals);

    // 2. Eğer grafik zaten varsa, her seferinde yenisini oluşturmak yerine güncelle
    if (myChart) {
        myChart.destroy();
    }

    myChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: ['#2ecc71', '#3498db', '#9b59b6', '#f1c40f', '#e67e22', '#e74c3c'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' },
                title: { display: true, text: 'Spending by Category (€)' }
            }
        }
    });
}
function exportToCSV() {
    const expenses = JSON.parse(localStorage.getItem('expenses')) || [];
    const totalGrant = parseFloat(localStorage.getItem('totalBudget')) || 0;
    
    // 1. Hesaplamalar
    const totalSpent = expenses.reduce((sum, curr) => sum + parseFloat(curr.amount), 0);
    const remainingEur = totalGrant - totalSpent;
    const remainingTry = remainingEur * 52.05;

    // 2. Excel UTF-8 BOM ve Başlangıç
    let csvContent = "\ufeff"; 
    
    // 3. Dikey Özet Bölümü (Excel'de çok daha temiz durur)
    csvContent += "ERASMUS BUDGET REPORT\n";
    csvContent += `Report Date;${new Date().toLocaleDateString('en-GB')}\n\n`;
    
    csvContent += "FINANCIAL OVERVIEW\n";
    csvContent += `Initial Grant;€${totalGrant.toFixed(2)}\n`;
    csvContent += `Total Spent;€${totalSpent.toFixed(2)}\n`;
    csvContent += `REMAINING (EUR);€${remainingEur.toFixed(2)}\n`;
    csvContent += `REMAINING (TRY);${remainingTry.toFixed(2)} TL\n\n`;
    
    // 4. Harcama Tablosu
    csvContent += "DETAILED EXPENSE LOG\n";
    csvContent += "Date;Category;Amount (EUR);Amount (TRY)\n";

    expenses.forEach(exp => {
        const amountTRY = (exp.amount * 52.05).toFixed(2);
        csvContent += `${exp.date};${exp.category};${exp.amount.toFixed(2)};${amountTRY}\n`;
    });

    // 5. İndirme Mantığı
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Erasmus_Budget_2026.csv");
    link.click();
}

// Tüm verileri sıfırlayan fonksiyon
function resetApp() {
    if (confirm("Are you sure you want to delete ALL data? This cannot be undone.")) {
        localStorage.clear(); // Tarayıcı hafızasını temizler
        location.reload();    // Sayfayı yenileyip her şeyi sıfırdan başlatır
    }
}

async function getLiveExchangeRate() {
    try {
        // Ücretsiz bir API üzerinden güncel kurları çekiyoruz
        const response = await fetch('https://open.er-api.com/v6/latest/EUR');
        const data = await response.json();
        
        if (data && data.rates && data.rates.TRY) {
            TRY_RATE = data.rates.TRY; // API'den gelen canlı kuru değişkene ata
            console.log("Live Rate Updated: 1 EUR = " + TRY_RATE + " TRY");
            renderApp(); // Kur güncellenince ekranı tekrar çiz
        }
    } catch (error) {
        console.error("Döviz kuru çekilemedi, sabit kur kullanılıyor:", error);
    }
}