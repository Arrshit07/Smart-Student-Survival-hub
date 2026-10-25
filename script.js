const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const readStore = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
};
const saveStore = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const localDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const todayKey = localDateKey(new Date());
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Five hash-routed views keep each main topic on its own page.
const pageSections = {
    dashboard: ['home', 'dashboard', 'coding', 'helpful'],
    attendance: ['attendance'],
    timetable: ['timetable'],
    quiz: ['quiz'],
    promises: ['promises']
};
function showPage() {
    const requested = location.hash.slice(1);
    const page = Object.hasOwn(pageSections, requested) ? requested : 'dashboard';
    for (const section of document.querySelectorAll('main > section')) {
        section.hidden = !pageSections[page].includes(section.id);
    }
    document.querySelectorAll('[data-page-link]').forEach((link) => {
        const active = link.dataset.pageLink === page;
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    });
}
window.addEventListener('hashchange', showPage);
showPage();

// Theme
const darkModeBtn = $('#darkModeBtn');
if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');
function renderThemeButton() { darkModeBtn.textContent = document.body.classList.contains('dark') ? '☀️ Light mode' : '🌙 Dark mode'; }
renderThemeButton();
darkModeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    renderThemeButton();
});

// Dashboard and attendance
$('#todayLabel').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
let attendance = readStore('studyflow-attendance', { date: todayKey, count: 0 });
if (attendance.date !== todayKey) attendance = { date: todayKey, count: 0 };
let tasks = readStore('studyflow-tasks', []);
let schedule = readStore('studyflow-schedule', []);
const quizBest = Number(localStorage.getItem('studyflow-quiz-best') || 0);

function updateAttendance() {
    $('#attendanceCount').textContent = attendance.count;
    $('#attendanceStat').textContent = `${attendance.count} ${attendance.count === 1 ? 'class' : 'classes'}`;
    saveStore('studyflow-attendance', attendance);
}
updateAttendance();
$('#attendBtn').addEventListener('click', () => { attendance.count += 1; updateAttendance(); $('#attendanceMessage').textContent = 'Nice work showing up today!'; });
$('#undoAttendanceBtn').addEventListener('click', () => { attendance.count = Math.max(0, attendance.count - 1); updateAttendance(); $('#attendanceMessage').textContent = attendance.count ? 'Last check-in removed.' : 'Your count is back to zero.'; });
$('#resetAttendanceBtn').addEventListener('click', () => { attendance.count = 0; updateAttendance(); $('#attendanceMessage').textContent = 'Today’s count has been reset.'; });

