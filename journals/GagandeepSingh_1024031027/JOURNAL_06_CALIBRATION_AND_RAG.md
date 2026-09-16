# 06: Personal Calibration and Retrieval-Augmented Coaching

**Author:** Gagandeep Singh  
**Roll No.:** 1024031027  
**Module:** Personalized Biomechanical Calibration & AI Coaching RAG Pipeline  

## Error:

Fixed thresholds alone cannot represent every athlete’s proportions or movement pattern, while an unrestricted language model could invent unsafe or unsupported coaching advice.

## Relevant Context

The calibration flow records personal limb ratios and movement baselines. The coaching service receives measured squat issues, metrics, user goals, and approved biomechanics guidance.

## Key Observation

Personal data and authoritative guidance serve different purposes. Calibration personalizes comparisons, while retrieval grounds coaching content in approved material.

## Solution

Calibration stores values such as femur-to-torso ratio, shin-to-torso ratio, baseline ROM, and angle statistics. The coaching service loads curated guidance from `knowledge_base.json`, builds an in-memory TF-IDF index, retrieves relevant passages using cosine similarity, and adds those passages and the personal baseline to the Gemini prompt.

If Gemini is unavailable, deterministic rule-based coaching uses the same measured issues and retrieved guidance. Responses are schema-validated, limited to three recommendations, include a safety note, and reject medical diagnoses.

The retrieval process builds a query from the structured workout result:

```python
passages = retriever.retrieve(
    exercise=request.exercise,
    issues=issue_dicts,
    metrics=metrics_dict,
    user_goal=request.user_goal,
    top_k=3,
)
```

The local retriever creates TF-IDF vectors in memory and ranks documents using cosine similarity. The selected passages are then added to the generation prompt together with the user’s baseline:

```text
Retrieved guidance:
    Squat depth and individual proportions

Personal baseline:
    Typical torso lean: 38 degrees
    Knee angle at bottom: 88 degrees

Current session:
    Torso lean: 45 degrees
```

The coaching response is checked before it is returned:

```python
if len(response.recommendations) > 3:
    reject_response()

if contains_medical_diagnosis(response.explanation):
    reject_response()
```

This makes the AI an additional explanation layer over measured results rather than the component that decides whether a squat repetition occurred.

## Because

Calibration allows the system to compare movement against the individual rather than a universal body assumption. Retrieval reduces unsupported generation, while deterministic fallback keeps coaching available without an external AI service.
