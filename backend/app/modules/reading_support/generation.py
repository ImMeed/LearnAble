from __future__ import annotations

from collections import Counter

from app.modules.ai import repository as ai_repository
from app.modules.reading_support.catalog import get_game

_ROUND_COUNT = 4
_ARABIC_INDIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
_ENGLISH_WORD_BANK = ["cat", "sun", "book", "train", "lamp", "reading", "nest", "stone"]
_ARABIC_WORD_BANK = ["قمر", "بيت", "نور", "كتاب", "شمس", "قلم", "علم", "سيارة"]
_ENGLISH_SEQUENCE_NUMBERS = ["1", "2", "3", "4", "5", "6", "7", "8"]
_ARABIC_SEQUENCE_NUMBERS = ["١", "٢", "٣", "٤", "٥", "٦", "٧", "٨"]
_ENGLISH_VISUAL_GROUPS = {
    "b": ["d", "p", "q"],
    "d": ["b", "p", "q"],
    "p": ["b", "d", "q"],
    "q": ["b", "d", "p"],
    "m": ["n", "w", "h"],
    "n": ["m", "h", "u"],
    "g": ["q", "y", "j"],
    "t": ["f", "l", "i"],
    "3": ["8", "5", "2"],
    "8": ["3", "6", "0"],
}
_ARABIC_VISUAL_GROUPS = {
    "ب": ["ت", "ث", "ن"],
    "ت": ["ب", "ث", "ن"],
    "ج": ["ح", "خ", "د"],
    "ص": ["ض", "س", "ش"],
    "ذ": ["د", "ز", "ر"],
    "٣": ["٨", "٢", "٥"],
    "٨": ["٣", "٦", "٠"],
}


