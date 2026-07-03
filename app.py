"""
CipherShield - Advanced Encryption & Decryption Toolkit
=========================================================

A Flask backend powering a cybersecurity-themed Caesar Cipher toolkit.
Implements classic and modern cipher primitives, brute-force cryptanalysis,
frequency analysis, and step-by-step transformation data used by the
frontend visualizer.

Author: Adhyan (portfolio project)
"""

from __future__ import annotations

import base64
import binascii
import string
from collections import Counter
from typing import Dict, List

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ALPHABET_SIZE = 26
COMMON_ENGLISH_WORDS = {
    "the", "and", "you", "that", "was", "for", "are", "with", "his", "they",
    "this", "have", "from", "not", "had", "but", "what", "all", "were",
    "when", "your", "can", "said", "there", "use", "each", "which", "she",
    "how", "will", "other", "about", "out", "many", "then", "them", "these",
    "some", "her", "would", "make", "like", "him", "into", "time", "has",
    "look", "two", "more", "write", "our", "hello", "world", "attack",
    "password", "security", "flask", "python", "cyber",
}

# Reference letter-frequency table for the English language (percent),
# used to explain why a Caesar cipher's ciphertext frequency profile is
# such a strong analytical weakness.
ENGLISH_LETTER_FREQUENCY = {
    "a": 8.17, "b": 1.49, "c": 2.78, "d": 4.25, "e": 12.70, "f": 2.23,
    "g": 2.02, "h": 6.09, "i": 6.97, "j": 0.15, "k": 0.77, "l": 4.03,
    "m": 2.41, "n": 6.75, "o": 7.51, "p": 1.93, "q": 0.10, "r": 5.99,
    "s": 6.33, "t": 9.06, "u": 2.76, "v": 0.98, "w": 2.36, "x": 0.15,
    "y": 1.97, "z": 0.07,
}


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

class ValidationError(Exception):
    """Raised when incoming request data fails validation."""


def get_json_body() -> dict:
    """Safely parse and return the JSON body of the current request."""
    data = request.get_json(silent=True)
    if data is None:
        raise ValidationError("Request body must be valid JSON.")
    return data


def validate_text(text) -> str:
    """Ensure the provided text field is a non-empty string within limits."""
    if not isinstance(text, str):
        raise ValidationError("Field 'text' must be a string.")
    if len(text) == 0:
        raise ValidationError("Field 'text' cannot be empty.")
    if len(text) > 10000:
        raise ValidationError("Field 'text' exceeds the 10,000 character limit.")
    return text


def validate_shift(shift) -> int:
    """Ensure the provided shift is an integer between 1 and 25."""
    try:
        shift = int(shift)
    except (TypeError, ValueError):
        raise ValidationError("Field 'shift' must be an integer.")
    if not 1 <= shift <= 25:
        raise ValidationError("Field 'shift' must be between 1 and 25.")
    return shift


def validate_key(key) -> str:
    """Ensure a Vigenere/XOR key is a non-empty alphabetic-safe string."""
    if not isinstance(key, str) or len(key.strip()) == 0:
        raise ValidationError("Field 'key' cannot be empty.")
    if len(key) > 256:
        raise ValidationError("Field 'key' exceeds the 256 character limit.")
    return key


# ---------------------------------------------------------------------------
# Caesar Cipher core
# ---------------------------------------------------------------------------

def shift_character(char: str, shift: int) -> str:
    """
    Shift a single character by `shift` positions through the alphabet.

    Preserves case. Non-alphabetic characters (spaces, punctuation,
    numbers) are returned unchanged, as required by the assignment spec.
    """
    if char.isupper():
        base = ord("A")
        return chr((ord(char) - base + shift) % ALPHABET_SIZE + base)
    if char.islower():
        base = ord("a")
        return chr((ord(char) - base + shift) % ALPHABET_SIZE + base)
    return char


def caesar_transform(text: str, shift: int) -> str:
    """Apply a Caesar shift to every character in `text`."""
    return "".join(shift_character(ch, shift) for ch in text)


