# CipherShield &mdash; Advanced Encryption & Decryption Toolkit

A full-stack cybersecurity dashboard built around a Caesar cipher core, designed to
teach classical cryptography by making every step of it visible: the arithmetic,
the plain-English reasoning, the brute-force attack, and the statistical weakness
that ultimately breaks it.

Built as a portfolio project to demonstrate frontend design, Flask API design,
input validation, and applied cryptography fundamentals.

![CipherShield dashboard](static/images/screenshot-dashboard.png)
*(Screenshot placeholder &mdash; replace with an actual capture of the running app.)*

---

## Overview

The assignment behind this project was simple: implement a Caesar cipher that
encrypts and decrypts text. CipherShield takes that requirement and wraps it in
the kind of tooling a real cryptanalysis dashboard would have &mdash; an
interactive cipher wheel, a per-character encryption visualizer, an automated
brute-force cracker, live letter-frequency charts, and an honest security
scorecard that explains exactly why a Caesar cipher should never be used to
protect anything real.

A second module, **Modern Encryption**, extends the same interface to Base64,
ROT13, Vigenere, and XOR, comparing all of them side by side.

---

## Features

### Core toolkit (`/`)
- **Encrypt / decrypt console** &mdash; shift key from 1&ndash;25, preserves case,
  spaces, punctuation, and numbers exactly.
- **Brute force mode** &mdash; tries all 25 shifts against ciphertext and ranks
  each candidate by English-likeness (word matching + letter-frequency
  similarity), highlighting the most probable plaintext.
- **Encryption visualizer** &mdash; animated cards showing, per character:
  original letter &rarr; ASCII value &rarr; base subtraction &rarr; shift
  addition &rarr; modulo 26 &rarr; final character.
- **Live character mapping** &mdash; a full A&ndash;Z &rarr; shifted-letter
  strip that updates instantly as the shift key changes.
- **Interactive Caesar Wheel** &mdash; a draggable SVG cipher disk; rotating the
  inner ring sets the shift key.
- **Frequency analysis** &mdash; plaintext vs. ciphertext letter-frequency bar
  charts (Chart.js), with an explanation of why frequency analysis defeats
  the Caesar cipher.
- **Security score** &mdash; algorithm, security rating, key space, likely
  attack, and time-to-crack, color-coded by severity.
- **Step-by-step explanation** &mdash; a plain-English walkthrough of every
  character's transformation.
- **Session history** &mdash; every run this session (original, result, shift,
  timestamp), clearable, stored only in the browser.
- **Export** &mdash; download results as `.txt` or `.json`.
- **Copy buttons, reset, and a persisted dark/light theme toggle.**

### Modern Encryption module (`/modern`)
- Base64 encode/decode
- ROT13
- Vigenere cipher (encrypt/decrypt with a keyword)
- XOR cipher (hex-encoded output)
- A side-by-side comparison table against Caesar and AES-256, with security
  ratings for each.

### Learning section
Short, plain-language explanations of encryption, decryption, symmetric vs.
asymmetric cryptography, the Caesar cipher's history and weaknesses, and
overviews of AES and RSA.

---

## Tech Stack

| Layer     | Technology                                |
|-----------|--------------------------------------------|
| Backend   | Python 3, Flask 3                          |
| Frontend  | HTML5, CSS3 (glassmorphism, custom design system), vanilla JavaScript |
| Charts    | Chart.js (via CDN)                         |
| Storage   | None required &mdash; history is in-memory client-side |

No database is used; the backend is stateless and every cryptographic
operation is pure and side-effect free.

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/ciphershield.git
cd ciphershield

# 2. Create and activate a virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run the app
python3 app.py
```

The app will be available at **http://127.0.0.1:5000**.

---

## Usage

1. Open the dashboard and type or paste text into the input console.
2. Choose a shift key (1&ndash;25) using the slider or by dragging the cipher
   wheel.
3. Click **Encrypt** or **Decrypt** to run the cipher &mdash; the visualizer,
   explanation, frequency charts, and security score update automatically.
4. Don't know the key? Paste ciphertext into **Brute Force Mode** and let it
   rank all 25 possibilities.
5. Visit **Modern Encryption** to try Base64, ROT13, Vigenere, and XOR, or run
   the side-by-side comparison.

### Keyboard shortcuts
| Shortcut       | Action              |
|----------------|---------------------|
| `Ctrl/Cmd + Enter` | Run the cipher  |
| `Shift + T`    | Toggle dark/light theme |

---

## Folder Structure

```
ciphershield/
├── app.py                  # Flask app: routes, cipher logic, validation
├── requirements.txt
├── .gitignore
├── README.md
├── templates/
│   ├── index.html          # Main dashboard
│   └── modern.html         # Modern Encryption module
└── static/
    ├── css/
    │   └── style.css       # Design system, layout, animations
    ├── js/
    │   └── script.js       # All frontend logic and API calls
    └── images/              # Screenshots / icons (add your own)
```

---

## API Reference

All endpoints accept and return JSON, and return `400` with an `error` field
on invalid input.

| Method | Endpoint                  | Purpose                                  |
|--------|----------------------------|-------------------------------------------|
| POST   | `/api/caesar/encrypt`      | Encrypt text with a given shift           |
| POST   | `/api/caesar/decrypt`      | Decrypt text with a given shift           |
| POST   | `/api/caesar/bruteforce`   | Try all 25 shifts, ranked by likelihood   |
| POST   | `/api/caesar/map`          | Get the A&ndash;Z character mapping for a shift |
| POST   | `/api/modern/base64`       | Base64 encode/decode                      |
| POST   | `/api/modern/rot13`        | ROT13 transform                           |
| POST   | `/api/modern/vigenere`     | Vigenere encrypt/decrypt with a keyword   |
| POST   | `/api/modern/xor`          | XOR encrypt/decrypt (hex output)          |
| POST   | `/api/modern/compare`      | Run one plaintext through every algorithm |

---

## Future Improvements

- Persist history server-side (with a database) so it survives page reloads.
- Add more classical ciphers (Playfair, Rail Fence, Atbash) to the Modern
  Encryption comparison.
- Real AES/RSA demo endpoints (using `cryptography`) alongside the classical
  ciphers, clearly labeled as production-grade for contrast.
- Unit tests (`pytest`) covering the cipher core and API validation.
- Optional user accounts to save cipher history across sessions.

---

## License

This project is released under the MIT License. See `LICENSE` for details,
or treat this repository as free to use, modify, and learn from.

---

*Built as an educational cybersecurity portfolio project. Not intended to
protect real secrets &mdash; that's rather the point.*
