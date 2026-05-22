from django.shortcuts import render

# Create your views here.
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .utils import (
    LANGUAGES,
    QUICK_LANGS,
    do_translate,
    do_dictionary,
    parse_dict_entry,
    json_error,
    parse_json_body,
)


def index(request):
    context = {
        "languages": LANGUAGES,
        "quick_langs": QUICK_LANGS,
    }
    return render(request, "translator/index.html", context)


@csrf_exempt
@require_POST
def translate_text(request):
    data, err = parse_json_body(request)
    if err:
        return json_error(err)

    text = data.get("text", "").strip()
    source = data.get("source", "auto")
    target = data.get("target", "bn")

    if not text:
        return json_error("No text provided")
    if len(text) > 5000:
        return json_error("Text too long. Maximum 5000 characters allowed.")
    if source == target and source != "auto":
        return json_error("Source and target language are the same")

    try:
        translated = do_translate(text, source, target)
        return JsonResponse(
            {
                "translated": translated,
                "source": source,
                "target": target,
                "char_count": len(text),
                "translated_count": len(translated),
            }
        )
    except Exception as e:
        return json_error(str(e), 500)


@csrf_exempt
@require_POST
def dictionary_lookup(request):
    data, err = parse_json_body(request)
    if err:
        return json_error(err)

    word = data.get("word", "").strip().lower()
    if not word:
        return json_error("No word provided")
    if " " in word:
        return json_error("Dictionary is for single words only")
    if len(word) > 60:
        return json_error("Word too long")

    try:
        raw, err = do_dictionary(word)
        if err:
            return json_error(err, 404)
        result = parse_dict_entry(raw[0])
        return JsonResponse(result)
    except Exception as e:
        return json_error(str(e), 500)


@csrf_exempt
@require_POST
def detect_language(request):
    data, err = parse_json_body(request)
    if err:
        return json_error(err)

    text = data.get("text", "").strip()
    if not text:
        return json_error("No text provided")

    try:
        from .utils import detect_lang
        result = detect_lang(text[:200])
        
        return JsonResponse({"detected": "auto", "sample_translation": result})
    except Exception as e:
        return json_error(str(e), 500)


@csrf_exempt
@require_POST
def text_to_speech(request):
    """Returns TTS audio URL via browser SpeechSynthesis (handled client-side)."""
    data, err = parse_json_body(request)
    if err:
        return json_error(err)
    text = data.get("text", "").strip()
    lang = data.get("lang", "en")
    if not text:
        return json_error("No text provided")
    return JsonResponse({"text": text, "lang": lang, "method": "browser_tts"})