def caesar_encrypt(text: str, shift: int) -> str:
    return caesar_transform(text, shift)


def caesar_decrypt(text: str, shift: int) -> str:
    return caesar_transform(text, -shift)


# ---------------------------------------------------------------------------
# Brute force cryptanalysis
# ---------------------------------------------------------------------------

def score_english_likeness(text: str) -> float:
    """
    Heuristically score how likely a string of text is genuine English.

    Combines two signals:
      1. Fraction of words that appear in a common-word reference set.
      2. Chi-squared-style closeness of letter frequency to English norms
         (lower distance -> higher score contribution).
    Returns a float; higher means more likely to be readable English.
    """
    words = [w.strip(string.punctuation).lower() for w in text.split()]
    words = [w for w in words if w]
    if not words:
        return 0.0

    word_hits = sum(1 for w in words if w in COMMON_ENGLISH_WORDS)
    word_score = word_hits / len(words)

    letters = [c.lower() for c in text if c.isalpha()]
    freq_score = 0.0
    if letters:
        counts = Counter(letters)
        total = len(letters)
        chi_sq = 0.0
        for letter, expected_pct in ENGLISH_LETTER_FREQUENCY.items():
            observed_pct = (counts.get(letter, 0) / total) * 100
            chi_sq += (observed_pct - expected_pct) ** 2 / expected_pct
        # Lower chi-squared indicates a closer match to English; invert
        # and normalize into a rough 0..1 range for blending.
        freq_score = max(0.0, 1 - (chi_sq / 500))

    return (word_score * 0.7) + (freq_score * 0.3)


def brute_force_caesar(ciphertext: str) -> List[Dict]:
    """
    Try all 25 possible shift keys against `ciphertext` and rank each
    candidate plaintext by English-likeness so the UI can highlight the
    most probable decryption(s).
    """
    results = []
    for shift in range(1, ALPHABET_SIZE):
        candidate = caesar_decrypt(ciphertext, shift)
        score = score_english_likeness(candidate)
        results.append({
            "shift": shift,
            "text": candidate,
            "score": round(score, 4),
        })

    if results:
        max_score = max(r["score"] for r in results)
        threshold = max_score * 0.85 if max_score > 0 else 1.0
        for r in results:
            r["likely"] = max_score > 0 and r["score"] >= threshold

    return results


# ---------------------------------------------------------------------------
# Encryption visualizer / step-by-step explanation
# ---------------------------------------------------------------------------

ORDINAL_SUFFIXES = {1: "st", 2: "nd", 3: "rd"}


def ordinal(n: int) -> str:
    if 10 <= n % 100 <= 20:
        suffix = "th"
    else:
        suffix = ORDINAL_SUFFIXES.get(n % 10, "th")
    return f"{n}{suffix}"


def build_visualizer_steps(text: str, shift: int, mode: str) -> List[Dict]:
    """
    Build a per-character breakdown of the Caesar transformation, used to
    render the animated 'Original -> ASCII -> Subtract Base -> Add Shift ->
    Modulo -> Final Character' cards on the frontend.
    """
    effective_shift = shift if mode == "encrypt" else -shift
    steps = []
    for char in text:
        if char.isalpha():
            is_upper = char.isupper()
            base = ord("A") if is_upper else ord("a")
            ascii_val = ord(char)
            subtracted = ascii_val - base
            added = subtracted + effective_shift
            mod_result = added % ALPHABET_SIZE
            final_char = chr(mod_result + base)
            steps.append({
                "original": char,
                "ascii": ascii_val,
                "base": base,
                "subtracted": subtracted,
                "shift_applied": effective_shift,
                "added": added,
                "modulo": mod_result,
                "final": final_char,
                "skipped": False,
            })
        else:
            steps.append({
                "original": char,
                "final": char,
                "skipped": True,
            })
    return steps


