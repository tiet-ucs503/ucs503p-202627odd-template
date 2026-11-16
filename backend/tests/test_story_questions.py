"""
Story questions and the backup bank.

Every villain has six stories of their own (two per tier), built from random
numbers with computed answers, and six fixed backup questions that are used
only if the generator fails. Nothing here depends on any AI service.
"""
import random
import re

import pytest

from services import question_bank, questions
from services.curriculum import BOSS_IDS, BOSSES
from services.question_bank import BANK, backup_question, question_or_backup
from services.questions import DIFFICULTIES, generate_question
from services.story_questions import STORIES
from tests.test_questions import solve

SEEDS = range(200)

# Words that tie a story to its villain's own world.
WORLD = {
    "goblin": r"Goblin|Oscorp|Osborn|pumpkin|[Gg]lider",
    "doc-ock": r"Doc Ock|Doctor Octopus|Octavius|arms|reactor",
    "mysterio": r"Mysterio|Beck|illusion|hologram|fishbowl|mirror|smoke",
    "venom": r"Venom|symbiote|Eddie Brock",
    "lizard": r"Lizard|Connors|serum|reptile|sewer",
    "kingpin": r"Kingpin|Fisk|Vanessa|Hammerhead",
}
OTHERS = {boss: "|".join(v for b, v in {
    "goblin": "Goblin|Osborn", "doc-ock": "Doc Ock|Octavius", "mysterio": "Mysterio|Beck",
    "venom": "Venom|Eddie Brock", "lizard": "Lizard|Connors", "kingpin": "Kingpin|Fisk",
}.items() if b != boss) for boss in BOSS_IDS}


def body_lines(text: str):
    """The lines of a question after its title."""
    return [line for line in text.split("\n")[1:] if line.strip()]


def story_questions(boss_id, tier):
    for story in STORIES[boss_id][tier]:
        for seed in SEEDS:
            yield story.__name__, story(random.Random(seed))


# ── the stories ──────────────────────────────────────────────────────────────
def test_every_villain_has_six_stories_two_per_tier():
    assert set(STORIES) == set(BOSS_IDS)
    for boss_id in BOSS_IDS:
        assert {tier: len(STORIES[boss_id][tier]) for tier in DIFFICULTIES} == {"easy": 2, "medium": 2, "hard": 2}
    all_stories = [s for tiers in STORIES.values() for group in tiers.values() for s in group]
    assert len(all_stories) == len(set(all_stories)) == 36  # no story is reused


@pytest.mark.parametrize("boss_id", BOSS_IDS)
@pytest.mark.parametrize("tier", DIFFICULTIES)
def test_story_answers_are_correct_and_options_are_sound(boss_id, tier):
    for name, q in story_questions(boss_id, tier):
        answer = solve(boss_id, q.text)
        assert q.options[q.correct_index] == str(answer), (name, q.text, q.options)
        assert len(q.options) == 4 and len(set(q.options)) == 4, (name, q.options)
        assert answer > 0, (name, q.text)
        assert q.hint and not re.search(rf"(is|=|equals|answer:?)\s*{answer}\b\.?$", q.hint), (name, q.hint)


@pytest.mark.parametrize("boss_id", BOSS_IDS)
def test_stories_belong_to_their_own_villain(boss_id):
    for tier in DIFFICULTIES:
        for name, q in story_questions(boss_id, tier):
            assert re.search(WORLD[boss_id], q.text), (name, q.text)
            assert not re.search(OTHERS[boss_id], q.text), (name, q.text)


@pytest.mark.parametrize("boss_id", BOSS_IDS)
def test_stories_are_short(boss_id):
    for tier in DIFFICULTIES:
        for name, q in story_questions(boss_id, tier):
            lines = body_lines(q.text)
            assert len(lines) <= 3, (name, q.text)
            assert sum(len(line) for line in lines) <= 200, (name, q.text)


@pytest.mark.parametrize("boss_id", BOSS_IDS)
def test_stories_within_a_villain_are_all_different(boss_id):
    shapes = set()
    for tier in DIFFICULTIES:
        for story in STORIES[boss_id][tier]:
            shapes.add(re.sub(r"\d+", "N", story(random.Random(1)).text))
    assert len(shapes) == 6


def test_the_game_mixes_stories_with_plain_questions():
    for boss_id in BOSS_IDS:
        for tier in DIFFICULTIES:
            titles = {generate_question(boss_id, tier, rng=random.Random(seed)).text.split("\n")[0] for seed in range(120)}
            story_titles = {s(random.Random(0)).text.split("\n")[0] for s in STORIES[boss_id][tier]}
            assert story_titles <= titles, (boss_id, tier)  # both stories turn up
            assert titles - story_titles, (boss_id, tier)  # and so do the plain questions


def test_stories_change_their_numbers_every_time():
    for boss_id in BOSS_IDS:
        for tier in DIFFICULTIES:
            for story in STORIES[boss_id][tier]:
                assert len({story(random.Random(seed)).text for seed in range(40)}) >= 4, story.__name__


