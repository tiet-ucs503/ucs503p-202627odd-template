"""
Academic mastery: Bayesian Knowledge Tracing (BKT), one value per student per topic.

`p_mastery` is the probability (0 to 1) that the student has learned the topic.
The only input is whether a maths answer was right or wrong. There is no
attention, camera, response-time or hint parameter anywhere in this module, on
purpose: a student without a camera gets exactly the same result.

The four BKT parameters (fixed, textbook-style values, not fitted to data):

    PRIOR   0.30  chance the topic is already known before the first question
    P_GUESS 0.25  chance of a right answer without knowing it (4 options)
    P_SLIP  0.10  chance of a wrong answer despite knowing it
    P_LEARN 0.15  chance of learning the topic from one question

After a CORRECT answer (Bayes' rule, then the learning step):

    posterior = p(1 - slip) / ( p(1 - slip) + (1 - p)guess )
    new p     = posterior + (1 - posterior) * learn

After an INCORRECT answer (Bayes' rule only):

    new p     = p*slip / ( p*slip + (1 - p)(1 - guess) )

Deliberate difference from textbook BKT: the textbook applies the learning
step after every answer. At low mastery that makes a WRONG answer raise the
number (0.05 becomes about 0.16), which is confusing on a progress report and
breaks the rule "incorrect answers decrease mastery". Here the learning step is
applied only after correct answers, so a correct answer always raises mastery
and an incorrect one always lowers it (tests/test_mastery.py checks this over
the whole range).

Worked example from the prior of 0.30:
    correct   -> posterior 0.27/(0.27+0.175) = 0.607 -> 0.607 + 0.393*0.15 = 0.666
    incorrect -> 0.03/(0.03+0.525) = 0.054
"""

PRIOR = 0.30
P_GUESS = 0.25
P_SLIP = 0.10
P_LEARN = 0.15

P_MIN, P_MAX = 0.01, 0.99  # never claim total certainty either way

EASY_BELOW = 0.40
HARD_ABOVE = 0.75


def update_mastery(p_mastery: float, is_correct: bool) -> float:
    """Returns the new mastery after one answer. Correct raises it, incorrect lowers it."""
    p = min(P_MAX, max(P_MIN, p_mastery))
    if is_correct:
        posterior = p * (1 - P_SLIP) / (p * (1 - P_SLIP) + (1 - p) * P_GUESS)
        new_p = posterior + (1 - posterior) * P_LEARN
    else:
        new_p = p * P_SLIP / (p * P_SLIP + (1 - p) * (1 - P_GUESS))
    return round(min(P_MAX, max(P_MIN, new_p)), 4)


def difficulty_for(p_mastery: float) -> str:
    """Which question tier to serve next for this topic."""
    if p_mastery < EASY_BELOW:
        return "easy"
    if p_mastery > HARD_ABOVE:
        return "hard"
    return "medium"