def build_plain_english_explanation(text: str, shift: int, mode: str) -> List[str]:
    """Generate a plain-English, character-by-character walkthrough."""
    effective_shift = shift % ALPHABET_SIZE
    direction = "forward" if mode == "encrypt" else "backward"
    lines = []
    for char in text:
        if not char.isalpha():
            lines.append(f"'{char}' is not a letter, so it stays exactly as '{char}'.")
            continue
        is_upper = char.isupper()
        base = ord("A") if is_upper else ord("a")
        position = ord(char.upper()) - ord("A") + 1
        new_pos = (ord(char) - base + (shift if mode == "encrypt" else -shift)) % ALPHABET_SIZE
        result_char = chr(new_pos + base)
        lines.append(
            f"'{char}' becomes '{result_char}' because '{char.upper()}' is the "
            f"{ordinal(position)} letter of the alphabet, and moving {shift} "
            f"positions {direction} lands on '{result_char.upper()}'."
        )
    return lines


# ---------------------------------------------------------------------------
# Frequency analysis
# ---------------------------------------------------------------------------

def letter_frequency(text: str) -> Dict[str, float]:
    """Return the percentage frequency of each letter a-z within `text`."""
    letters = [c.lower() for c in text if c.isalpha()]
    total = len(letters)
    freq = {letter: 0.0 for letter in string.ascii_lowercase}
    if total == 0:
        return freq
    counts = Counter(letters)
    for letter in string.ascii_lowercase:
        freq[letter] = round((counts.get(letter, 0) / total) * 100, 2)
    return freq


# ---------------------------------------------------------------------------
# Security scoring
# ---------------------------------------------------------------------------

def caesar_security_profile() -> Dict:
    """Static, honest security profile for the Caesar cipher."""
    return {
        "algorithm": "Caesar Cipher",
        "security": "Very Low",
        "severity": "critical",
        "key_space": 25,
        "attack": "Brute Force",
        "time_to_crack": "Instant (< 1 millisecond)",
    }


SECURITY_PROFILES = {
    "caesar": caesar_security_profile(),
    "rot13": {
        "algorithm": "ROT13",
        "security": "Very Low",
        "severity": "critical",
        "key_space": 1,
        "attack": "None needed (fixed key)",
        "time_to_crack": "Instant",
    },
    "base64": {
        "algorithm": "Base64",
        "security": "None (encoding, not encryption)",
        "severity": "critical",
        "key_space": 0,
        "attack": "Direct decode",
        "time_to_crack": "Instant",
    },
    "vigenere": {
        "algorithm": "Vigenere Cipher",
        "security": "Low",
        "severity": "high",
        "key_space": "26^(key length)",
        "attack": "Kasiski Examination / Frequency Analysis",
        "time_to_crack": "Minutes to hours (short keys)",
    },
    "xor": {
        "algorithm": "XOR Cipher",
        "security": "Low to Medium (key-dependent)",
        "severity": "medium",
        "key_space": "256^(key length)",
        "attack": "Known-plaintext / frequency analysis",
        "time_to_crack": "Seconds to hours (short/reused keys)",
    },
    "aes": {
        "algorithm": "AES-256",
        "security": "Very High",
        "severity": "none",
        "key_space": "2^256",
        "attack": "No practical attack known",
        "time_to_crack": "Longer than the age of the universe",
    },
}


# ---------------------------------------------------------------------------
# Modern encryption module
# ---------------------------------------------------------------------------

def rot13(text: str) -> str:
    return caesar_transform(text, 13)


def vigenere_transform(text: str, key: str, mode: str) -> str:
    """Apply the Vigenere cipher. `mode` is 'encrypt' or 'decrypt'."""
    clean_key = [c for c in key.lower() if c.isalpha()]
    if not clean_key:
        raise ValidationError("Vigenere key must contain at least one letter.")

    result = []
    key_index = 0
    key_len = len(clean_key)
    for char in text:
        if char.isalpha():
            key_shift = ord(clean_key[key_index % key_len]) - ord("a")
            if mode == "decrypt":
                key_shift = -key_shift
            result.append(shift_character(char, key_shift))
            key_index += 1
        else:
            result.append(char)
    return "".join(result)


