"""
Tests for BiomechanicsKnowledgeRetriever.
"""
from app.knowledge.retriever import BiomechanicsKnowledgeRetriever, get_retriever


def test_knowledge_base_loads_documents():
    retriever = get_retriever()
    assert len(retriever.documents) >= 8
    topics = {d["topic"] for d in retriever.documents}
    assert "depth" in topics
    assert "torso_lean" in topics
    assert "knee_valgus" in topics
    assert "safety" in topics


def test_retrieve_for_torso_lean():
    retriever = BiomechanicsKnowledgeRetriever()
    issues = [{"type": "torso_lean", "count": 3, "severity": "medium"}]
    passages = retriever.retrieve(exercise="squat", issues=issues, top_k=3)

    assert len(passages) == 3
    # Torso lean document should rank first
    assert passages[0].topic == "torso_lean"
    assert passages[0].source_id == "squat_torso_lean_bracing"
    assert passages[0].relevance_score > 0.4
    assert len(passages[0].recommendations) > 0


def test_retrieve_for_depth_issue():
    retriever = BiomechanicsKnowledgeRetriever()
    issues = [{"type": "depth", "count": 2, "severity": "high"}]
    passages = retriever.retrieve(exercise="squat", issues=issues, top_k=2)

    assert len(passages) == 2
    assert passages[0].topic == "depth"
    assert "depth" in passages[0].source_id


def test_retrieve_for_clean_set():
    retriever = BiomechanicsKnowledgeRetriever()
    passages = retriever.retrieve(exercise="squat", issues=[], top_k=3)

    assert len(passages) == 3
    for p in passages:
        assert p.relevance_score > 0
        assert p.passage != ""
