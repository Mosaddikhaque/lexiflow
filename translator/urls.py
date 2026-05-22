from django.urls import path
from . import views

app_name = "translator"

urlpatterns = [
    path("", views.index, name="index"),
    path("api/translate/", views.translate_text, name="translate"),
    path("api/dictionary/", views.dictionary_lookup, name="dictionary"),
    path("api/detect/", views.detect_language, name="detect"),
    path("api/tts/", views.text_to_speech, name="tts"),
]