def xor_encrypt_to_hex(text: str, key: str) -> str:
    """XOR each byte of `text` with the repeating key, return as hex."""
    key_bytes = key.encode("utf-8")
    text_bytes = text.encode("utf-8")
    result_bytes = bytes(
        b ^ key_bytes[i % len(key_bytes)] for i, b in enumerate(text_bytes)
    )
    return result_bytes.hex()


def xor_decrypt_from_hex(hex_text: str, key: str) -> str:
    """Reverse of xor_encrypt_to_hex. Raises ValidationError on bad hex."""
    try:
        data_bytes = bytes.fromhex(hex_text)
    except (ValueError, binascii.Error):
        raise ValidationError("XOR ciphertext must be valid hexadecimal.")
    key_bytes = key.encode("utf-8")
    result_bytes = bytes(
        b ^ key_bytes[i % len(key_bytes)] for i, b in enumerate(data_bytes)
    )
    try:
        return result_bytes.decode("utf-8")
    except UnicodeDecodeError:
        raise ValidationError(
            "Decoded XOR output is not valid UTF-8 - check the key and ciphertext."
        )


# ---------------------------------------------------------------------------
# Routes - pages
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    """Main CipherShield dashboard: Caesar cipher toolkit."""
    return render_template("index.html")


@app.route("/modern")
def modern():
    """Modern Encryption comparison page."""
    return render_template("modern.html")


# ---------------------------------------------------------------------------
# Routes - Caesar Cipher API
# ---------------------------------------------------------------------------

@app.route("/api/caesar/encrypt", methods=["POST"])
def api_caesar_encrypt():
    try:
        data = get_json_body()
        text = validate_text(data.get("text"))
        shift = validate_shift(data.get("shift"))
    except ValidationError as exc:
        return jsonify({"error": str(exc)}), 400

    ciphertext = caesar_encrypt(text, shift)
    return jsonify({
        "result": ciphertext,
        "visualizer": build_visualizer_steps(text, shift, "encrypt"),
        "explanation": build_plain_english_explanation(text, shift, "encrypt"),
        "frequency": {
            "plaintext": letter_frequency(text),
            "ciphertext": letter_frequency(ciphertext),
        },
        "security": SECURITY_PROFILES["caesar"],
    })


@app.route("/api/caesar/decrypt", methods=["POST"])
def api_caesar_decrypt():
    try:
        data = get_json_body()
        text = validate_text(data.get("text"))
        shift = validate_shift(data.get("shift"))
    except ValidationError as exc:
        return jsonify({"error": str(exc)}), 400

    plaintext = caesar_decrypt(text, shift)
    return jsonify({
        "result": plaintext,
        "visualizer": build_visualizer_steps(text, shift, "decrypt"),
        "explanation": build_plain_english_explanation(text, shift, "decrypt"),
        "frequency": {
            "ciphertext": letter_frequency(text),
            "plaintext": letter_frequency(plaintext),
        },
        "security": SECURITY_PROFILES["caesar"],
    })


@app.route("/api/caesar/bruteforce", methods=["POST"])
def api_caesar_bruteforce():
    try:
        data = get_json_body()
        text = validate_text(data.get("text"))
    except ValidationError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"results": brute_force_caesar(text)})


@app.route("/api/caesar/map", methods=["POST"])
def api_caesar_map():
    """Return the live A->D style character mapping for a given shift."""
    try:
        data = get_json_body()
        shift = validate_shift(data.get("shift"))
    except ValidationError as exc:
        return jsonify({"error": str(exc)}), 400

    mapping = {
        letter: shift_character(letter, shift) for letter in string.ascii_uppercase
    }
    return jsonify({"mapping": mapping})


# ---------------------------------------------------------------------------
# Routes - Modern Encryption API
# ---------------------------------------------------------------------------

