# Rule audit — round 2

The `minimal-json` audit exposed two remaining correctness problems.

## EC101

The rule checked the caller field type correctly, but then returned `true` whenever a call already had *any* resolved target. This caused ordinary resolved calls such as `readFromReader`, `writeToWriter`, and `value` to be labeled as potential database calls.

Fix: a scoped call is now accepted from field evidence only when the field type itself matches a repository/DAO/database type. An arbitrary non-null resolved target is no longer database evidence.

A regression test was added for an ordinary resolved call inside a loop.

## EC108

`reader.readLine()` is stateful: each invocation advances the reader. `display()` can also be side-effecting. Both are now excluded from duplicate-computation candidates.

New tests verify that:
- repeated `readLine()` is not reported;
- identical calls on different object scopes are not merged;
- a repeated accessor on the same scope is still reported as a potential duplicate.

## Interpretation

EC105, EC106, EC107, and EC108 remain review signals rather than proof of defects. Their confidence wording should remain conservative in reports and presentations.