# ── the backup bank ──────────────────────────────────────────────────────────
def test_every_villain_has_six_backup_questions_two_per_tier():
    assert set(BANK) == set(BOSS_IDS)
    for boss_id in BOSS_IDS:
        assert sorted(q.difficulty for q in BANK[boss_id]) == sorted(list(DIFFICULTIES) * 2)
    texts = [q.text for group in BANK.values() for q in group]
    assert len(texts) == len(set(texts)) == 36


@pytest.mark.parametrize("boss_id", BOSS_IDS)
def test_every_backup_question_is_correct_short_and_in_character(boss_id):
    for q in BANK[boss_id]:
        assert solve(boss_id, q.text) == q.answer, q.text
        assert len(q.wrong) == 3 and len({q.answer, *q.wrong}) == 4, q.text
        assert all(w > 0 for w in q.wrong), q.text
        assert len(body_lines(q.text)) <= 3, q.text
        assert re.search(WORLD[boss_id], q.text) and not re.search(OTHERS[boss_id], q.text), q.text
        assert q.hint and not re.search(rf"(is|=|equals|answer:?)\s*{q.answer}\b\.?$", q.hint), q.hint


@pytest.mark.parametrize("boss_id", BOSS_IDS)
@pytest.mark.parametrize("tier", DIFFICULTIES)
def test_a_backup_question_is_served_ready_to_play(boss_id, tier):
    seen, positions = set(), set()
    for seed in range(60):
        q = backup_question(boss_id, tier, rng=random.Random(seed))
        assert q.difficulty == tier and len(set(q.options)) == 4
        assert q.options[q.correct_index] == str(solve(boss_id, q.text))
        seen.add(q.text)
        positions.add(q.correct_index)
    assert len(seen) == 2  # both questions of the tier are used
    assert positions == {0, 1, 2, 3}  # and the answer moves around


def test_backup_rejects_an_unknown_villain_or_tier():
    with pytest.raises(ValueError):
        backup_question("thanos")
    with pytest.raises(ValueError):
        backup_question("goblin", "impossible")


# ── falling back ─────────────────────────────────────────────────────────────
def test_normally_the_generator_is_used(monkeypatch):
    monkeypatch.setattr(question_bank, "backup_question", lambda *a, **k: pytest.fail("the bank was not needed"))
    for boss_id in BOSS_IDS:
        assert question_or_backup(boss_id, "medium", rng=random.Random(3)).text


@pytest.mark.parametrize("boss_id", BOSS_IDS)
@pytest.mark.parametrize("tier", DIFFICULTIES)
def test_if_the_generator_breaks_a_backup_question_is_served(monkeypatch, boss_id, tier):
    def broken(*args, **kwargs):
        raise RuntimeError("generator is broken")

    monkeypatch.setattr(question_bank, "generate_question", broken)
    q = question_or_backup(boss_id, tier)
    assert q.text in {b.text for b in BANK[boss_id] if b.difficulty == tier}
    assert q.options[q.correct_index] == str(solve(boss_id, q.text))


def test_an_unknown_villain_is_still_an_error_not_a_backup():
    with pytest.raises(ValueError):
        question_or_backup("thanos")


@pytest.mark.parametrize("boss", BOSSES, ids=BOSS_IDS)
def test_a_whole_mission_can_be_won_on_backup_questions_alone(monkeypatch, client, register, play, db_factory, boss):
    """With the generator broken and no AI key, every villain is still fully playable."""
    import models

    def broken(*args, **kwargs):
        raise RuntimeError("generator is broken")

    monkeypatch.setattr(question_bank, "generate_question", broken)
    student = register("student")
    with db_factory() as db:  # unlock every villain for this test
        db.get(models.User, student.id).level = 6
        db.commit()

    res = client.post("/sessions", json={"boss_id": boss["id"]}, headers=student.headers)
    assert res.status_code == 201, res.text
    bank_texts = {q.text for q in BANK[boss["id"]]}
    question = res.json()["question"]
    served = 0
    while question:
        assert question["text"] in bank_texts
        served += 1
        hint = client.get(f"/attempts/{question['attempt_id']}/hint", headers=student.headers)
        assert hint.status_code == 200 and hint.json()["hint"]
        body = play(student, question["attempt_id"], True)
        question = body["next_question"]
    assert body["session_status"] == "victory" and served == 7


def test_questions_never_touch_the_ai_service(monkeypatch):
    """Questions come from code alone, so an AI outage cannot affect them."""
    from services import hints

    monkeypatch.setattr(hints, "_ask_model", lambda *a, **k: pytest.fail("a question asked the AI service"))
    for boss_id in BOSS_IDS:
        for tier in DIFFICULTIES:
            assert question_or_backup(boss_id, tier, rng=random.Random(5)).options
    assert "groq" not in open(questions.__file__, encoding="utf-8").read().lower()