@app.route("/api/modern/base64", methods=["POST"])
def api_modern_base64():
    try:
        data = get_json_body()
        text = validate_text(data.get("text"))
        mode = data.get("mode", "encode")
    except ValidationError as exc:
        return jsonify({"error": str(exc)}), 400

    try:
        if mode == "encode":
            result = base64.b64encode(text.encode("utf-8")).decode("ascii")
        elif mode == "decode":
            result = base64.b64decode(text.encode("ascii")).decode("utf-8")
        else:
            return jsonify({"error": "Field 'mode' must be 'encode' or 'decode'."}), 400
    except (binascii.Error, UnicodeDecodeError, ValueError):
        return jsonify({"error": "Could not decode input - is it valid Base64?"}), 400

    return jsonify({"result": result, "security": SECURITY_PROFILES["base64"]})


@app.route("/api/modern/rot13", methods=["POST"])
def api_modern_rot13():
    try:
        data = get_json_body()
        text = validate_text(data.get("text"))
    except ValidationError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"result": rot13(text), "security": SECURITY_PROFILES["rot13"]})


@app.route("/api/modern/vigenere", methods=["POST"])
def api_modern_vigenere():
    try:
        data = get_json_body()
        text = validate_text(data.get("text"))
        key = validate_key(data.get("key"))
        mode = data.get("mode", "encrypt")
        if mode not in ("encrypt", "decrypt"):
            raise ValidationError("Field 'mode' must be 'encrypt' or 'decrypt'.")
        result = vigenere_transform(text, key, mode)
    except ValidationError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"result": result, "security": SECURITY_PROFILES["vigenere"]})


@app.route("/api/modern/xor", methods=["POST"])
def api_modern_xor():
    try:
        data = get_json_body()
        text = validate_text(data.get("text"))
        key = validate_key(data.get("key"))
        mode = data.get("mode", "encrypt")
        if mode not in ("encrypt", "decrypt"):
            raise ValidationError("Field 'mode' must be 'encrypt' or 'decrypt'.")

        if mode == "encrypt":
            result = xor_encrypt_to_hex(text, key)
        else:
            result = xor_decrypt_from_hex(text, key)
    except ValidationError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"result": result, "security": SECURITY_PROFILES["xor"]})


@app.route("/api/modern/compare", methods=["POST"])
def api_modern_compare():
    """
    Run the same plaintext through Caesar, ROT13, Vigenere, XOR and Base64
    (using shared demo keys) so the frontend can render a side-by-side
    comparison table alongside their security profiles.
    """
    try:
        data = get_json_body()
        text = validate_text(data.get("text"))
        shift = data.get("shift", 3)
        shift = validate_shift(shift)
        key = data.get("key", "shield")
        key = validate_key(key)
    except ValidationError as exc:
        return jsonify({"error": str(exc)}), 400

    comparison = {
        "caesar": {
            "output": caesar_encrypt(text, shift),
            **SECURITY_PROFILES["caesar"],
        },
        "rot13": {
            "output": rot13(text),
            **SECURITY_PROFILES["rot13"],
        },
        "base64": {
            "output": base64.b64encode(text.encode("utf-8")).decode("ascii"),
            **SECURITY_PROFILES["base64"],
        },
        "vigenere": {
            "output": vigenere_transform(text, key, "encrypt"),
            **SECURITY_PROFILES["vigenere"],
        },
        "xor": {
            "output": xor_encrypt_to_hex(text, key),
            **SECURITY_PROFILES["xor"],
        },
        "aes": SECURITY_PROFILES["aes"],
    }
    return jsonify({"comparison": comparison})


# ---------------------------------------------------------------------------
# Error handlers
# ---------------------------------------------------------------------------

@app.errorhandler(404)
def not_found(_error):
    return jsonify({"error": "Endpoint not found."}), 404


@app.errorhandler(500)
def server_error(_error):
    return jsonify({"error": "An internal server error occurred."}), 500


if __name__ == "__main__":
    app.run(debug=True)
