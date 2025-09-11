// === Webhook-Konstanten ===
const MAKE_OPENAI_WEBHOOK_URL = "/api/evaluate";
const MAKE_FEEDBACK_WEBHOOK_URL = "/api/feedback";

// Cases Data (detailed)
const cases = {
    A: {
        title: "Fall A: Ein heißer Hund",
        facts: `Die elfjährige Marie (M), die älter aussieht, ist des täglichen Spazierengehens mit dem Familienhund Henry überdrüssig. Daher sagt M kurzentschlossen und eigenmächtig zu der ihr unbekannten Passantin Patricia (P):

„Für 300 € gehört Henry Dir.“

P antwortet:

„Gerne. Ich habe aber nur 200 € dabei; den Rest gebe ich Dir in einer Woche.”

M ist einverstanden, übergibt den Hund an P und nimmt von dieser einen 200-Euro-Schein entgegen. Später am Tag wird P klar, dass ein Vertrag mit M aufgrund deren Alters rechtlich problematisch sein könnte. Daher sucht sie die Eltern der M auf und bittet sie um deren „OK“. Die Eltern äußern sich nicht. Gleich am nächsten Tag ist P so genervt von dem ständigen Bellen des Henry, dass sie gegenüber M erklärt, dass „sie sich hiermit nun doch vom Vertrag zurückziehe und M den Hund wieder haben könne; außerdem könne sie den Kauf nicht gelten lassen, weil sie M für älter gehalten habe“.

Fallfrage 1
Kann M von P die Zahlung von weiteren 100 € verlangen?`,
        image: "img/Fall_A.png", // Add image path if available, e.g. "images/fallA.jpg"
        pointsSchema: { structure: 10, subsumption: 10, norms: 10, argumentation: 10 }
    },
    B: {
        title: "Fall B: Ein teurer Tropfen",
        facts: `Ms Eltern feiern mit Freunden im Restaurant des Raffaello (R). Um gebührend anstoßen zu können, möchte der Vater Valentin (V) einen „edlen Tropfen Champagner“ bestellen. Der bei R angestellte Kellner Kurt (K) zeigt V daraufhin eine Flasche und nennt einen Preis i.H.v. 1.300 € (objektiver Wert der Flasche: 1.000 €). Obwohl K einen ruhigen Moment abwartet und, an die Lautstärke angepasst, mit erhobener Stimme spricht, versteht V einen Preis von 300 €, da er von der Partylaune seiner Freunde abgelenkt ist. Begeistert nimmt V dem K die Flasche aus der Hand und öffnet sie fachmännisch mit einem Säbel. Kurz darauf stellt sich heraus, dass K eine veraltete Preisliste herangezogen hatte. K teilt V sogleich mit, dass der zunächst mitgeteilte Preis von 1.300 € falsch sei und daher nicht gelte. Tatsächlich liege der Preis bei 2.000 €. Daraufhin weigert sich V, angesichts des von ihm Gehörten mehr als 300 € zu zahlen; irgendeinen höheren Preis werde er keinesfalls entrichten.

Fallfrage:
Kann R von V die Bezahlung der Flasche Champagner verlangen, und wenn ja, in welcher Höhe?`,
        image: "img/Fall_B.png", // Add image path if available, e.g. "images/fallB.jpg"
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
    let factsText = document.getElementById('factsText');
    let caseImage = document.getElementById('caseImage');

    // Falls die Elemente noch nicht existieren, dynamisch anlegen (für Kompatibilität)
    if (!factsText) {
        factsText = document.createElement('div');
        factsText.id = 'factsText';
        factsBox.appendChild(factsText);
    }
    if (!caseImage) {
        caseImage = document.createElement('img');
        caseImage.id = 'caseImage';
        caseImage.style.maxWidth = "100%";
        caseImage.style.marginBottom = "15px";
        caseImage.style.borderRadius = "10px";
        factsBox.insertBefore(caseImage, factsText);
    }

    if (selectedCase && cases[selectedCase]) {
        factsBox.style.display = 'block';
        factsText.textContent = cases[selectedCase].facts;
        if (cases[selectedCase].image && cases[selectedCase].image !== "") {
            caseImage.src = cases[selectedCase].image;
            caseImage.style.display = 'block';
        } else {
            caseImage.style.display = 'none';
        }
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

    // Gesamtpunktzahl
    totalScore.textContent = `${result.totalScore} / 40`;
    progressFill.style.width = `${(result.totalScore / 40) * 100}%`;

    // Subscores
    subscoresDiv.innerHTML = '';
    if (result.subscores) {
        for (const [key, value] of Object.entries(result.subscores)) {
            const item = document.createElement('div');
            item.className = 'subscore-item';
            // Deutsche Labels für die Anzeige
            const labels = {
                structure: "Struktur",
                subsumption: "Subsumtion",
                norms: "Normenkenntnis",
                argumentation: "Argumentation"
            };
            item.innerHTML = `<div class="subscore-value">${value}</div>
                              <div class="subscore-label">${labels[key] || key}</div>`;
            subscoresDiv.appendChild(item);
        }
    }

    // Feedback/Summary
    feedbackSection.innerHTML = '';
    if (result.summary) {
        // Stärken
        if (result.summary.strengths) {
            const strengths = document.createElement('div');
            strengths.className = 'feedback-item';
            strengths.innerHTML = `<h4>Stärken</h4><div>${result.summary.strengths}</div>`;
            feedbackSection.appendChild(strengths);
        }
        // Schwächen
        if (result.summary.weaknesses) {
            const weaknesses = document.createElement('div');
            weaknesses.className = 'feedback-item';
            weaknesses.innerHTML = `<h4>Schwächen</h4><div>${result.summary.weaknesses}</div>`;
            feedbackSection.appendChild(weaknesses);
        }
        // Tipp
        if (result.summary.tip) {
            const tip = document.createElement('div');
            tip.className = 'feedback-item';
            tip.innerHTML = `<h4>Tipp</h4><div>${result.summary.tip}</div>`;
            feedbackSection.appendChild(tip);
        }
    }
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