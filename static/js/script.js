/**
 * CipherShield — Frontend Application Logic
 * ------------------------------------------
 * Vanilla JS, no build step. Organized into small modules that each own one
 * concern. Every module checks for the DOM elements it needs before wiring
 * up listeners, so this single file safely powers both index.html and
 * modern.html.
 */

(() => {
  "use strict";

  /* =====================================================================
     Utilities
     ===================================================================== */

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $all = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  async function postJSON(url, payload) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Request to ${url} failed (${response.status}).`);
    }
    return data;
  }

  function downloadBlob(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* =====================================================================
     Toast notifications
     ===================================================================== */

  const Toast = (() => {
    const container = $("#toast-container");

    function show(message, type = "success") {
      if (!container) return;
      const toast = document.createElement("div");
      toast.className = `toast ${type}`;
      toast.textContent = message;
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }

    return { show };
  })();

  /* =====================================================================
     Theme (dark / light, persisted)
     ===================================================================== */

  const Theme = (() => {
    const STORAGE_KEY = "ciphershield-theme";
    const toggleBtn = $("#theme-toggle");
    const moonIcon = $("#theme-icon-moon");
    const sunIcon = $("#theme-icon-sun");

    function apply(theme) {
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem(STORAGE_KEY, theme);
      if (moonIcon && sunIcon) {
        moonIcon.style.display = theme === "dark" ? "block" : "none";
        sunIcon.style.display = theme === "light" ? "block" : "none";
      }
    }

    function toggle() {
      const current = document.documentElement.getAttribute("data-theme");
      apply(current === "dark" ? "light" : "dark");
    }

    function init() {
      const saved = localStorage.getItem(STORAGE_KEY);
      apply(saved || "dark");
      if (toggleBtn) toggleBtn.addEventListener("click", toggle);
    }

    return { init, toggle };
  })();

  /* =====================================================================
     Matrix rain background
     ===================================================================== */

  const MatrixRain = (() => {
    const canvas = $("#matrix-canvas");
    if (!canvas) return { init() {} };
    const ctx = canvas.getContext("2d");
    const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ01<>[]{}/*-+";
    let columns = [];
    let fontSize = 16;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const columnCount = Math.floor(canvas.width / fontSize);
      columns = new Array(columnCount).fill(0);
    }

    function draw() {
      ctx.fillStyle = "rgba(5, 7, 13, 0.08)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px monospace`;
      columns.forEach((y, i) => {
        const char = glyphs[Math.floor(Math.random() * glyphs.length)];
        const isGreen = Math.random() > 0.5;
        ctx.fillStyle = isGreen ? "#39ff88" : "#00d9ff";
        ctx.fillText(char, i * fontSize, y * fontSize);
        if (y * fontSize > canvas.height && Math.random() > 0.975) {
          columns[i] = 0;
        } else {
          columns[i] = y + 1;
        }
      });
      requestAnimationFrame(draw);
    }

    function init() {
      resize();
      window.addEventListener("resize", resize);
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        requestAnimationFrame(draw);
      }
    }

    return { init };
  })();

  /* =====================================================================
     Animated hero counters
     ===================================================================== */

  function initHeroCounters() {
    $all(".hero-stat-value").forEach((el) => {
      const target = Number(el.dataset.count);
      const suffix = el.dataset.suffix || "";
      if (Number.isNaN(target)) return;
      let current = 0;
      const step = Math.max(1, Math.ceil(target / 30));
      const timer = setInterval(() => {
        current = Math.min(target, current + step);
        el.textContent = current + suffix;
        if (current >= target) clearInterval(timer);
      }, 30);
    });
  }

  /* =====================================================================
     Caesar Wheel (signature interactive element)
     ===================================================================== */

  const CipherWheel = (() => {
    const svg = $("#wheel-svg");
    if (!svg) return { setShift() {} };

    const outerGroup = $("#outer-letters");
    const innerGroup = $("#inner-letters");
    const innerDisc = $(".wheel-inner-disc");
    const shiftLabel = $("#wheel-shift-label");
    const CENTER = 180;
    const OUTER_R = 150;
    const INNER_R = 95;
    const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    let currentShift = 3;
    let onShiftChange = null;

    function placeLetters(group, radius, className) {
      LETTERS.forEach((letter, i) => {
        const angle = (i / 26) * 2 * Math.PI - Math.PI / 2;
        const x = CENTER + radius * Math.cos(angle);
        const y = CENTER + radius * Math.sin(angle);
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", x.toFixed(2));
        text.setAttribute("y", y.toFixed(2));
        text.setAttribute("class", className);
        text.textContent = letter;
        group.appendChild(text);
      });
    }

    function render() {
      placeLetters(outerGroup, OUTER_R, "outer-letter");
      placeLetters(innerGroup, INNER_R, "inner-letter");
    }

    function applyRotation() {
      const degrees = currentShift * (360 / 26);
      innerGroup.style.transform = `rotate(${degrees}deg)`;
      innerGroup.style.transformOrigin = `${CENTER}px ${CENTER}px`;
      // Counter-rotate each letter glyph so it stays upright and readable.
      Array.from(innerGroup.children).forEach((el) => {
        el.style.transformBox = "fill-box";
        el.style.transformOrigin = "center";
        el.style.transform = `rotate(${-degrees}deg)`;
      });
      shiftLabel.textContent = `+${currentShift}`;
    }

    function setShift(shift, silent = false) {
      currentShift = Math.max(1, Math.min(25, shift));
      applyRotation();
      if (!silent && typeof onShiftChange === "function") {
        onShiftChange(currentShift);
      }
    }

    function angleFromEvent(clientX, clientY) {
      const rect = svg.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (deg < 0) deg += 360;
      return deg;
    }

    function initDrag() {
      let dragging = false;

      const onMove = (clientX, clientY) => {
        const deg = angleFromEvent(clientX, clientY);
        const shift = Math.round(deg / (360 / 26));
        setShift(shift === 0 ? 26 - 26 + shift || 1 : shift);
      };

      innerDisc.addEventListener("mousedown", () => { dragging = true; });
      window.addEventListener("mouseup", () => { dragging = false; });
      window.addEventListener("mousemove", (e) => {
        if (dragging) onMove(e.clientX, e.clientY);
      });

      innerDisc.addEventListener("touchstart", () => { dragging = true; }, { passive: true });
      window.addEventListener("touchend", () => { dragging = false; });
      window.addEventListener("touchmove", (e) => {
        if (dragging && e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });
    }

    function init(callback) {
      onShiftChange = callback;
      render();
      applyRotation();
      initDrag();
    }

    return { init, setShift };
  })();

  /* =====================================================================
     Live character mapping strip (client-side, instant feedback)
     ===================================================================== */

  function shiftChar(char, shift) {
    const base = 65; // 'A'
    return String.fromCharCode(((char.charCodeAt(0) - base + shift) % 26 + 26) % 26 + base);
  }

  function renderMappingStrip(shift) {
    const strip = $("#mapping-strip");
    if (!strip) return;
    strip.innerHTML = "";
    for (let i = 0; i < 26; i++) {
      const from = String.fromCharCode(65 + i);
      const to = shiftChar(from, shift);
      const pair = document.createElement("div");
      pair.className = "mapping-pair";
      pair.innerHTML = `<span class="mapping-from">${from}</span><span class="mapping-arrow">&#8595;</span><span class="mapping-to">${to}</span>`;
      strip.appendChild(pair);
    }
  }

  /* =====================================================================
     Frequency charts (Chart.js)
     ===================================================================== */

  const FrequencyCharts = (() => {
    let plainChart = null;
    let cipherChart = null;

    function buildConfig(freqData, color) {
      return {
        type: "bar",
        data: {
          labels: Object.keys(freqData),
          datasets: [{
            data: Object.values(freqData),
            backgroundColor: color,
            borderRadius: 3,
          }],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: "#7a8ba3", font: { family: "JetBrains Mono", size: 9 } }, grid: { display: false } },
            y: { ticks: { color: "#7a8ba3" }, grid: { color: "rgba(255,255,255,0.05)" } },
          },
        },
      };
    }

    function render(plainFreq, cipherFreq) {
      const plainCanvas = $("#chart-plaintext");
      const cipherCanvas = $("#chart-ciphertext");
      if (!plainCanvas || !cipherCanvas || typeof Chart === "undefined") return;

      if (plainChart) plainChart.destroy();
      if (cipherChart) cipherChart.destroy();

      plainChart = new Chart(plainCanvas, buildConfig(plainFreq, "#00d9ff"));
      cipherChart = new Chart(cipherCanvas, buildConfig(cipherFreq, "#39ff88"));
    }

    return { render };
  })();

  /* =====================================================================
     Visualizer cards
     ===================================================================== */

  function renderVisualizer(steps) {
    const track = $("#visualizer-track");
    if (!track) return;
    track.innerHTML = "";
    if (!steps || steps.length === 0) {
      track.innerHTML = '<div class="empty-state">No characters to visualize.</div>';
      return;
    }
    steps.forEach((step, i) => {
      const card = document.createElement("div");
      card.className = `viz-card${step.skipped ? " skipped" : ""}`;
      card.style.animationDelay = `${Math.min(i * 40, 1200)}ms`;
      if (step.skipped) {
        card.innerHTML = `
          <div class="viz-row"><span>Character</span><span>'${escapeHtml(step.original)}'</span></div>
          <div class="viz-final"><span>Unchanged</span><span class="viz-final-char">${escapeHtml(step.final)}</span></div>`;
      } else {
        card.innerHTML = `
          <div class="viz-row"><span>Original</span><span>${escapeHtml(step.original)}</span></div>
          <div class="viz-row"><span>ASCII</span><span>${step.ascii}</span></div>
          <div class="viz-row"><span>&minus; Base</span><span>${step.subtracted}</span></div>
          <div class="viz-row"><span>+ Shift</span><span>${step.added}</span></div>
          <div class="viz-row"><span>Mod 26</span><span>${step.modulo}</span></div>
          <div class="viz-final"><span>Result</span><span class="viz-final-char">${escapeHtml(step.final)}</span></div>`;
      }
      track.appendChild(card);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function renderExplanation(lines) {
    const list = $("#explanation-list");
    if (!list) return;
    list.innerHTML = "";
    if (!lines || lines.length === 0) {
      list.innerHTML = '<li class="empty-state">Run the cipher to generate an explanation.</li>';
      return;
    }
    lines.forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      list.appendChild(li);
    });
  }

  /* =====================================================================
     Security score card
     ===================================================================== */

  function renderSecurity(security) {
    const card = $("#security-card");
    if (!card || !security) return;
    $("#sec-algorithm").textContent = security.algorithm;
    $("#sec-security").textContent = security.security;
    $("#sec-keyspace").textContent = security.key_space;
    $("#sec-attack").textContent = security.attack;
    $("#sec-time").textContent = security.time_to_crack;

    card.className = `glass-card security-card severity-${security.severity || "critical"}`;
    const meter = $("#threat-meter-fill");
    const meterWidths = { critical: "96%", high: "70%", medium: "45%", none: "5%" };
    if (meter) meter.style.width = meterWidths[security.severity] || "96%";
  }

  /* =====================================================================
     Session history (in-memory, no backend persistence needed)
     ===================================================================== */

  const History = (() => {
    const entries = [];
    const tbody = $("#history-tbody");

    function render() {
      if (!tbody) return;
      if (entries.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="5" class="empty-state">No history yet &mdash; run the cipher to get started.</td></tr>';
        return;
      }
      tbody.innerHTML = entries.map((e) => `
        <tr>
          <td>${e.time}</td>
          <td>${e.mode}</td>
          <td>${e.shift}</td>
          <td>${escapeHtml(truncate(e.original))}</td>
          <td>${escapeHtml(truncate(e.result))}</td>
        </tr>`).join("");
    }

    function truncate(str, max = 40) {
      return str.length > max ? str.slice(0, max) + "\u2026" : str;
    }

    function add(entry) {
      entries.unshift({ ...entry, time: new Date().toLocaleTimeString() });
      render();
    }

    function clear() {
      entries.length = 0;
      render();
    }

    function init() {
      const clearBtn = $("#clear-history-btn");
      if (clearBtn) clearBtn.addEventListener("click", () => {
        clear();
        Toast.show("History cleared.", "success");
      });
    }

    return { init, add };
  })();

  /* =====================================================================
     Copy-to-clipboard buttons (shared across pages)
     ===================================================================== */

  function initCopyButtons() {
    $all(".copy-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const target = document.getElementById(btn.dataset.target);
        if (!target || !target.value) {
          Toast.show("Nothing to copy yet.", "error");
          return;
        }
        try {
          await navigator.clipboard.writeText(target.value);
          Toast.show("Copied to clipboard.", "success");
        } catch {
          Toast.show("Copy failed - please copy manually.", "error");
        }
      });
    });
  }

  /* =====================================================================
     Main Caesar console (index.html)
     ===================================================================== */

  function initCaesarConsole() {
    const inputText = $("#input-text");
    const outputText = $("#output-text");
    const shiftSlider = $("#shift-slider");
    const shiftValueLabel = $("#shift-value");
    const runBtn = $("#run-cipher-btn");
    const resetBtn = $("#reset-btn");
    const outputStatus = $("#output-status");
    const inputCharCount = $("#input-char-count");
    if (!inputText || !runBtn) return;

    let mode = "encrypt";

    CipherWheel.init((newShift) => {
      shiftSlider.value = newShift;
      shiftValueLabel.textContent = newShift;
      renderMappingStrip(newShift);
    });
    renderMappingStrip(Number(shiftSlider.value));

    shiftSlider.addEventListener("input", () => {
      const value = Number(shiftSlider.value);
      shiftValueLabel.textContent = value;
      renderMappingStrip(value);
      CipherWheel.setShift(value, true);
    });

    inputText.addEventListener("input", () => {
      inputCharCount.textContent = `${inputText.value.length} chars`;
    });

    $all(".mode-btn[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        mode = btn.dataset.mode;
        $all(".mode-btn[data-mode]").forEach((b) => {
          b.classList.toggle("active", b === btn);
          b.setAttribute("aria-selected", b === btn ? "true" : "false");
        });
      });
    });

    async function runCipher() {
      const text = inputText.value;
      const shift = Number(shiftSlider.value);
      if (!text.trim()) {
        Toast.show("Enter some text first.", "error");
        return;
      }
      outputStatus.textContent = "Processing\u2026";
      try {
        const endpoint = mode === "encrypt" ? "/api/caesar/encrypt" : "/api/caesar/decrypt";
        const data = await postJSON(endpoint, { text, shift });
        outputText.value = data.result;
        outputStatus.textContent = `${mode === "encrypt" ? "Encrypted" : "Decrypted"} \u2713`;
        renderVisualizer(data.visualizer);
        renderExplanation(data.explanation);
        renderSecurity(data.security);
        if (data.frequency) {
          FrequencyCharts.render(data.frequency.plaintext, data.frequency.ciphertext);
        }
        History.add({ mode, shift, original: text, result: data.result });
        Toast.show("Cipher executed successfully.", "success");
      } catch (err) {
        outputStatus.textContent = "Error";
        Toast.show(err.message, "error");
      }
    }

    runBtn.addEventListener("click", runCipher);

    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        runCipher();
      }
      if (e.shiftKey && e.key.toUpperCase() === "T") {
        Theme.toggle();
      }
    });

    resetBtn.addEventListener("click", () => {
      inputText.value = "";
      outputText.value = "";
      inputCharCount.textContent = "0 chars";
      outputStatus.textContent = "Awaiting input\u2026";
      renderVisualizer([]);
      renderExplanation([]);
      $("#bruteforce-input").value = "";
      $("#bruteforce-results").innerHTML = '<div class="empty-state">Results will list all 25 possible decryptions, ranked by likelihood.</div>';
      Toast.show("Console reset.", "success");
    });

    // Export dropdown
    const exportToggle = $("#export-toggle");
    const exportMenu = $("#export-menu");
    if (exportToggle && exportMenu) {
      exportToggle.addEventListener("click", () => exportMenu.classList.toggle("open"));
      document.addEventListener("click", (e) => {
        if (!exportToggle.contains(e.target) && !exportMenu.contains(e.target)) {
          exportMenu.classList.remove("open");
        }
      });
      $all("button[data-format]", exportMenu).forEach((btn) => {
        btn.addEventListener("click", () => {
          const format = btn.dataset.format;
          const result = outputText.value;
          if (!result) {
            Toast.show("Run the cipher before exporting.", "error");
            return;
          }
          if (format === "txt") {
            downloadBlob(result, "ciphershield-output.txt", "text/plain");
          } else {
            const payload = JSON.stringify({
              mode,
              shift: Number(shiftSlider.value),
              original: inputText.value,
              result,
              generated_at: new Date().toISOString(),
            }, null, 2);
            downloadBlob(payload, "ciphershield-output.json", "application/json");
          }
          exportMenu.classList.remove("open");
          Toast.show(`Exported as .${format.toUpperCase()}`, "success");
        });
      });
    }
  }

  /* =====================================================================
     Brute force panel
     ===================================================================== */

  function initBruteForce() {
    const btn = $("#bruteforce-btn");
    const input = $("#bruteforce-input");
    const resultsBox = $("#bruteforce-results");
    if (!btn) return;

    btn.addEventListener("click", async () => {
      const text = input.value;
      if (!text.trim()) {
        Toast.show("Paste some ciphertext first.", "error");
        return;
      }
      resultsBox.innerHTML = '<div class="empty-state">Cracking\u2026</div>';
      try {
        const data = await postJSON("/api/caesar/bruteforce", { text });
        resultsBox.innerHTML = "";
        data.results.forEach((r) => {
          const row = document.createElement("div");
          row.className = `bf-row${r.likely ? " likely" : ""}`;
          row.innerHTML = `<span class="bf-shift">${r.shift}</span><span class="bf-text">${escapeHtml(r.text)}</span>`;
          resultsBox.appendChild(row);
        });
      } catch (err) {
        resultsBox.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
      }
    });
  }

  /* =====================================================================
     Modern Encryption page (modern.html)
     ===================================================================== */

  function initModernPage() {
    // Base64
    const b64Input = $("#base64-input");
    if (b64Input) {
      $all("button[data-b64-mode]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          try {
            const data = await postJSON("/api/modern/base64", { text: b64Input.value, mode: btn.dataset.b64Mode });
            $("#base64-output").value = data.result;
          } catch (err) {
            Toast.show(err.message, "error");
          }
        });
      });
    }

    // ROT13
    const rot13Btn = $("#rot13-run");
    if (rot13Btn) {
      rot13Btn.addEventListener("click", async () => {
        try {
          const data = await postJSON("/api/modern/rot13", { text: $("#rot13-input").value });
          $("#rot13-output").value = data.result;
        } catch (err) {
          Toast.show(err.message, "error");
        }
      });
    }

    // Vigenere
    const vigRunBtn = $("#vigenere-run");
    if (vigRunBtn) {
      let vigMode = "encrypt";
      $all("button[data-vig-mode]").forEach((btn) => {
        btn.addEventListener("click", () => {
          vigMode = btn.dataset.vigMode;
          $all("button[data-vig-mode]").forEach((b) => b.classList.toggle("active", b === btn));
        });
      });
      vigRunBtn.addEventListener("click", async () => {
        try {
          const data = await postJSON("/api/modern/vigenere", {
            text: $("#vigenere-input").value,
            key: $("#vigenere-key").value,
            mode: vigMode,
          });
          $("#vigenere-output").value = data.result;
        } catch (err) {
          Toast.show(err.message, "error");
        }
      });
    }

    // XOR
    const xorRunBtn = $("#xor-run");
    if (xorRunBtn) {
      let xorMode = "encrypt";
      $all("button[data-xor-mode]").forEach((btn) => {
        btn.addEventListener("click", () => {
          xorMode = btn.dataset.xorMode;
          $all("button[data-xor-mode]").forEach((b) => b.classList.toggle("active", b === btn));
        });
      });
      xorRunBtn.addEventListener("click", async () => {
        try {
          const data = await postJSON("/api/modern/xor", {
            text: $("#xor-input").value,
            key: $("#xor-key").value,
            mode: xorMode,
          });
          $("#xor-output").value = data.result;
        } catch (err) {
          Toast.show(err.message, "error");
        }
      });
    }

    // Comparison table
    const compareBtn = $("#compare-run");
    if (compareBtn) {
      compareBtn.addEventListener("click", async () => {
        const text = $("#compare-input").value;
        if (!text.trim()) {
          Toast.show("Enter some text to compare.", "error");
          return;
        }
        try {
          const data = await postJSON("/api/modern/compare", { text });
          const rows = Object.values(data.comparison).map((row) => `
            <tr>
              <td>${row.algorithm}</td>
              <td>${escapeHtml(String(row.output ?? "\u2014"))}</td>
              <td>${row.security}</td>
              <td>${row.key_space}</td>
              <td>${row.attack}</td>
              <td>${row.time_to_crack}</td>
            </tr>`).join("");
          $("#compare-tbody").innerHTML = rows;
        } catch (err) {
          Toast.show(err.message, "error");
        }
      });
    }
  }

  /* =====================================================================
     Boot
     ===================================================================== */

  document.addEventListener("DOMContentLoaded", () => {
    Theme.init();
    MatrixRain.init();
    initHeroCounters();
    initCopyButtons();
    History.init();
    initCaesarConsole();
    initBruteForce();
    initModernPage();
  });
})();