// Timetable and in-page reminders
function renderSchedule() {
    const list = $('#scheduleList'); list.replaceChildren();
    $('#emptySchedule').hidden = schedule.length > 0;
    [...schedule].sort((a, b) => Number(a.day) - Number(b.day) || a.time.localeCompare(b.time)).forEach((item) => {
        const row = document.createElement('tr');
        for (const value of [dayNames[item.day], item.time, item.subject]) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
        const reminderCell = document.createElement('td'); reminderCell.innerHTML = '<span class="reminder-on">● On while page is open</span>'; row.append(reminderCell);
        const actionCell = document.createElement('td'); const remove = document.createElement('button'); remove.className = 'small-button secondary'; remove.type = 'button'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove ${item.subject}`);
        remove.addEventListener('click', () => { schedule = schedule.filter((entry) => entry.id !== item.id); saveStore('studyflow-schedule', schedule); renderSchedule(); }); actionCell.append(remove); row.append(actionCell); list.append(row);
    });
    $('#subjectCount').textContent = new Set(schedule.map((item) => item.subject.trim().toLowerCase())).size;
}
renderSchedule();
$('#scheduleForm').addEventListener('submit', (event) => {
    event.preventDefault(); const subject = $('#scheduleSubject').value.trim(); const day = Number($('#scheduleDay').value); const time = $('#scheduleTime').value;
    if (!subject || !time) return;
    schedule.push({ id: `${Date.now()}-${Math.random()}`, subject, day, time, lastAlert: '' });
    saveStore('studyflow-schedule', schedule); renderSchedule(); event.target.reset(); $('#scheduleDay').value = String(day);
});
function checkScheduleReminders() {
    const now = new Date(); const minute = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    schedule.forEach((item) => {
        const stamp = `${localDateKey(now)}-${minute}`;
        if (Number(item.day) === now.getDay() && item.time === minute && item.lastAlert !== stamp) {
            item.lastAlert = stamp; saveStore('studyflow-schedule', schedule);
            $('#attendanceMessage').textContent = `⏰ ${item.subject} starts now.`;
            if ('Notification' in window && Notification.permission === 'granted') new Notification(`StudyFlow reminder: ${item.subject}`, { body: 'Your class is starting now.' });
        }
    });
}
window.setInterval(checkScheduleReminders, 15000);

// Java / HTML quiz
const questions = [
    { topic: 'Java', question: 'What is the size of a Java int?', options: ['2 bytes', '4 bytes', '8 bytes', 'It depends on the computer'], answer: 1, explain: 'A Java int is always 32 bits (4 bytes).' },
    { topic: 'HTML', question: 'Which element creates a link to another page?', options: ['<link>', '<a>', '<href>', '<url>'], answer: 1, explain: 'The anchor element <a> creates a hyperlink.' },
    { topic: 'Java', question: 'Which keyword creates a new object in Java?', options: ['make', 'class', 'new', 'this'], answer: 2, explain: 'Use new to construct an object, such as new ArrayList<>().' },
    { topic: 'HTML', question: 'Which element is the main heading of a page?', options: ['<head>', '<h1>', '<title>', '<header1>'], answer: 1, explain: '<h1> is the top-level heading visible in the page content.' },
    { topic: 'Java', question: 'Which method is the usual Java program entry point?', options: ['start()', 'main()', 'run()', 'init()'], answer: 1, explain: 'Java applications commonly begin at public static void main(String[] args).' }
];
let questionIndex = 0; let score = 0; let answered = false;
$('#quizBest').textContent = quizBest ? `${quizBest}/${questions.length}` : '—';
function renderQuestion() {
    const item = questions[questionIndex]; answered = false;
    $('#quizProgress').textContent = `Question ${questionIndex + 1} of ${questions.length}`;
    $('#quizTopic').textContent = item.topic; $('#question').textContent = item.question;
    $('#quizScoreLabel').textContent = `Score: ${score}`; $('#quizResult').textContent = ''; $('#nextQuestion').hidden = true;
    const options = $('#options'); options.replaceChildren();
    item.options.forEach((option, index) => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'answer-option'; button.textContent = option;
        button.addEventListener('click', () => chooseAnswer(index, button)); options.append(button);
    });
}
function chooseAnswer(index, button) {
    if (answered) return; answered = true; const item = questions[questionIndex];
    $$('.answer-option').forEach((option) => { option.disabled = true; });
    if (index === item.answer) { score += 1; button.classList.add('correct'); $('#quizResult').textContent = `✅ Correct! ${item.explain}`; }
    else { button.classList.add('incorrect'); $$('.answer-option')[item.answer].classList.add('correct'); $('#quizResult').textContent = `Not quite. ${item.explain}`; }
    $('#quizScoreLabel').textContent = `Score: ${score}`; $('#nextQuestion').textContent = questionIndex === questions.length - 1 ? 'See my result' : 'Next question →'; $('#nextQuestion').hidden = false;
}
$('#nextQuestion').addEventListener('click', () => {
    if (questionIndex < questions.length - 1) { questionIndex += 1; renderQuestion(); return; }
    const best = Math.max(Number(localStorage.getItem('studyflow-quiz-best') || 0), score); localStorage.setItem('studyflow-quiz-best', String(best)); $('#quizBest').textContent = `${best}/${questions.length}`;
    $('#question').textContent = `You scored ${score} out of ${questions.length}!`;
    $('#options').replaceChildren(); $('#quizResult').textContent = score === questions.length ? 'Perfect round. Great work!' : 'A quick review of the explanations can help the ideas stick.';
    $('#quizProgress').textContent = 'Round complete'; $('#nextQuestion').textContent = 'Try again';
    $('#nextQuestion').onclick = () => { questionIndex = 0; score = 0; $('#nextQuestion').onclick = null; renderQuestion(); };
});
renderQuestion();

// Promise lesson demo: resolve a simulated asynchronous result.
$('#promiseDemoBtn').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const output = $('#promiseDemoOutput');
    button.disabled = true;
    output.textContent = 'Loading a tip…';
    const tip = await new Promise((resolve) => {
        window.setTimeout(() => resolve('Try explaining one idea from today in your own words.'), 800);
    });
    output.textContent = tip;
    button.disabled = false;
});

// Snippet library
const snippets = {
    java: `public class Main {\n    public static void main(String[] args) {\n        int[] scores = {72, 88, 91};\n        int total = 0;\n\n        for (int score : scores) {\n            total += score;\n        }\n\n        System.out.println("Average: " + total / scores.length);\n    }\n}`,
    html: `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>My study page</title>\n</head>\n<body>\n  <h1>My study notes</h1>\n  <p>One idea I learned today...</p>\n</body>\n</html>`
};
let activeSnippet = 'java'; $('#snippetCode').textContent = snippets[activeSnippet];
$$('.snippet-tab').forEach((tab) => tab.addEventListener('click', () => {
    activeSnippet = tab.dataset.snippet; $('#snippetCode').textContent = snippets[activeSnippet];
    $$('.snippet-tab').forEach((other) => { const active = other === tab; other.classList.toggle('active', active); other.setAttribute('aria-selected', String(active)); });
    $('#copyMessage').textContent = '';
}));
$('#copySnippet').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(snippets[activeSnippet]); $('#copyMessage').textContent = 'Snippet copied.'; }
    catch { $('#copyMessage').textContent = 'Clipboard access is unavailable. Select the snippet and copy it manually.'; }
});

// Beginner-friendly static checks (no code execution)
$('#checkCodeBtn').addEventListener('click', () => {
    const code = $('#codeInput').value.trim(); const output = $('#codeOutput');
    if (!code) { output.textContent = 'Add your Java attempt first, then check it here.'; return; }
    const checks = [
        [code.includes('[') && code.includes(']'), 'Include an array or array parameter.'],
        [/for\s*\(|for\s*\w/.test(code), 'Loop through the array so you can compare each value.'],
        [/if\s*\(/.test(code), 'Use an if condition to keep track of the largest value.'],
        [/return\s+\w+\s*;/.test(code), 'Return the largest value from your method.']
    ];
    const missing = checks.filter(([passed]) => !passed).map(([, hint]) => hint);
    output.textContent = missing.length ? `Practice hints:\n${missing.map((hint) => `• ${hint}`).join('\n')}\n\nThese are text checks only; your Java has not been compiled or run.` : 'Nice structure! The snippet includes the main pieces to look for. This is a basic text check only; compile and run your Java in a JDK environment to verify the result.';
});
$('#clearCodeBtn').addEventListener('click', () => { $('#codeInput').value = ''; $('#codeOutput').textContent = 'Your code will be checked for a few common basics. It will not be compiled or executed in the browser.'; });

// Focus timer
let secondsLeft = 25 * 60; let timerInterval = null;
function renderTimer() { $('#timerDisplay').textContent = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`; }
$('#timerStart').addEventListener('click', () => {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; $('#timerStart').textContent = 'Resume focus'; $('#timerMessage').textContent = 'Timer paused.'; return; }
    $('#timerStart').textContent = 'Pause'; $('#timerMessage').textContent = 'One thing at a time. You’re doing fine.';
    timerInterval = window.setInterval(() => { secondsLeft -= 1; renderTimer(); if (secondsLeft <= 0) { clearInterval(timerInterval); timerInterval = null; $('#timerStart').textContent = 'Start again'; $('#timerMessage').textContent = 'Focus session complete. Take a short break!'; } }, 1000);
});
$('#timerReset').addEventListener('click', () => { clearInterval(timerInterval); timerInterval = null; secondsLeft = 25 * 60; renderTimer(); $('#timerStart').textContent = 'Start focus'; $('#timerMessage').textContent = ''; });

// Study tasks
function renderTasks() {
    const list = $('#taskList'); list.replaceChildren(); let completed = 0;
    tasks.forEach((task) => {
        if (task.done) completed += 1;
        const item = document.createElement('li'); const label = document.createElement('label'); label.className = task.done ? 'task-done' : '';
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = task.done;
        checkbox.addEventListener('change', () => { task.done = checkbox.checked; saveStore('studyflow-tasks', tasks); renderTasks(); });
        const text = document.createElement('span'); text.textContent = task.text; label.append(checkbox, text);
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-task'; remove.textContent = '×'; remove.setAttribute('aria-label', `Remove ${task.text}`);
        remove.addEventListener('click', () => { tasks = tasks.filter((entry) => entry.id !== task.id); saveStore('studyflow-tasks', tasks); renderTasks(); }); item.append(label, remove); list.append(item);
    });
    $('#completedTasks').textContent = completed; $('#taskCount').textContent = `${completed} / ${tasks.length}`;
}
renderTasks();
$('#taskForm').addEventListener('submit', (event) => { event.preventDefault(); const text = $('#taskInput').value.trim(); if (!text) return; tasks.push({ id: `${Date.now()}-${Math.random()}`, text, done: false }); saveStore('studyflow-tasks', tasks); renderTasks(); event.target.reset(); });

const tips = ['Try explaining one idea from today in your own words. If it feels tricky, you’ve found a great topic to review.', 'Break a big assignment into a first 10-minute step. Starting small makes it easier to begin.', 'After a study session, write one question you still have. Bring it to class or ask a friend.', 'Test yourself from memory before rereading notes. Then check what you missed.', 'Put your phone out of reach for one short focus session and notice what changes.'];
$('#newTip').addEventListener('click', () => { const current = $('#studyTip').textContent; const options = tips.filter((tip) => tip !== current); $('#studyTip').textContent = options[Math.floor(Math.random() * options.length)]; });