// === Webhook-Konstanten ===
const MAKE_OPENAI_WEBHOOK_URL = "/api/evaluate";
const MAKE_FEEDBACK_WEBHOOK_URL = "/api/feedback";

// Cases Data (example, extend as needed)
const cases = {
    A: {
        pointsSchema: { structure: 10, subsumption: 10, norms: 10, argumentation: 10 }
    },
    B: {
        pointsSchema: { structure: 10, subsumption: 10, norms: 10, argumentation: 10 }
    }
};

// Global variables
let lastEvaluation = null;
let feedbackData = null;

// Toast System
let toastCount = 0;
const maxToasts = 3;
function toast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toasts = container.children;
    if (toasts.length >= maxToasts) { container.removeChild(toasts[0]); toastCount--; }
    const toastEl = document.createElement('div');
    toastEl.className = `toast toast-${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    toastEl.innerHTML = `
        <span class="toast-icon">${icons[type] || ''}</span>
        <span class="toast-content">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove(); toastCount--;">×</button>`;
    container.appendChild(toastEl); toastCount++;
    setTimeout(() => { if (toastEl.parentElement) { toastEl.remove(); toastCount--; } }, 5000);
}

// Rate limiting
function canEvaluate() {
    const lastEval = localStorage.getItem('lastEvaluation');
    if (!lastEval) return true;
    const timeDiff = Date.now() - parseInt(lastEval);
    return timeDiff >= 60000; // 1 minute
}

// Case selection
document.getElementById('caseSelect').addEventListener('change', function () {
    const selectedCase = this.value;
    const factsBox = document.getElementById('factsBox');
    const factsText = document.getElementById('factsText');
    const caseImage = document.getElementById('caseImage');

    if (selectedCase && cases[selectedCase]) {
        factsBox.style.display = 'block';
        // Example: Set facts and image
        factsText.textContent = selectedCase === "A"
            ? "Sachverhalt zu Fall A: Ein heißer Hund ..."
            : "Sachverhalt zu Fall B: Ein teurer Tropfen ...";
        caseImage.style.display = 'none'; // Set to 'block' and src if you have images
    } else {
        factsBox.style.display = 'none';
        factsText.textContent = '';
        caseImage.style.display = 'none';
    }
});

// Text counter
document.getElementById('solutionText').addEventListener('input', function () {
    const text = this.value;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    document.getElementById('textCounter').textContent = `${words} Wörter, ${chars} Zeichen`;
});

