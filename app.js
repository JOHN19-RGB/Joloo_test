(function () {
  "use strict";

  const QUESTIONS = window.JOLOONII_QUESTIONS || [];
  const app = document.getElementById("app");
  const navLinks = document.querySelectorAll(".nav a");

  // questions grouped by card
  const BY_CARD = {};
  QUESTIONS.forEach((q) => {
    if (!BY_CARD[q.card]) BY_CARD[q.card] = [];
    BY_CARD[q.card].push(q);
  });
  Object.values(BY_CARD).forEach((arr) => arr.sort((a, b) => a.q - b.q));
  const CARD_NUMS = Object.keys(BY_CARD)
    .map(Number)
    .sort((a, b) => a - b);

  function setActiveNav(hash) {
    navLinks.forEach((a) => {
      const href = a.getAttribute("href").replace("#", "");
      const matchHome = href === "/" && (hash === "" || hash === "/" || hash.startsWith("/chapter/"));
      const matchSection =
        href !== "/" && hash.startsWith(href);
      a.classList.toggle(
        "active",
        matchHome || matchSection
      );
    });
  }

  // ---- Router ----
  function router() {
    const hash = location.hash.replace(/^#/, "") || "/";
    setActiveNav(hash);
    window.scrollTo(0, 0);

    if (hash === "/" || hash === "") return renderHome();
    if (hash === "/chapters") return renderChapters();

    let m = hash.match(/^\/chapter\/(\d+)$/);
    if (m) return renderChapter(parseInt(m[1], 10));

    if (hash === "/random") return renderRandomStart();
    if (hash === "/random/quiz") return renderRandomQuiz();
    if (hash === "/random/result") return renderRandomResult();

    return renderNotFound();
  }
  window.addEventListener("hashchange", router);

  // ---- HOME ----
  function renderHome() {
    app.innerHTML = `
      <div class="hero">
        <h1>Замын хөдөлгөөний дүрмийн тест</h1>
        <p>40 карт, ${QUESTIONS.length} асуулттай. Жолооны үнэмлэхний шалгалтад бэлдэх онлайн платформ.</p>
      </div>

      <div class="modes">
        <a class="mode-card" href="#/chapters">
          <div class="icon">1</div>
          <h3>Бүлгээр сурах</h3>
          <p>Карт тус бүрээр асуулт бүрийг дараалуулан хариулна. Алдсан бол шууд зөв хариу харагдана.</p>
        </a>

        <a class="mode-card" href="#/random">
          <div class="icon">2</div>
          <h3>Шалгалт өгөх</h3>
          <p>Бүх асуултаас санамсаргүй 20 асуулт сонгож 20 минутад шалгалт өгнө. Эцэст үр дүн харагдана.</p>
        </a>
      </div>
    `;
  }

  // ---- CHAPTERS LIST ----
  function renderChapters() {
    const tiles = CARD_NUMS.map(
      (n) => `
      <a class="chapter-tile" href="#/chapter/${n}">
        <span class="num">${pad2(n)}</span>
        <span class="label">${BY_CARD[n].length} асуулт</span>
      </a>`
    ).join("");

    app.innerHTML = `
      <div class="section-title">
        <h2>Картууд</h2>
        <span class="hint">Картыг сонгож суралцах</span>
      </div>
      <div class="chapter-grid">${tiles}</div>
    `;
  }

  // ---- CHAPTER QUIZ (mode 1) ----
  function renderChapter(cardNum) {
    const list = BY_CARD[cardNum];
    if (!list) return renderNotFound();

    let idx = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let answered = false;

    function draw() {
      const q = list[idx];
      const total = list.length;
      const pct = ((idx) / total) * 100;

      app.innerHTML = `
        <div class="quiz-header">
          <div>
            <div class="title">Карт #${pad2(cardNum)}</div>
            <div class="meta">Асуулт ${idx + 1} / ${total}</div>
          </div>
          <div class="meta">
            <span style="color:var(--success)">✓ ${correctCount}</span>
            &nbsp;·&nbsp;
            <span style="color:var(--danger)">✗ ${wrongCount}</span>
          </div>
        </div>

        <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>

        <div class="q-card">
          <div class="q-meta">Асуулт ${q.q}</div>
          <img class="q-image" src="${q.img}" alt="Асуулт ${q.q}" loading="eager" />
          <div class="choices" id="choices">
            ${[1, 2, 3, 4, 5]
              .map(
                (n) => `<button class="choice-btn" data-ans="${n}">${n}</button>`
              )
              .join("")}
          </div>
          <div class="feedback" id="feedback"></div>
        </div>

        <div class="actions">
          <a class="btn" href="#/chapters">← Картууд</a>
          <button class="btn primary" id="nextBtn" disabled>${
            idx === total - 1 ? "Дуусгах" : "Дараагийн"
          }</button>
        </div>
      `;

      const choicesEl = document.getElementById("choices");
      const feedbackEl = document.getElementById("feedback");
      const nextBtn = document.getElementById("nextBtn");

      choicesEl.querySelectorAll(".choice-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (answered) return;
          answered = true;
          const picked = parseInt(btn.dataset.ans, 10);
          const correct = picked === q.answer;

          choicesEl.querySelectorAll(".choice-btn").forEach((b) => {
            b.disabled = true;
            const a = parseInt(b.dataset.ans, 10);
            if (a === q.answer) b.classList.add("correct");
            else if (a === picked) b.classList.add("wrong");
          });

          feedbackEl.classList.add("show");
          if (correct) {
            correctCount++;
            feedbackEl.classList.add("right");
            feedbackEl.innerHTML = `
              <div class="fb-icon">✓</div>
              <div class="fb-body">
                <p class="fb-title">Зөв байна!</p>
                <p class="fb-sub">Зөв хариулт: <strong>#${q.answer}</strong></p>
              </div>
            `;
          } else {
            wrongCount++;
            feedbackEl.classList.add("wrong");
            feedbackEl.innerHTML = `
              <div class="fb-icon">✗</div>
              <div class="fb-body">
                <p class="fb-title">Буруу хариулт</p>
                <p class="fb-sub">Таны сонголт: <strong>#${picked}</strong> · Зөв хариулт: <strong>#${q.answer}</strong></p>
              </div>
            `;
          }

          nextBtn.disabled = false;
          nextBtn.focus();
        });
      });

      nextBtn.addEventListener("click", () => {
        if (idx === total - 1) {
          // Show finish summary inline
          renderChapterDone(cardNum, correctCount, wrongCount, total);
          return;
        }
        idx++;
        answered = false;
        draw();
      });
    }

    draw();
  }

  function renderChapterDone(cardNum, correct, wrong, total) {
    const pct = Math.round((correct / total) * 100);
    const passed = correct >= 18; // 18/20 ≈ official passing
    app.innerHTML = `
      <div class="result-card">
        <div class="muted">Карт #${pad2(cardNum)} дууслаа</div>
        <div class="result-score">
          <span class="${passed ? "pass" : "fail"}">${correct}</span>
          <span class="muted">/ ${total}</span>
        </div>
        <div class="result-pct">${pct}% зөв хариулсан</div>
        <div class="result-msg ${passed ? "pass" : "fail"}">
          ${
            passed
              ? "Сайн байна. Энэ картыг бараг бүрэн эзэмшсэн байна."
              : "Дахин үзэх хэрэгтэй. Алдсан асуултуудаа давтаарай."
          }
        </div>
        <div class="actions" style="justify-content:center;margin-top:24px">
          <a class="btn" href="#/chapter/${cardNum}">Дахин эхлэх</a>
          <a class="btn primary" href="#/chapters">Картууд руу буцах</a>
        </div>
      </div>
    `;
  }

  // ---- RANDOM (mode 2) ----
  // session state in memory
  let randomSession = null;

  function renderRandomStart() {
    app.innerHTML = `
      <div class="result-card">
        <h2 style="margin:0 0 8px">Шалгалт</h2>
        <p class="muted" style="margin:0">
          Бүх асуултаас санамсаргүйгээр 20 асуулт сонгогдоно.<br/>
          Хугацаа: 20 минут. Шалгалт дууссаны дараа үр дүн харагдана.
        </p>
        <div class="actions" style="justify-content:center;margin-top:24px">
          <a class="btn primary" href="#/random/quiz">Эхлэх</a>
        </div>
      </div>
    `;
  }

  function pickRandom20() {
    const pool = QUESTIONS.slice();
    // shuffle Fisher–Yates
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 20);
  }

  function renderRandomQuiz() {
    if (!randomSession) {
      randomSession = {
        questions: pickRandom20(),
        answers: {}, // idx -> picked
        idx: 0,
        startedAt: Date.now(),
        durationMs: 20 * 60 * 1000,
        finished: false,
      };
    }

    let session = randomSession;

    function draw() {
      if (session.finished) {
        location.hash = "#/random/result";
        return;
      }
      const q = session.questions[session.idx];
      const total = session.questions.length;
      const picked = session.answers[session.idx];

      app.innerHTML = `
        <div class="quiz-header">
          <div>
            <div class="title">Шалгалт</div>
            <div class="meta">Асуулт ${session.idx + 1} / ${total}</div>
          </div>
          <div class="timer" id="timer">--:--</div>
        </div>

        <div class="progress"><div class="progress-bar" style="width:${
          ((session.idx + 1) / total) * 100
        }%"></div></div>

        <div class="q-card">
          <div class="q-meta">Карт #${pad2(q.card)} · Асуулт ${q.q}</div>
          <img class="q-image" src="${q.img}" alt="Асуулт" loading="eager" />
          <div class="choices" id="choices">
            ${[1, 2, 3, 4, 5]
              .map(
                (n) =>
                  `<button class="choice-btn ${
                    picked === n ? "selected" : ""
                  }" data-ans="${n}" style="${
                    picked === n
                      ? "border-color:var(--primary);background:#eef4ff;color:var(--primary);"
                      : ""
                  }">${n}</button>`
              )
              .join("")}
          </div>
        </div>

        <div class="actions">
          <button class="btn" id="prevBtn" ${
            session.idx === 0 ? "disabled" : ""
          }>← Өмнөх</button>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            ${
              session.idx === total - 1
                ? `<button class="btn primary" id="finishBtn">Шалгалт дуусгах</button>`
                : `<button class="btn primary" id="nextBtn">Дараагийн →</button>`
            }
          </div>
        </div>

        <div class="cards-card-grid mt-24" id="qnav">
          ${session.questions
            .map((_, i) => {
              const ans = session.answers[i];
              const cur = i === session.idx;
              return `<button class="btn" data-jump="${i}" style="padding:8px 0;${
                cur
                  ? "background:var(--primary);color:#fff;border-color:var(--primary);"
                  : ans !== undefined
                  ? "background:#eef4ff;border-color:#bfd1ff;color:var(--primary);"
                  : ""
              }">${i + 1}</button>`;
            })
            .join("")}
        </div>
      `;

      // wire up
      document.querySelectorAll("#choices .choice-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          session.answers[session.idx] = parseInt(btn.dataset.ans, 10);
          draw();
        });
      });
      const prevBtn = document.getElementById("prevBtn");
      const nextBtn = document.getElementById("nextBtn");
      const finishBtn = document.getElementById("finishBtn");
      if (prevBtn)
        prevBtn.addEventListener("click", () => {
          if (session.idx > 0) {
            session.idx--;
            draw();
          }
        });
      if (nextBtn)
        nextBtn.addEventListener("click", () => {
          session.idx++;
          draw();
        });
      if (finishBtn)
        finishBtn.addEventListener("click", () => {
          if (
            confirm(
              "Шалгалтыг дуусгах уу? Үр дүн харагдана."
            )
          ) {
            session.finished = true;
            session.endedAt = Date.now();
            location.hash = "#/random/result";
          }
        });

      document.querySelectorAll("[data-jump]").forEach((b) => {
        b.addEventListener("click", () => {
          session.idx = parseInt(b.dataset.jump, 10);
          draw();
        });
      });

      updateTimer();
    }

    function updateTimer() {
      const timerEl = document.getElementById("timer");
      if (!timerEl) return;
      const elapsed = Date.now() - session.startedAt;
      const remaining = Math.max(0, session.durationMs - elapsed);
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      timerEl.textContent = `${pad2(mins)}:${pad2(secs)}`;
      if (remaining < 60 * 1000) timerEl.classList.add("danger");
      else if (remaining < 5 * 60 * 1000) timerEl.classList.add("warning");

      if (remaining <= 0) {
        session.finished = true;
        session.endedAt = Date.now();
        location.hash = "#/random/result";
        return;
      }
    }

    // tick timer
    if (session._tick) clearInterval(session._tick);
    session._tick = setInterval(updateTimer, 1000);

    draw();
  }

  function renderRandomResult() {
    const session = randomSession;
    if (!session || !session.finished) {
      app.innerHTML = `
        <div class="empty">
          Идэвхтэй шалгалт алга. <a href="#/random">Шалгалт эхлүүлэх</a>
        </div>
      `;
      return;
    }
    if (session._tick) {
      clearInterval(session._tick);
      session._tick = null;
    }

    const total = session.questions.length;
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    const cardStats = {};

    session.questions.forEach((q, i) => {
      const picked = session.answers[i];
      const isCorrect = picked === q.answer;
      if (picked === undefined) skipped++;
      else if (isCorrect) correct++;
      else wrong++;

      if (!cardStats[q.card]) cardStats[q.card] = { right: 0, wrong: 0, skipped: 0 };
      if (picked === undefined) cardStats[q.card].skipped++;
      else if (isCorrect) cardStats[q.card].right++;
      else cardStats[q.card].wrong++;
    });

    const pct = Math.round((correct / total) * 100);
    const passed = correct >= 18;

    const elapsed = (session.endedAt - session.startedAt) / 1000;
    const minsUsed = Math.floor(elapsed / 60);
    const secsUsed = Math.floor(elapsed % 60);

    const summaryGrid = session.questions
      .map((q, i) => {
        const picked = session.answers[i];
        let cls = "skipped";
        if (picked !== undefined) cls = picked === q.answer ? "right" : "wrong";
        return `<a href="#review-${i}" class="summary-item ${cls}" title="Карт ${q.card}, асуулт ${q.q}">${i + 1}</a>`;
      })
      .join("");

    const cardsBreakdown = Object.keys(cardStats)
      .map(Number)
      .sort((a, b) => a - b)
      .map((c) => {
        const s = cardStats[c];
        return `<div class="row">
          <span class="name">Карт #${pad2(c)}</span>
          <span class="stat">${s.right} зөв · ${s.wrong} буруу${
          s.skipped ? " · " + s.skipped + " орхисон" : ""
        }</span>
        </div>`;
      })
      .join("");

    const reviewItems = session.questions
      .map((q, i) => {
        const picked = session.answers[i];
        const isCorrect = picked === q.answer;
        const status =
          picked === undefined
            ? `<span class="muted">Хариулаагүй</span>`
            : isCorrect
            ? `<span style="color:var(--success);font-weight:600">✓ Зөв</span>`
            : `<span style="color:var(--danger);font-weight:600">✗ Буруу. Таны хариулт: ${picked}</span>`;
        return `
          <div class="q-card ${isCorrect ? "correct" : ""}" id="review-${i}">
            <div class="q-meta">
              ${i + 1}. Карт #${pad2(q.card)} · Асуулт ${q.q} — ${status}
              ${
                !isCorrect
                  ? ` · <span style="color:var(--success)">Зөв хариу: ${q.answer}</span>`
                  : ""
              }
            </div>
            <img class="q-image" src="${q.img}" alt="Асуулт" loading="lazy" />
          </div>
        `;
      })
      .join("");

    app.innerHTML = `
      <div class="result-card">
        <div class="muted">Шалгалт дууслаа</div>
        <div class="result-score">
          <span class="${passed ? "pass" : "fail"}">${correct}</span>
          <span class="muted">/ ${total}</span>
        </div>
        <div class="result-pct">${pct}% · хугацаа: ${pad2(minsUsed)}:${pad2(secsUsed)}</div>
        <div class="result-msg ${passed ? "pass" : "fail"}">
          ${
            passed
              ? "Баяр хүргэе. Та шалгалтыг тэнцэхүйц зөв хийсэн байна (≥18/20)."
              : "Тэнцээгүй байна. Жолооны шалгалтад тэнцэхэд 20-оос дор хаяж 18 нь зөв байх ёстой."
          }
        </div>

        <div class="cards-breakdown">
          <h3>Тойм</h3>
          <div class="row"><span class="name">Зөв</span><span class="stat" style="color:var(--success)">${correct}</span></div>
          <div class="row"><span class="name">Буруу</span><span class="stat" style="color:var(--danger)">${wrong}</span></div>
          ${
            skipped
              ? `<div class="row"><span class="name">Орхисон</span><span class="stat">${skipped}</span></div>`
              : ""
          }
        </div>

        <div class="cards-breakdown">
          <h3>Картаар</h3>
          ${cardsBreakdown}
        </div>

        <h3 style="margin-top:24px;text-align:left">Асуулт бүрийн дүн</h3>
        <div class="summary-grid">${summaryGrid}</div>

        <div class="actions" style="justify-content:center;margin-top:28px">
          <a class="btn" href="#/" id="homeBtn">Нүүр</a>
          <button class="btn primary" id="restart">Шинэ шалгалт</button>
        </div>
      </div>

      <h2 class="section-title" style="margin-top:32px">Бүх асуултын тойм</h2>
      <div class="review-list">${reviewItems}</div>
    `;

    document.getElementById("restart").addEventListener("click", () => {
      randomSession = null;
      location.hash = "#/random";
    });
  }

  function renderNotFound() {
    app.innerHTML = `<div class="empty">Хуудас олдсонгүй. <a href="#/">Нүүр</a></div>`;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  // initial render
  router();
})();