def _response_schema(game_key: str) -> dict:
    if game_key in {"word_building", "sequencing"}:
        return {
            "type": "object",
            "properties": {
                "rounds": {
                    "type": "array",
                    "minItems": _ROUND_COUNT,
                    "maxItems": _ROUND_COUNT,
                    "items": {
                        "type": "object",
                        "properties": {
                            "prompt": {"type": "string"},
                            "display_text": {"type": "string"},
                            "instruction": {"type": "string"},
                            "items": {
                                "type": "array",
                                "minItems": 2,
                                "maxItems": 6,
                                "items": {"type": "string"},
                            },
                            "correct_answer": {
                                "type": "array",
                                "minItems": 2,
                                "maxItems": 6,
                                "items": {"type": "string"},
                            },
                            "feedback": {"type": "string"},
                            "audio_text": {"type": "string"},
                        },
                        "required": ["prompt", "items", "correct_answer", "feedback"],
                        "additionalProperties": False,
                    },
                }
            },
            "required": ["rounds"],
            "additionalProperties": False,
        }

    return {
        "type": "object",
        "properties": {
            "rounds": {
                "type": "array",
                "minItems": _ROUND_COUNT,
                "maxItems": _ROUND_COUNT,
                "items": {
                    "type": "object",
                    "properties": {
                        "prompt": {"type": "string"},
                        "display_text": {"type": "string"},
                        "instruction": {"type": "string"},
                        "items": {
                            "type": "array",
                            "minItems": 3,
                            "maxItems": 5,
                            "items": {"type": "string"},
                        },
                        "correct_answer": {"type": "string"},
                        "feedback": {"type": "string"},
                        "audio_text": {"type": "string"},
                    },
                    "required": ["prompt", "items", "correct_answer", "feedback"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["rounds"],
        "additionalProperties": False,
    }


def _game_rules(game_key: str) -> str:
    if game_key == "letter_discrimination":
        return (
            "Build visual discrimination rounds around easily-confused letters or numbers. "
            "Use one clear target symbol in display_text and 4 answer options. "
            "Make distractors visually similar to the target."
        )
    if game_key == "word_building":
        return (
            "Create short decodable words. Return letter or syllable tiles in scrambled order. "
            "audio_text must be the final spoken word. correct_answer must be the right order."
        )
    if game_key == "missing_letter":
        return (
            "Show one short word with a missing letter or syllable using an underscore placeholder in display_text. "
            "Provide 3 answer options with one correct answer."
        )
    if game_key == "sound_to_word":
        return (
            "audio_text is required for every round. Use short words with clearly different distractors. "
            "Provide 3 answer options and keep the correct answer inside items."
        )
    return (
        "Create sequencing rounds using letters, syllables, or simple number patterns. "
        "items should be shuffled and correct_answer should be the intended order."
    )


def _default_instruction(locale: str, game_key: str) -> str:
    if locale == "en":
        instructions = {
            "letter_discrimination": "Look carefully before you choose.",
            "word_building": "Listen, then build the word from left to right.",
            "missing_letter": "Find the missing sound or letter.",
            "sound_to_word": "Listen first, then match the correct word.",
            "sequencing": "Put the pieces in the correct order.",
        }
        return instructions[game_key]

    instructions = {
        "letter_discrimination": "انظر جيدا ثم اختر.",
        "word_building": "استمع ثم رتب الكلمة من البداية إلى النهاية.",
        "missing_letter": "ابحث عن الحرف أو المقطع الناقص.",
        "sound_to_word": "استمع أولا ثم اختر الكلمة الصحيحة.",
        "sequencing": "رتب العناصر بالترتيب الصحيح.",
    }
    return instructions[game_key]


def _default_feedback(locale: str, is_audio: bool) -> str:
    if locale == "en":
        return "Strong work. Keep matching the sounds and shapes carefully." if is_audio else "Nice try. Careful step-by-step practice helps."
    return "عمل رائع. واصل الربط بين الأصوات والأشكال بعناية." if is_audio else "محاولة جيدة. التدريب الهادئ خطوة بخطوة يساعدك."


def _optional_text(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _clean_list(values: object) -> list[str]:
    if not isinstance(values, list):
        return []
    cleaned: list[str] = []
    for raw in values:
        text = str(raw).strip()
        if text:
            cleaned.append(text)
    return cleaned


def _dedupe(values: list[str]) -> list[str]:
    unique: list[str] = []
    seen: set[str] = set()
    for raw in values:
        text = str(raw).strip()
        if not text:
            continue
        key = text.casefold()
        if key in seen:
            continue
        seen.add(key)
        unique.append(text)
    return unique


def _word_bank(locale: str, focus_words: list[str]) -> list[str]:
    defaults = _ENGLISH_WORD_BANK if locale == "en" else _ARABIC_WORD_BANK
    combined = _dedupe([*focus_words, *defaults])
    return [word for word in combined if len(word.replace(" ", "")) >= 2]


def _word_tiles(word: str) -> list[str]:
    return [char for char in word if not char.isspace()]


def _scramble_tokens(tokens: list[str]) -> list[str]:
    if len(tokens) <= 1:
        return list(tokens)
    rotated = [*tokens[1:], tokens[0]]
    if rotated != tokens:
        return rotated
    reversed_tokens = list(reversed(tokens))
    return reversed_tokens if reversed_tokens != tokens else list(tokens)


def _single_choice_items(correct_answer: str, distractors: list[str]) -> list[str]:
    ordered = _dedupe([distractors[0] if distractors else correct_answer, correct_answer, *distractors[1:]])
    return ordered[: max(3, len(ordered))]


def _normalize_numeric_token(value: str) -> int | None:
    cleaned = value.translate(_ARABIC_INDIC_DIGITS)
    return int(cleaned) if cleaned.isdigit() else None


def _numeric_sort_key(value: str) -> tuple[int, str]:
    normalized = _normalize_numeric_token(value)
    return (normalized if normalized is not None else 10_000, value)


def _build_letter_discrimination_rounds(locale: str, focus_letters: list[str], focus_numbers: list[str]) -> list[dict] | None:
    defaults = ["b", "m", "g", "t"] if locale == "en" else ["ب", "ج", "ص", "ذ"]
    groups = _ENGLISH_VISUAL_GROUPS if locale == "en" else _ARABIC_VISUAL_GROUPS
    targets = _dedupe([*focus_letters, *focus_numbers, *defaults])[:_ROUND_COUNT]
    if not targets:
        return None

    rounds: list[dict] = []
    for target in targets:
        distractors = _dedupe([*(groups.get(target, [])), *defaults, *focus_letters, *focus_numbers])
        distractors = [item for item in distractors if item != target][:3]
        if len(distractors) < 3:
            continue
        rounds.append(
            {
                "prompt": "Pick the matching symbol" if locale == "en" else "اختر الرمز المطابق",
                "display_text": target,
                "instruction": _default_instruction(locale, "letter_discrimination"),
                "items": _single_choice_items(target, distractors),
                "interaction": "single_choice",
                "correct_answer": target,
                "feedback": _default_feedback(locale, False),
                "audio_text": None,
            }
        )
    return rounds if len(rounds) == _ROUND_COUNT else None


def _build_word_building_rounds(locale: str, focus_words: list[str]) -> list[dict] | None:
    words = _word_bank(locale, focus_words)[:_ROUND_COUNT]
    rounds: list[dict] = []
    for word in words:
        letters = _word_tiles(word)
        if len(letters) < 2:
            continue
        rounds.append(
            {
                "prompt": "Arrange the letters to build the word" if locale == "en" else "رتب الحروف لتكوين الكلمة",
                "display_text": word,
                "instruction": _default_instruction(locale, "word_building"),
                "items": _scramble_tokens(letters),
                "interaction": "ordered_tiles",
                "correct_answer": letters,
                "feedback": _default_feedback(locale, True),
                "audio_text": word,
            }
        )
    return rounds if len(rounds) == _ROUND_COUNT else None


def _build_missing_letter_rounds(locale: str, focus_words: list[str]) -> list[dict] | None:
    words = _word_bank(locale, focus_words)[:_ROUND_COUNT]
    fallback_choices = ["a", "o", "i", "u", "e"] if locale == "en" else ["ا", "و", "ي", "م", "ر"]
    rounds: list[dict] = []
    for word in words:
        letters = _word_tiles(word)
        if len(letters) < 3:
            continue
        missing_index = max(1, len(letters) // 2)
        correct = letters[missing_index]
        display = "".join(letters[:missing_index] + ["_"] + letters[missing_index + 1 :])
        distractors = _dedupe([*(item for item in letters if item != correct), *fallback_choices])
        distractors = [item for item in distractors if item != correct][:2]
        if len(distractors) < 2:
            continue
        rounds.append(
            {
                "prompt": "Complete the word" if locale == "en" else "أكمل الكلمة",
                "display_text": display,
                "instruction": _default_instruction(locale, "missing_letter"),
                "items": _single_choice_items(correct, distractors),
                "interaction": "single_choice",
                "correct_answer": correct,
                "feedback": _default_feedback(locale, False),
                "audio_text": None,
            }
        )
    return rounds if len(rounds) == _ROUND_COUNT else None


def _build_sound_to_word_rounds(locale: str, focus_words: list[str]) -> list[dict] | None:
    words = _word_bank(locale, focus_words)
    if len(words) < _ROUND_COUNT:
        return None

    rounds: list[dict] = []
    for index, word in enumerate(words[:_ROUND_COUNT]):
        distractors = [candidate for candidate in words if candidate.casefold() != word.casefold()]
        items = _single_choice_items(word, distractors[:2])
        if len(items) < 3:
            continue
        rounds.append(
            {
                "prompt": "Listen and choose the correct word" if locale == "en" else "استمع واختر الكلمة الصحيحة",
                "display_text": None,
                "instruction": _default_instruction(locale, "sound_to_word"),
                "items": items,
                "interaction": "single_choice",
                "correct_answer": word,
                "feedback": _default_feedback(locale, True),
                "audio_text": word,
            }
        )
    return rounds if len(rounds) == _ROUND_COUNT else None


def _build_sequencing_rounds(locale: str, focus_words: list[str], focus_numbers: list[str]) -> list[dict] | None:
    if focus_numbers:
        defaults = _ENGLISH_SEQUENCE_NUMBERS if locale == "en" else _ARABIC_SEQUENCE_NUMBERS
        pool = _dedupe([*focus_numbers, *defaults])
        if len(pool) < _ROUND_COUNT:
            return None

        rounds: list[dict] = []
        for index in range(_ROUND_COUNT):
            rotated = [*pool[index:], *pool[:index]]
            correct_answer = sorted(rotated[:4], key=_numeric_sort_key)
            rounds.append(
                {
                    "prompt": "Order the numbers from smallest to largest" if locale == "en" else "رتب الأرقام من الأصغر إلى الأكبر",
                    "display_text": "Start with the smallest number" if locale == "en" else "ابدأ بالرقم الأصغر",
                    "instruction": _default_instruction(locale, "sequencing"),
                    "items": _scramble_tokens(correct_answer),
                    "interaction": "ordered_tiles",
                    "correct_answer": correct_answer,
                    "feedback": _default_feedback(locale, False),
                    "audio_text": None,
                }
            )
        return rounds

    words = _word_bank(locale, focus_words)[:_ROUND_COUNT]
    rounds: list[dict] = []
    for word in words:
        letters = _word_tiles(word)
        if len(letters) < 2:
            continue
        rounds.append(
            {
                "prompt": "Put the pieces in the right order" if locale == "en" else "رتب العناصر بالترتيب الصحيح",
                "display_text": word,
                "instruction": _default_instruction(locale, "sequencing"),
                "items": _scramble_tokens(letters),
                "interaction": "ordered_tiles",
                "correct_answer": letters,
                "feedback": _default_feedback(locale, False),
                "audio_text": None,
            }
        )
    return rounds if len(rounds) == _ROUND_COUNT else None


def _build_focus_profile_rounds(
    *,
    locale: str,
    game_key: str,
    focus_letters: list[str],
    focus_words: list[str],
    focus_numbers: list[str],
) -> list[dict] | None:
    if game_key == "letter_discrimination":
        return _build_letter_discrimination_rounds(locale, focus_letters, focus_numbers)
    if game_key == "word_building" and focus_words:
        return _build_word_building_rounds(locale, focus_words)
    if game_key == "missing_letter" and focus_words:
        return _build_missing_letter_rounds(locale, focus_words)
    if game_key == "sound_to_word" and focus_words:
        return _build_sound_to_word_rounds(locale, focus_words)
    if game_key == "sequencing" and (focus_words or focus_numbers):
        return _build_sequencing_rounds(locale, focus_words, focus_numbers)
    return None


def _round_matches_focus_word(game_key: str, round_payload: dict, focus_word: str) -> bool:
    target = focus_word.strip().casefold()
    if not target:
        return False

    candidates: list[str] = []
    if game_key == "word_building":
        audio_text = _optional_text(round_payload.get("audio_text"))
        if audio_text:
            candidates.append(audio_text)
        candidates.append("".join(_clean_list(round_payload.get("correct_answer"))))
    elif game_key == "sound_to_word":
        candidates.append(_optional_text(round_payload.get("correct_answer")) or "")
        candidates.extend(_clean_list(round_payload.get("items")))
    else:
        display_text = _optional_text(round_payload.get("display_text"))
        if display_text:
            candidates.append(display_text.replace("_", ""))
        candidates.append(_optional_text(round_payload.get("audio_text")) or "")
        correct_answer = round_payload.get("correct_answer")
        if isinstance(correct_answer, list):
            candidates.append("".join(_clean_list(correct_answer)))
        else:
            candidates.append(_optional_text(correct_answer) or "")

    normalized = [candidate.replace(" ", "").casefold() for candidate in candidates if candidate]
    focus_target = target.replace(" ", "")
    return any(focus_target == candidate for candidate in normalized)


def _covers_priority_focus_words(game_key: str, rounds: list[dict], focus_words: list[str]) -> bool:
    if game_key not in {"word_building", "sound_to_word", "missing_letter", "sequencing"}:
        return True

    priority_words = _dedupe(focus_words)[: min(_ROUND_COUNT, len(focus_words))]
    if not priority_words:
        return True

    return all(
        any(_round_matches_focus_word(game_key, round_payload, focus_word) for round_payload in rounds)
        for focus_word in priority_words
    )


def _build_prompt(
    *,
    locale: str,
    game_key: str,
    title: str,
    description: str,
    focus_letters: list[str],
    focus_words: list[str],
    focus_numbers: list[str],
    support_notes: str,
) -> str:
    language_name = "English" if locale == "en" else "Arabic"
    focus_letters_line = ", ".join(focus_letters) if focus_letters else "none"
    focus_words_line = ", ".join(focus_words) if focus_words else "none"
    focus_numbers_line = ", ".join(focus_numbers) if focus_numbers else "none"
    notes_line = support_notes.strip() or "none"
    return (
        "You are designing one short, encouraging dyslexia-support practice session for a child. "
        "Do not mention diagnosis, disorder labels, medicine, or therapy claims. "
        "Return JSON only, matching the provided schema exactly.\n"
        f"Output language: {language_name}.\n"
        f"Game key: {game_key}.\n"
        f"Game title: {title}.\n"
        f"Game description: {description}.\n"
        f"Focus letters: {focus_letters_line}.\n"
        f"Focus words: {focus_words_line}.\n"
        f"Focus numbers: {focus_numbers_line}.\n"
        f"Parent/psychologist notes: {notes_line}.\n"
        f"Game-specific rules: {_game_rules(game_key)}\n"
        "General rules:\n"
        "- Generate exactly 4 rounds.\n"
        "- Keep prompts and feedback short, warm, and easy to understand.\n"
        "- Prefer beginner-friendly words and concrete vocabulary.\n"
        "- If focus words exist, use those exact words in the rounds whenever natural.\n"
        "- If focus letters exist, use them in targets, words, or distractors where natural.\n"
        "- If focus numbers exist, use them mainly in sequencing or visual discrimination where natural.\n"
        "- Avoid duplicate rounds.\n"
        "- Ensure correct_answer is exact and valid for the round.\n"
        "- Keep all content safe for children and school-friendly.\n"
    )


def _validate_single_choice_round(game_key: str, locale: str, payload: dict) -> dict | None:
    items = _clean_list(payload.get("items"))
    if len(items) < 3:
        return None

    correct_answer = _optional_text(payload.get("correct_answer"))
    if not correct_answer or correct_answer not in items:
        return None

    prompt = _optional_text(payload.get("prompt")) or (
        "Pick the correct answer" if locale == "en" else "اختر الإجابة الصحيحة"
    )
    display_text = _optional_text(payload.get("display_text"))
    audio_text = _optional_text(payload.get("audio_text"))

    if game_key == "letter_discrimination" and display_text is None:
        display_text = correct_answer
    if game_key == "sound_to_word" and audio_text is None:
        audio_text = correct_answer
    if game_key == "missing_letter" and display_text is None:
        return None

    return {
        "prompt": prompt,
        "display_text": display_text,
        "instruction": _optional_text(payload.get("instruction")) or _default_instruction(locale, game_key),
        "items": items,
        "interaction": "single_choice",
        "correct_answer": correct_answer,
        "feedback": _optional_text(payload.get("feedback")) or _default_feedback(locale, bool(audio_text)),
        "audio_text": audio_text,
    }


def _validate_ordered_round(game_key: str, locale: str, payload: dict) -> dict | None:
    items = _clean_list(payload.get("items"))
    correct_answer = _clean_list(payload.get("correct_answer"))
    if len(items) < 2 or len(items) != len(correct_answer):
        return None
    if Counter(items) != Counter(correct_answer):
        return None

    prompt = _optional_text(payload.get("prompt")) or (
        "Put the pieces in the right order" if locale == "en" else "رتب العناصر بالترتيب الصحيح"
    )
    audio_text = _optional_text(payload.get("audio_text"))
    if game_key == "word_building" and audio_text is None:
        audio_text = "".join(correct_answer)
    display_text = _optional_text(payload.get("display_text")) or audio_text

    return {
        "prompt": prompt,
        "display_text": display_text,
        "instruction": _optional_text(payload.get("instruction")) or _default_instruction(locale, game_key),
        "items": items,
        "interaction": "ordered_tiles",
        "correct_answer": correct_answer,
        "feedback": _optional_text(payload.get("feedback")) or _default_feedback(locale, bool(audio_text)),
        "audio_text": audio_text,
    }


def _validate_rounds(game_key: str, locale: str, payload: object) -> list[dict] | None:
    if not isinstance(payload, list) or len(payload) < _ROUND_COUNT:
        return None

    normalized: list[dict] = []
    for raw_round in payload[:_ROUND_COUNT]:
        if not isinstance(raw_round, dict):
            return None
        if game_key in {"word_building", "sequencing"}:
            round_payload = _validate_ordered_round(game_key, locale, raw_round)
        else:
            round_payload = _validate_single_choice_round(game_key, locale, raw_round)
        if round_payload is None:
            return None
        normalized.append(round_payload)
    return normalized


def build_personalized_rounds(
    *,
    locale: str,
    game_key: str,
    focus_letters: list[str],
    focus_words: list[str],
    focus_numbers: list[str],
    support_notes: str,
) -> dict:
    game = get_game(locale, game_key)
    if game is None:
        return {"rounds": [], "content_source": "fallback"}

    prompt = _build_prompt(
        locale=locale,
        game_key=game_key,
        title=game["title"],
        description=game["description"],
        focus_letters=focus_letters,
        focus_words=focus_words,
        focus_numbers=focus_numbers,
        support_notes=support_notes,
    )
    generated = ai_repository.generate_json(prompt, _response_schema(game_key))
    validated = _validate_rounds(game_key, locale, (generated or {}).get("rounds"))
    if validated and _covers_priority_focus_words(game_key, validated, focus_words):
        return {"rounds": validated, "content_source": "ai"}

    focus_profile_rounds = _build_focus_profile_rounds(
        locale=locale,
        game_key=game_key,
        focus_letters=focus_letters,
        focus_words=focus_words,
        focus_numbers=focus_numbers,
    )
    if focus_profile_rounds:
        return {"rounds": focus_profile_rounds, "content_source": "fallback"}

    return {"rounds": game["rounds"], "content_source": "fallback"}
