from __future__ import annotations

from dataclasses import dataclass


@dataclass
class PolicyResult:
    text: str
    blocked: bool
    policy_applied: bool


_DIAGNOSIS_PATTERNS = [
    "diagnosis",
    "diagnose",
    "adhd",
    "autism",
    "dyslexia diagnosis",
    "تشخيص",
    "تشخّص",
    "اضطراب",
    "فرط الحركة",
    "طيف التوحد",
]

_EN_REFUSAL = (
    "I can only provide educational support and cannot offer medical or psychological diagnosis. "
    "Please consult a qualified professional for clinical evaluation."
)

_AR_REFUSAL = "لا يمكنني تقديم تشخيص طبي أو نفسي. يمكنني تقديم دعم تعليمي فقط، ويُنصح بالرجوع إلى مختص مؤهل للتقييم السريري."

_EN_DISCLAIMER = "Educational guidance only; this is not a medical or psychological diagnosis."
_AR_DISCLAIMER = "إرشاد تعليمي فقط؛ هذا ليس تشخيصاً طبياً أو نفسياً."


def _contains_diagnosis_content(text: str) -> bool:
    value = text.lower()
    return any(token in value for token in _DIAGNOSIS_PATTERNS)


def enforce_input_policy(text: str, locale: str) -> PolicyResult:
    blocked = _contains_diagnosis_content(text)
    if blocked:
        refusal = _EN_REFUSAL if locale == "en" else _AR_REFUSAL
        return PolicyResult(text=refusal, blocked=True, policy_applied=True)
    return PolicyResult(text=text, blocked=False, policy_applied=False)


def enforce_output_policy(text: str, locale: str) -> PolicyResult:
    if _contains_diagnosis_content(text):
        refusal = _EN_REFUSAL if locale == "en" else _AR_REFUSAL
        return PolicyResult(text=refusal, blocked=True, policy_applied=True)

    disclaimer = _EN_DISCLAIMER if locale == "en" else _AR_DISCLAIMER
    if disclaimer in text:
        return PolicyResult(text=text, blocked=False, policy_applied=False)

    separator = "\n\n"
    return PolicyResult(text=f"{text}{separator}{disclaimer}", blocked=False, policy_applied=True)
