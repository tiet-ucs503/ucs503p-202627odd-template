"""The six bosses and the maths topic each one teaches. Order = unlock order."""
from typing import Dict, List, Optional

BOSSES: List[Dict[str, str]] = [
    {"id": "goblin", "name": "Green Goblin", "topic": "linear_equations", "label": "Algebra (Linear Equations)"},
    {"id": "doc-ock", "name": "Doctor Octopus", "topic": "area_perimeter", "label": "Geometry (Area & Perimeter)"},
    {"id": "mysterio", "name": "Mysterio", "topic": "sequences_patterns", "label": "Number Patterns & Sequences"},
    {"id": "venom", "name": "Venom", "topic": "percentages", "label": "Percentages"},
    {"id": "lizard", "name": "The Lizard", "topic": "exponents_radicals", "label": "Exponents & Radicals"},
    {"id": "kingpin", "name": "Kingpin", "topic": "ratios_proportions", "label": "Ratios & Proportions"},
]

BOSS_IDS: List[str] = [b["id"] for b in BOSSES]
_BY_ID = {b["id"]: b for b in BOSSES}
_BY_TOPIC = {b["topic"]: b for b in BOSSES}


def get_boss(boss_id: str) -> Optional[Dict[str, str]]:
    return _BY_ID.get(boss_id)


def boss_for_topic(topic: str) -> Dict[str, str]:
    return _BY_TOPIC[topic]


def unlocked_bosses(level: int) -> List[str]:
    """A student at level N may play the first N bosses."""
    return BOSS_IDS[: max(1, min(level, len(BOSS_IDS)))]
