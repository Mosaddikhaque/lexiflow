import requests
from deep_translator import GoogleTranslator
from django.http import JsonResponse
import json


LANGUAGES = {
    "auto": "Auto Detect",
    "en": "English",
    "bn": "Bengali (বাংলা)",
    "hi": "Hindi (हिंदी)",
    "ar": "Arabic (العربية)",
    "zh-CN": "Chinese (中文)",
    "fr": "French",
    "de": "German",
    "es": "Spanish",
    "pt": "Portuguese",
    "ru": "Russian",
    "ja": "Japanese (日本語)",
    "ko": "Korean (한국어)",
    "it": "Italian",
    "tr": "Turkish",
    "nl": "Dutch",
    "pl": "Polish",
    "sv": "Swedish",
    "uk": "Ukrainian",
    "fa": "Persian (فارسی)",
    "ur": "Urdu (اردو)",
    "id": "Indonesian",
    "th": "Thai (ภาษาไทย)",
    "vi": "Vietnamese",
    "ro": "Romanian",
    "hu": "Hungarian",
}

QUICK_LANGS = [
    {"code": "bn", "label": "বাংলা"},
    {"code": "en", "label": "English"},
    {"code": "hi", "label": "हिंदी"},
    {"code": "ar", "label": "العربية"},
    {"code": "fr", "label": "Français"},
    {"code": "zh-CN", "label": "中文"},
    {"code": "ja", "label": "日本語"},
    {"code": "es", "label": "Español"},
    {"code": "de", "label": "Deutsch"},
    {"code": "ru", "label": "Русский"},
]


def do_translate(text, source, target):
    """Translate text using GoogleTranslator."""
    translator = GoogleTranslator(source=source, target=target)
    return translator.translate(text)


def do_dictionary(word):
    """Fetch dictionary data from Free Dictionary API."""
    url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}"
    response = requests.get(url, timeout=10)
    if response.status_code == 404:
        return None, f'"{word}" not found in dictionary'
    if response.status_code != 200:
        return None, "Dictionary service unavailable"
    return response.json(), None


def parse_dict_entry(entry):
    """Parse raw dictionary API response into clean structure."""
    result = {
        "word": entry.get("word", ""),
        "phonetic": entry.get("phonetic", ""),
        "phonetics": [p for p in entry.get("phonetics", []) if p.get("text")],
        "audio": next(
            (p["audio"] for p in entry.get("phonetics", []) if p.get("audio")), ""
        ),
        "meanings": [],
        "synonyms": [],
        "antonyms": [],
        "origin": entry.get("origin", ""),
    }

    all_synonyms = set()
    all_antonyms = set()

    for meaning in entry.get("meanings", []):
        definitions = []
        for defn in meaning.get("definitions", [])[:4]:
            definitions.append(
                {
                    "definition": defn.get("definition", ""),
                    "example": defn.get("example", ""),
                    "synonyms": defn.get("synonyms", [])[:6],
                    "antonyms": defn.get("antonyms", [])[:6],
                }
            )
            all_synonyms.update(defn.get("synonyms", [])[:4])
            all_antonyms.update(defn.get("antonyms", [])[:4])

        result["meanings"].append(
            {
                "partOfSpeech": meaning.get("partOfSpeech", ""),
                "definitions": definitions,
            }
        )
        all_synonyms.update(meaning.get("synonyms", [])[:6])
        all_antonyms.update(meaning.get("antonyms", [])[:6])

    result["synonyms"] = list(all_synonyms)[:12]
    result["antonyms"] = list(all_antonyms)[:12]
    return result


def json_error(message, status=400):
    return JsonResponse({"error": message}, status=status)


def parse_json_body(request):
    try:
        return json.loads(request.body), None
    except (json.JSONDecodeError, ValueError):
        return None, "Invalid JSON"
    
def detect_lang(text):
    """Detect language automatically."""
    try:
        return GoogleTranslator(source="auto", target="en").translate(text)
    except Exception:
        return None