function parseCurrency(val) {
    if (val === undefined || val === null) return 0;
    const cleaned = String(val).replace(/[^0-9.-]/g, '');
    if (cleaned === '' || cleaned === '-' || cleaned === '.') return 0;
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

function formatInputCurrency(val) {
    const num = parseFloat(val);
    if (isNaN(num)) return '';
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatInputPercent(val) {
    const num = parseFloat(val);
    if (isNaN(num)) return '';
    if (Math.abs(num - Math.round(num)) < 0.0001) {
        return num.toFixed(0) + '%';
    }
    let s = num.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    return s + '%';
}

function setupCurrencyInput(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('focus', function () {
        const num = parseCurrency(el.value);
        if (num === 0 && el.value.trim() === '') {
            el.value = '';
            return;
        }
        el.value = num === 0 && !el.value.trim().match(/-?[0-9]/) ? '' : String(num);
    });
    el.addEventListener('blur', function () {
        const num = parseCurrency(el.value);
        if (num === 0 && el.value.trim() === '') {
            el.value = '';
            return;
        }
        el.value = formatInputCurrency(num);
    });
}

function setupPercentInput(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('focus', function () {
        const num = parseCurrency(el.value);
        if (isNaN(num) && el.value.trim() === '') {
            el.value = '';
            return;
        }
        el.value = String(num === 0 && !el.value.trim().match(/[0-9]/) ? '' : num);
    });
    el.addEventListener('blur', function () {
        const num = parseCurrency(el.value);
        if (el.value.trim() === '' || isNaN(num)) {
            el.value = '';
            return;
        }
        el.value = formatInputPercent(num);
    });
}

const errorEl = document.getElementById('formError') || (function () {
    const el = document.createElement('div');
    el.id = 'formError';
    el.className = 'form-error';
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'assertive');
    el.hidden = true;
    form.insertAdjacentElement('afterend', el);
    return el;
})();

function showError(message, reveal) {
    errorEl.textContent = message;
    errorEl.hidden = false;
    if (reveal) revealIntoView(errorEl);
}

function clearError() {
    errorEl.textContent = '';
    errorEl.hidden = true;
}

function revealIntoView(el) {
    const rect = el.getBoundingClientRect();
    const fullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (!fullyVisible) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

let hasCalculated = false;
let recalcTimer = null;

const form = document.getElementById('compoundForm');
const inputIds = ['savingAmount', 'apr', 'term'];

setupCurrencyInput('savingAmount');
setupPercentInput('apr');

form.addEventListener('submit', function (e) {
    e.preventDefault();
    hasCalculated = true;

    const savingField = document.getElementById('savingAmount');
    const aprField = document.getElementById('apr');

    if (savingField.value.trim() === '') {
        showError('Enter a saving amount.', true);
        savingField.focus();
        return;
    }

    if (aprField.value.trim() === '') {
        showError('Enter an interest rate (APR).', true);
        aprField.focus();
        return;
    }

    calculate(true);
});

['savingAmount', 'apr'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', clearError);
});

document.getElementById('term').addEventListener('change', clearError);

document.getElementById('printBtn').addEventListener('click', function () {
    if (!hasCalculated) {
        calculate();
    }

    const originalTitle = document.title;
    document.title = buildFileName();
    window.print();
    document.title = originalTitle;
});

function buildFileName() {
    const savingAmount = parseFloat(document.getElementById('savingAmount').value) || 0;
    const apr = parseFloat(document.getElementById('apr').value) || 0;
    const termYears = parseInt(document.getElementById('term').value) || 0;
    const now = new Date();

    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const yyyy = now.getFullYear();
    let hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const ampm = hh >= 12 ? 'PM' : 'AM';
    hh = String(hh % 12 || 12).padStart(2, '0');

    return `CompoundInterest-${savingAmount}-${apr}-${termYears}-${mm}${dd}${yyyy}-${hh}${mi}${ampm}`;
}

inputIds.forEach(function (id) {
    const el = document.getElementById(id);
    el.addEventListener('input', function () {
        if (!hasCalculated) return;
        clearTimeout(recalcTimer);
        recalcTimer = setTimeout(calculate, 150);
    });
    el.addEventListener('change', function () {
        if (!hasCalculated) return;
        clearTimeout(recalcTimer);
        recalcTimer = setTimeout(calculate, 150);
    });
});

function calculate(reveal) {
    const savingAmount = parseCurrency(document.getElementById('savingAmount').value) || 0;
    const apr = parseCurrency(document.getElementById('apr').value) || 0;
    const termYears = parseInt(document.getElementById('term').value) || 0;

    if (savingAmount <= 0 || termYears <= 0) {
        showError(savingAmount <= 0
            ? 'Enter a saving amount greater than 0.'
            : 'Choose a term.', reveal);
        return;
    }

    clearError();

    const monthlyRate = (apr / 100) / 12;
    const totalMonths = termYears * 12;

    let balance = 0;
    let schedule = [];
    for (let m = 1; m <= totalMonths; m++) {
        const startBalance = balance;
        const interest = balance * monthlyRate;
        balance = balance + interest + savingAmount;
        schedule.push({
            month: m,
            startBalance: startBalance,
            contribution: savingAmount,
            interest: interest,
            endBalance: balance
        });
    }

    const totalContributions = savingAmount * totalMonths;
    const futureValue = balance;
    const totalInterest = futureValue - totalContributions;

    const summaryDiv = document.getElementById('summary');
    summaryDiv.innerHTML = `
        <h2>Summary</h2>
        <p>Saving Amount: <span class="amount">$${formatCurrency(savingAmount)}/month</span></p>
        <p>Compound APR: <span class="amount">${apr}%</span></p>
        <p>Term: <span class="amount">${termYears} Years (${totalMonths} Months)</span></p>
        <p>Monthly Rate: <span class="amount">${(monthlyRate * 100).toFixed(4)}%</span></p>
        <p>Total Contributions: <span class="amount">$${formatCurrency(totalContributions)}</span></p>
        <p>Total Interest Earned: <span class="amount">$${formatCurrency(totalInterest)}</span></p>
        <p><strong>Future Value: <span class="amount">$${formatCurrency(futureValue)}</span></strong></p>
    `;
    summaryDiv.classList.remove('hidden');
    if (reveal) revealIntoView(summaryDiv);

    const scheduleDiv = document.getElementById('schedule');
    let tableHtml = `
        <h2>Monthly Growth Schedule</h2>
        <table>
            <thead>
                <tr>
                    <th>Month</th>
                    <th>Starting Balance</th>
                    <th>Contribution</th>
                    <th>Interest Earned</th>
                    <th>Ending Balance</th>
                </tr>
            </thead>
            <tbody>
    `;

    schedule.forEach(row => {
        tableHtml += `
            <tr>
                <td>${row.month}</td>
                <td>$${formatCurrency(row.startBalance)}</td>
                <td>$${formatCurrency(row.contribution)}</td>
                <td>$${formatCurrency(row.interest)}</td>
                <td>$${formatCurrency(row.endBalance)}</td>
            </tr>
        `;
    });

    tableHtml += `</tbody></table>`;
    scheduleDiv.innerHTML = tableHtml;
    scheduleDiv.classList.remove('hidden');
}

function formatCurrency(amount) {
    if (isNaN(amount) || amount === null) return '0.00';
    return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
