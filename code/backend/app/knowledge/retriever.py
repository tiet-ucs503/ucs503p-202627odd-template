"""
Knowledge Base Retriever for AI Coaching Workflow.

Loads curated biomechanics guidance and retrieves relevant passages for detected
workout issues and athlete goals using a local TF-IDF keyword index.
"""
from __future__ import annotations

import json
import math
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class RetrievedPassage:
    source_id: str
    title: str
    relevance_score: float
    passage: str
    topic: str
    recommendations: list[str]


def _tokenize(text: str) -> list[str]:
    """Tokenize text into lowercase alphanumeric words."""
    return re.findall(r"\b[a-z0-9_]{2,}\b", text.lower())


class BiomechanicsKnowledgeRetriever:
    """TF-IDF keyword retriever over approved biomechanics guidance."""

    def __init__(self, kb_path: Path | str | None = None) -> None:
        if kb_path is None:
            kb_path = Path(__file__).parent / "knowledge_base.json"
        self.kb_path = Path(kb_path)
        self.documents: list[dict[str, Any]] = []
        self.doc_vectors: list[dict[str, float]] = []
        self.doc_norms: list[float] = []
        self.idf: dict[str, float] = {}
        self._load_and_index()

    def _load_and_index(self) -> None:
        """Loads knowledge base JSON and builds TF-IDF index."""
        if not self.kb_path.exists():
            self.documents = []
            return

        with open(self.kb_path, "r", encoding="utf-8") as f:
            self.documents = json.load(f)

        num_docs = len(self.documents)
        if num_docs == 0:
            return

        doc_frequencies: Counter[str] = Counter()
        doc_token_counts: list[Counter[str]] = []

        for doc in self.documents:
            # Aggregate searchable text with weighted keywords & title
            full_text = f"{doc.get('title', '')} " * 2
            full_text += f"{doc.get('topic', '')} " * 3
            full_text += " ".join(doc.get("keywords", [])) * 4 + " "
            full_text += doc.get("content", "") + " "
            full_text += " ".join(doc.get("recommendations", []))

            tokens = _tokenize(full_text)
            counts = Counter(tokens)
            doc_token_counts.append(counts)
            for word in counts.keys():
                doc_frequencies[word] += 1

        # Calculate smoothed IDF
        self.idf = {
            term: math.log((num_docs + 1) / (df + 1)) + 1.0
            for term, df in doc_frequencies.items()
        }

        # Build normalized TF-IDF vector per document
        self.doc_vectors = []
        self.doc_norms = []
        for counts in doc_token_counts:
            vec: dict[str, float] = {}
            norm_sq = 0.0
            total_tokens = sum(counts.values()) or 1
            for term, count in counts.items():
                tf = count / total_tokens
                weight = tf * self.idf[term]
                vec[term] = weight
                norm_sq += weight * weight
            self.doc_vectors.append(vec)
            self.doc_norms.append(math.sqrt(norm_sq) or 1.0)

    def retrieve(
        self,
        exercise: str = "squat",
        issues: list[dict[str, Any]] | None = None,
        metrics: dict[str, Any] | None = None,
        user_goal: str | None = None,
        top_k: int = 3,
    ) -> list[RetrievedPassage]:
        """
        Retrieves top_k most relevant passages based on exercise, issues, and goals.
        """
        if not self.documents:
            return []

        issues = issues or []
        metrics = metrics or {}

        # Construct weighted query tokens
        query_parts: list[str] = [exercise, exercise]

        # Extract issue keywords
        exact_issue_topics: set[str] = set()
        for issue in issues:
            itype = str(issue.get("type", "")).lower()
            exact_issue_topics.add(itype)
            severity = str(issue.get("severity", "medium")).lower()
            repeat_count = 4 if severity == "high" else 2
            query_parts.extend([itype] * repeat_count)

        if not issues:
            # Clean session: focus on progressive overload, tempo, and warmups
            query_parts.extend(["progression", "overload", "tempo", "recovery", "clean"])

        if user_goal:
            query_parts.append(user_goal.lower())

        query_tokens = _tokenize(" ".join(query_parts))
        if not query_tokens:
            query_tokens = [exercise.lower()]

        query_counts = Counter(query_tokens)
        query_total = sum(query_counts.values()) or 1

        query_vec: dict[str, float] = {}
        q_norm_sq = 0.0
        for term, count in query_counts.items():
            if term in self.idf:
                tf = count / query_total
                weight = tf * self.idf[term]
                query_vec[term] = weight
                q_norm_sq += weight * weight
        q_norm = math.sqrt(q_norm_sq) or 1.0

        scores: list[tuple[float, int]] = []
        for idx, (dvec, dnorm) in enumerate(zip(self.doc_vectors, self.doc_norms)):
            dot_product = sum(weight * dvec.get(term, 0.0) for term, weight in query_vec.items())
            cosine_sim = dot_product / (q_norm * dnorm) if dnorm > 0 else 0.0

            doc = self.documents[idx]
            topic = doc.get("topic", "")

            # Calibrate relevance score: baseline match plus strong topic match bonus
            if topic in exact_issue_topics:
                calibrated = 0.65 + 0.30 * min(1.0, cosine_sim * 2.5)
            else:
                calibrated = min(0.60, 0.20 + cosine_sim * 1.5)

            final_score = min(0.98, max(0.10, calibrated))
            scores.append((final_score, idx))

        # Sort descending by score
        scores.sort(key=lambda x: x[0], reverse=True)

        results: list[RetrievedPassage] = []
        for score, idx in scores[:top_k]:
            doc = self.documents[idx]
            results.append(
                RetrievedPassage(
                    source_id=doc.get("id", f"doc_{idx}"),
                    title=doc.get("title", "Coaching Guidance"),
                    relevance_score=round(score, 2),
                    passage=doc.get("content", ""),
                    topic=doc.get("topic", ""),
                    recommendations=doc.get("recommendations", []),
                )
            )

        return results


# Module-level singleton instance
_retriever: BiomechanicsKnowledgeRetriever | None = None


def get_retriever() -> BiomechanicsKnowledgeRetriever:
    """Returns singleton instance of BiomechanicsKnowledgeRetriever."""
    global _retriever
    if _retriever is None:
        _retriever = BiomechanicsKnowledgeRetriever()
    return _retriever
