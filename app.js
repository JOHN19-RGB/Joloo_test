(function () {
  "use strict";

  const QUESTIONS = window.JOLOONII_QUESTIONS || [];
  const app = document.getElementById("app");
  const navLinks = document.querySelectorAll(".nav a");

  const BY_CARD = {};
  QUESTIONS.forEach((q) => {
    if (!BY_CARD[q.card]) BY_CARD[q.card] = [];
    BY_CARD[q.card].push(q);
  });
  Object.values(BY_CARD).forEach((arr) => arr.sort((a, b) => a.q - b.q));
  const CARD_NUMS = Object.keys(BY_CARD)
    .map(Number)
    .sort((a, b) => a - b);

  // ---- Persistence (localStorage) ----
  const STORAGE_KEY = "joloonii.progress.v1";
  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { cards: {} };
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") return { cards: {} };
      if (!obj.cards) obj.cards = {};
      return obj;
    } catch (_) {
      return { cards: {} };
    }
  }
  function saveCardResult(cardNum, correct, total) {
    const p = loadProgress();
    const prev = p.cards[cardNum] || { best: 0, attempts: 0 };
    p.cards[cardNum] = {
      best: Math.max(prev.best || 0, correct),
      total,
      attempts: (prev.attempts || 0) + 1,
      lastAt: Date.now(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch (_) { /* quota or disabled */ }
  }

  // ---- Keyboard shortcut registry ----
  // Pages register a handler; old handler is replaced on each render.
  let keyHandler = null;
  function setKeyHandler(fn) { keyHandler = fn; }
  document.addEventListener("keydown", (e) => {
    if (!keyHandler) return;
    // Don't intercept when typing in form fields (none today, but defensive).
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    keyHandler(e);
  });

  // ---- Image lightbox ----
  let lightboxEl = null;
  function openLightbox(src, alt) {
    closeLightbox();
    lightboxEl = document.createElement("div");
    lightboxEl.className = "lightbox";
    lightboxEl.setAttribute("role", "dialog");
    lightboxEl.setAttribute("aria-label", "Зураг томруулсан");
    lightboxEl.innerHTML = `
      <button class="lightbox-close" aria-label="Хаах">×</button>
      <img src="${src}" alt="${alt || ""}" />
    `;
    lightboxEl.addEventListener("click", (e) => {
      if (e.target === lightboxEl || e.target.classList.contains("lightbox-close")) closeLightbox();
    });
    document.body.appendChild(lightboxEl);
    document.body.classList.add("no-scroll");
  }
  function closeLightbox() {
    if (lightboxEl) {
      lightboxEl.remove();
      lightboxEl = null;
      document.body.classList.remove("no-scroll");
    }
  }
  // ESC closes lightbox globally
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lightboxEl) closeLightbox();
  });

  function setActiveNav(hash) {
    navLinks.forEach((a) => {
      const href = a.getAttribute("href").replace("#", "");
      const matchHome =
        href === "/" && (hash === "" || hash === "/" || hash.startsWith("/chapter/"));
      const matchSection = href !== "/" && hash.startsWith(href);
      a.classList.toggle("active", matchHome || matchSection);
    });
  }

  // ---- Router ----
  function router() {
    const hash = location.hash.replace(/^#/, "") || "/";
    setActiveNav(hash);
    window.scrollTo(0, 0);
    setKeyHandler(null); // reset per-page handler

    if (hash === "/" || hash === "") return renderHome();
    if (hash === "/chapters") return renderChapters();

    const m = hash.match(/^\/chapter\/(\d+)$/);
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
    const progress = loadProgress();
    const tiles = CARD_NUMS.map((n) => {
      const p = progress.cards[n];
      let badge = "";
      let cls = "chapter-tile";
      if (p && typeof p.best === "number") {
        const passed = p.best >= 18;
        cls += passed ? " done" : " tried";
        badge = `<span class="best ${passed ? "pass" : "fail"}">${p.best}/20</span>`;
      }
      return `
      <a class="${cls}" href="#/chapter/${n}" aria-label="Карт ${pad2(n)}">
        <span class="num">${pad2(n)}</span>
        <span class="label">${BY_CARD[n].length} асуулт</span>
        ${badge}
      </a>`;
    }).join("");

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
    let saved = false;

    function pickAnswer(picked) {
      if (answered) return;
      const q = list[idx];
      answered = true;
      const correct = picked === q.answer;

      const choicesEl = document.getElementById("choices");
      const feedbackEl = document.getElementById("feedback");
      const nextBtn = document.getElementById("nextBtn");

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
    }

    function advance() {
      const total = list.length;
      if (idx === total - 1) {
        if (!saved) {
          saveCardResult(cardNum, correctCount, total);
          saved = true;
        }
        renderChapterDone(cardNum, correctCount, wrongCount, total);
        return;
      }
      idx++;
      answered = false;
      draw();
    }

    function draw() {
      const q = list[idx];
      const total = list.length;
      const pct = (idx / total) * 100;

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

        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}">
          <div class="progress-bar" style="width:${pct}%"></div>
        </div>

        <div class="q-card">
          <div class="q-meta">Асуулт ${q.q}</div>
          <img class="q-image zoomable" src="${q.img}" alt="Асуулт ${q.q}" loading="eager" />
          <div class="choices" id="choices" role="radiogroup" aria-label="Хариултын сонголт">
            ${[1, 2, 3, 4, 5]
              .map(
                (n) =>
                  `<button class="choice-btn" data-ans="${n}" aria-label="Хариулт ${n}"><span class="kbd">${n}</span> ${n}</button>`
              )
              .join("")}
          </div>
          <div class="feedback" id="feedback" role="status" aria-live="polite"></div>
        </div>

        <div class="actions">
          <a class="btn" href="#/chapters">← Картууд</a>
          <button class="btn primary" id="nextBtn" disabled>${
            idx === total - 1 ? "Дуусгах" : "Дараагийн"
          } <span class="kbd kbd-light">Enter</span></button>
        </div>

        <p class="kbd-hint">Хариултаа сонгохдоо <span class="kbd">1</span>–<span class="kbd">5</span>, дараагийн руу шилжихдээ <span class="kbd">Enter</span>.</p>
      `;

      const choicesEl = document.getElementById("choices");
      const nextBtn = document.getElementById("nextBtn");

      choicesEl.querySelectorAll(".choice-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          pickAnswer(parseInt(btn.dataset.ans, 10));
        });
      });

      const imgEl = app.querySelector(".q-image.zoomable");
      if (imgEl) {
        imgEl.addEventListener("click", () => openLightbox(q.img, "Асуулт " + q.q));
      }

      nextBtn.addEventListener("click", advance);
    }

    setKeyHandler((e) => {
      if (e.key >= "1" && e.key <= "5") {
        e.preventDefault();
        pickAnswer(parseInt(e.key, 10));
      } else if ((e.key === "Enter" || e.key === " ") && answered) {
        e.preventDefault();
        advance();
      }
    });

    draw();
  }

  function renderChapterDone(cardNum, correct, wrong, total) {
    const pct = Math.round((correct / total) * 100);
    const passed = correct >= 18;
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
        answers: {},
        idx: 0,
        startedAt: Date.now(),
        durationMs: 20 * 60 * 1000,
        finished: false,
      };
    }

    const session = randomSession;

    function go(delta) {
      const total = session.questions.length;
      const next = session.idx + delta;
      if (next < 0 || next >= total) return;
      session.idx = next;
      draw();
    }
    function finish() {
      if (session.finished) return;
      if (confirm("Шалгалтыг дуусгах уу? Үр дүн харагдана.")) {
        session.finished = true;
        session.endedAt = Date.now();
        location.hash = "#/random/result";
      }
    }

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
          <div class="timer" id="timer" aria-live="off">--:--</div>
        </div>

        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(((session.idx + 1) / total) * 100)}">
          <div class="progress-bar" style="width:${((session.idx + 1) / total) * 100}%"></div>
        </div>

        <div class="q-card">
          <div class="q-meta">Карт #${pad2(q.card)} · Асуулт ${q.q}</div>
          <img class="q-image zoomable" src="${q.img}" alt="Асуулт" loading="eager" />
          <div class="choices" id="choices" role="radiogroup" aria-label="Хариултын сонголт">
            ${[1, 2, 3, 4, 5]
              .map(
                (n) =>
                  `<button class="choice-btn ${picked === n ? "selected" : ""}" data-ans="${n}" aria-label="Хариулт ${n}" aria-pressed="${picked === n}"><span class="kbd">${n}</span> ${n}</button>`
              )
              .join("")}
          </div>
        </div>

        <div class="actions">
          <button class="btn" id="prevBtn" ${session.idx === 0 ? "disabled" : ""}>← Өмнөх <span class="kbd kbd-light">←</span></button>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            ${
              session.idx === total - 1
                ? `<button class="btn primary" id="finishBtn">Шалгалт дуусгах <span class="kbd kbd-light">Enter</span></button>`
                : `<button class="btn primary" id="nextBtn">Дараагийн → <span class="kbd kbd-light">→</span></button>`
            }
          </div>
        </div>

        <p class="kbd-hint">Хариулах: <span class="kbd">1</span>–<span class="kbd">5</span> · Шилжих: <span class="kbd">←</span> <span class="kbd">→</span> · Дуусгах: <span class="kbd">Enter</span></p>

        <div class="cards-card-grid mt-24" id="qnav" aria-label="Асуулт хооронд шилжих">
          ${session.questions
            .map((_, i) => {
              const ans = session.answers[i];
              const cur = i === session.idx;
              return `<button class="btn" data-jump="${i}" aria-current="${cur}" style="padding:8px 0;${
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

      document.querySelectorAll("#choices .choice-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          session.answers[session.idx] = parseInt(btn.dataset.ans, 10);
          draw();
        });
      });

      const imgEl = app.querySelector(".q-image.zoomable");
      if (imgEl) imgEl.addEventListener("click", () => openLightbox(q.img, "Асуулт"));

      const prevBtn = document.getElementById("prevBtn");
      const nextBtn = document.getElementById("nextBtn");
      const finishBtn = document.getElementById("finishBtn");
      if (prevBtn) prevBtn.addEventListener("click", () => go(-1));
      if (nextBtn) nextBtn.addEventListener("click", () => go(1));
      if (finishBtn) finishBtn.addEventListener("click", finish);

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
      timerEl.classList.toggle("danger", remaining < 60 * 1000);
      timerEl.classList.toggle(
        "warning",
        remaining >= 60 * 1000 && remaining < 5 * 60 * 1000
      );

      if (remaining <= 0) {
        session.finished = true;
        session.endedAt = Date.now();
        location.hash = "#/random/result";
      }
    }

    if (session._tick) clearInterval(session._tick);
    session._tick = setInterval(updateTimer, 1000);

    setKeyHandler((e) => {
      if (e.key >= "1" && e.key <= "5") {
        e.preventDefault();
        session.answers[session.idx] = parseInt(e.key, 10);
        draw();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (session.idx === session.questions.length - 1) finish();
        else go(1);
      }
    });

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
            <img class="q-image zoomable" src="${q.img}" alt="Асуулт" loading="lazy" />
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

    app.querySelectorAll(".q-image.zoomable").forEach((img) => {
      img.addEventListener("click", () => openLightbox(img.src, img.alt));
    });
  }

  function renderNotFound() {
    app.innerHTML = `<div class="empty">Хуудас олдсонгүй. <a href="#/">Нүүр</a></div>`;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  router();
})();