// File upload
document.getElementById('fileInput').addEventListener('change', function () {
    const file = this.files[0]; if (!file) return;
    if (!file.name.endsWith('.txt')) { toast('Bitte wähle eine .txt Datei aus.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('solutionText').value = e.target.result;
        document.getElementById('solutionText').dispatchEvent(new Event('input'));
        toast('Datei erfolgreich geladen.', 'success');
    };
    reader.readAsText(file);
});

function resetSolution() {
    document.getElementById('solutionText').value = '';
    document.getElementById('solutionText').dispatchEvent(new Event('input'));
    document.getElementById('fileInput').value = '';
    toast('Lösung zurückgesetzt.', 'info');
}

async function evaluateSolution() {
    const caseId = document.getElementById('caseSelect').value;
    const solutionText = document.getElementById('solutionText').value.trim();

    if (!caseId) { toast('Bitte wähle einen Fall aus.', 'error'); return; }
    if (!solutionText) { toast('Bitte gib eine Lösung ein.', 'error'); return; }
    if (!canEvaluate()) { toast('Bitte warte eine Minute zwischen den Bewertungen.', 'error'); return; }

    const btn = document.getElementById('evaluateBtn');
    const text = document.getElementById('evaluateText');
    const spinner = document.getElementById('evaluateSpinner');
    btn.disabled = true; text.textContent = 'Wird bewertet...'; spinner.style.display = 'block';

    try {
        const payload = { caseId, solution: solutionText };
        const { ok, status, data } = await postJson(MAKE_OPENAI_WEBHOOK_URL, payload);

        if (!ok) {
            toast('Fehler bei der Bewertung. Bitte erneut versuchen.', 'error');
            return;
        }

        if (!data || !data.subscores || !data.summary || typeof data.totalScore === 'undefined') {
            toast('Ungültige Antwort vom Server.', 'error');
            return;
        }

        localStorage.setItem('lastEvaluation', Date.now().toString());
        lastEvaluation = data;
        displayResult(data, caseId);
        toast('Bewertung erfolgreich!', 'success');
        setTimeout(openFeedbackOverlay, 2000);

    } catch (err) {
        toast('Netzwerkfehler. Bitte später erneut versuchen.', 'error');
    } finally {
        btn.disabled = false; text.textContent = '📊 Bewerten'; spinner.style.display = 'none';
    }
}

function displayResult(result, caseId) {
    const resultCard = document.getElementById('resultCard');
    const totalScore = document.getElementById('totalScore');
    const progressFill = document.getElementById('progressFill');
    const subscoresDiv = document.getElementById('subscores');
    const feedbackSection = document.getElementById('feedbackSection');

    resultCard.style.display = 'block';
    totalScore.textContent = `${result.totalScore} / 40`;
    progressFill.style.width = `${(result.totalScore / 40) * 100}%`;

    // Subscores
    subscoresDiv.innerHTML = '';
    for (const [key, value] of Object.entries(result.subscores)) {
        const item = document.createElement('div');
        item.className = 'subscore-item';
        item.innerHTML = `<div class="subscore-value">${value}</div>
                          <div class="subscore-label">${key}</div>`;
        subscoresDiv.appendChild(item);
    }

    // Feedback
    feedbackSection.innerHTML = '';
    if (result.summary) {
        const item = document.createElement('div');
        item.className = 'feedback-item';
        item.innerHTML = `<h4>Zusammenfassung</h4><div>${result.summary}</div>`;
        feedbackSection.appendChild(item);
    }
    // Add more feedback items as needed
}

// Feedback overlay functions
function openFeedbackOverlay() {
    document.getElementById('feedbackOverlay').style.display = 'flex';
}
function closeFeedbackOverlay() {
    document.getElementById('feedbackOverlay').style.display = 'none';
    resetFeedbackForm();
}
function resetFeedbackForm() {
    document.querySelectorAll('.rating-btn.active').forEach(btn => btn.classList.remove('active'));
    document.getElementById('feedbackComment').value = '';
}
function selectHelpful(helpful) {
    document.querySelectorAll('.rating-btn[data-helpful]').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.rating-btn[data-helpful="${helpful}"]`).classList.add('active');
    feedbackData = feedbackData || {};
    feedbackData.helpful = helpful;
}
function selectLikelihood(likelihood) {
    document.querySelectorAll('.rating-btn[data-likelihood]').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.rating-btn[data-likelihood="${likelihood}"]`).classList.add('active');
    feedbackData = feedbackData || {};
    feedbackData.likelihood = likelihood;
}

async function submitFeedback(event) {
    event.preventDefault();
    const helpful = document.querySelector('.rating-btn[data-helpful].active');
    const likelihood = document.querySelector('.rating-btn[data-likelihood].active');
    const comment = document.getElementById('feedbackComment').value.trim();

    if (!helpful || !likelihood) {
        toast('Bitte alle Pflichtfelder ausfüllen.', 'error');
        return;
    }

    const btn = event.target.querySelector('button[type="submit"]');
    const text = document.getElementById('feedbackSubmitText');
    const spinner = document.getElementById('feedbackSpinner');
    btn.disabled = true; text.textContent = 'Wird gesendet...'; spinner.style.display = 'block';

    try {
        const payload = {
            helpful: helpful.getAttribute('data-helpful'),
            likelihood: likelihood.getAttribute('data-likelihood'),
            comment
        };
        const { ok } = await postJson(MAKE_FEEDBACK_WEBHOOK_URL, payload);
        if (ok) {
            toast('Feedback gesendet. Danke!', 'success');
            closeFeedbackOverlay();
        } else {
            toast('Feedback konnte nicht gesendet werden.', 'error');
        }
    } catch (err) {
        toast('Netzwerkfehler beim Feedback.', 'error');
    } finally {
        btn.disabled = false; text.textContent = 'Feedback senden'; spinner.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', function () {
    // Optionally, initialize UI state here
    document.getElementById('solutionText').dispatchEvent(new Event('input'));
});

// Helper for POST requests
async function postJson(url, payload) {
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
    } catch (e) {
        return { ok: false, status: 0, data: null };
    }
}