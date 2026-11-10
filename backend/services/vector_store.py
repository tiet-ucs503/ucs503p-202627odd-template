import os
import json
from typing import List, Dict, Optional
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Comprehensive Curriculum Knowledge Base for MathVerse
CURRICULUM_DATA: List[Dict] = [
    {
        "id": "linear_equations",
        "topic": "solving linear equations",
        "boss": "Green Goblin",
        "keywords": "linear equation algebra solve for x variables coefficients balance both sides",
        "formulas": [
            "ax + b = c  =>  x = (c - b) / a",
            "Distributive property: a(b + c) = ab + ac",
            "Golden rule: whatever operation is performed on one side must be performed on the other"
        ],
        "core_concept": "Isolating the unknown variable using inverse operations (addition/subtraction first, then multiplication/division).",
        "common_misconceptions": [
            "Forgetting to distribute the negative sign when expanding brackets, e.g. -(x - 4) becomes -x + 4, not -x - 4.",
            "Dividing only one term instead of all terms when isolating x.",
            "Switching signs erroneously when moving terms across the equals sign."
        ],
        "scaffolded_hints": {
            "conceptual": "Spider-Man! To disarm Goblin's glider frequency, isolate the unknown variable by doing the reverse operation to both sides!",
            "procedural": "First group all the numbers without x on one side by adding or subtracting, then divide by the coefficient of x.",
            "calculation": "Remember: if you subtract a number from the left side, subtract the exact same value from the right side!"
        }
    },
    {
        "id": "area_perimeter",
        "topic": "calculating area and perimeter",
        "boss": "Doctor Octopus",
        "keywords": "geometry area perimeter polygon rectangle triangle circle circumference octavius tentacles",
        "formulas": [
            "Rectangle Area = length * width, Perimeter = 2*(length + width)",
            "Triangle Area = 0.5 * base * height",
            "Circle Area = pi * r^2, Circumference = 2 * pi * r"
        ],
        "core_concept": "Perimeter measures the boundary distance around a 2D shape (linear units), whereas Area measures the internal 2D space enclosed (square units).",
        "common_misconceptions": [
            "Confusing perimeter and area calculations.",
            "Using slant height instead of perpendicular height in triangle area calculations.",
            "Forgetting that doubling side lengths quadruples the area."
        ],
        "scaffolded_hints": {
            "conceptual": "Doc Ock's mechanical arms are locking down a zone! Distinguish whether you need the outer perimeter border or the full enclosed surface area.",
            "procedural": "Multiply base by perpendicular height (and halve it if it's a triangle) to calculate area.",
            "calculation": "Check your units! Area is always in square units like cm^2 or m^2."
        }
    },
    {
        "id": "sequences_patterns",
        "topic": "number sequences and patterns",
        "boss": "Mysterio",
        "keywords": "sequences patterns arithmetic geometric progression nth term common difference ratio mysterio illusions",
        "formulas": [
            "Arithmetic sequence: a_n = a_1 + (n - 1) * d",
            "Geometric sequence: a_n = a_1 * r^(n - 1)",
            "Common difference: d = a_(k+1) - a_k"
        ],
        "core_concept": "Identifying whether consecutive terms change by adding a constant difference (arithmetic) or multiplying by a constant factor (geometric).",
        "common_misconceptions": [
            "Assuming every sequence is arithmetic and missing geometric growth.",
            "Off-by-one errors in using (n) instead of (n - 1) for the formula.",
            "Failing to check if the pattern holds true for all given terms."
        ],
        "scaffolded_hints": {
            "conceptual": "Mysterio's holograms follow a predictable sequence! Look closely at the jump between each successive term.",
            "procedural": "Subtract the first term from the second, and second from third. If the difference is constant, add that difference to find the next term.",
            "calculation": "Check the jump rule: is it +d or *r? Test your rule on the third number to confirm before picking your answer!"
        }
    },
    {
        "id": "percentages_fractions",
        "topic": "percentages and fractions",
        "boss": "Venom",
        "keywords": "fractions percentages proportions decimals parts of a whole venom symbiote ratio conversion",
        "formulas": [
            "Percentage of a quantity = (P / 100) * Total",
            "Percentage Increase/Decrease = (|Change| / Original) * 100%",
            "Fraction addition: a/b + c/d = (ad + bc) / bd"
        ],
        "core_concept": "Fractions represent proportional parts of a whole; percentages represent proportions scaled per 100 units.",
        "common_misconceptions": [
            "Adding denominators directly when adding fractions (e.g. 1/2 + 1/3 is NOT 2/5).",
            "Calculating percentage change relative to the final value instead of the original initial value.",
            "Confusing percent discount with the final price to pay."
        ],
        "scaffolded_hints": {
            "conceptual": "Venom's symbiote is expanding as a percentage of the district! Convert the fraction to a common denominator to strike accurately.",
            "procedural": "Find a common denominator before adding fractions, or multiply the total by (percent / 100) for percentage values.",
            "calculation": "To find X% of Y, divide X by 100 and multiply by Y, or simplify into equivalent benchmark fractions!"
        }
    },
    {
        "id": "radicals_exponents",
        "topic": "radicals and exponents",
        "boss": "The Lizard",
        "keywords": "exponents powers radicals square roots scientific notation lizard connors dna",
        "formulas": [
            "Product rule: x^a * x^b = x^(a + b)",
            "Quotient rule: x^a / x^b = x^(a - b)",
            "Power of a power: (x^a)^b = x^(a * b)",
            "Square root: sqrt(x) = x^(1/2), sqrt(a * b) = sqrt(a) * sqrt(b)"
        ],
        "core_concept": "Exponents represent repeated multiplication; radicals are fractional powers representing roots.",
        "common_misconceptions": [
            "Adding base numbers during exponent multiplication instead of keeping the base and adding powers.",
            "Assuming sqrt(a + b) equals sqrt(a) + sqrt(b) (it does not!).",
            "Treating negative exponents as negative numbers instead of reciprocal values."
        ],
        "scaffolded_hints": {
            "conceptual": "Dr. Connors' genetic formula grows exponentially! Use power rules to simplify the expression before calculating.",
            "procedural": "When multiplying identical bases, add the exponents together. When finding a square root, look for perfect square factors.",
            "calculation": "Negative exponents flip into fractions: x^(-n) = 1 / (x^n)."
        }
    },
    {
        "id": "ratios_proportions",
        "topic": "ratios and proportions",
        "boss": "Kingpin",
        "keywords": "ratios proportions unit rate cross multiplication direct scale factor kingpin syndicates",
        "formulas": [
            "Proportion equation: a / b = c / d  =>  a * d = b * c",
            "Unit rate = Quantity A / Quantity B",
            "Scale factor = Model dimension / Actual dimension"
        ],
        "core_concept": "Ratios quantify relative sizes between quantities; proportions establish the equality of two ratios.",
        "common_misconceptions": [
            "Reversing numerator and denominator when setting up proportions.",
            "Adding rather than multiplying when scaling proportional quantities.",
            "Mixing up part-to-part ratios with part-to-whole ratios."
        ],
        "scaffolded_hints": {
            "conceptual": "Kingpin's syndicate operations balance on strict ratios! Set up equal fractions to solve for the missing supply cache.",
            "procedural": "Cross-multiply: if a/b = c/d, multiply diagonal pairs (a*d = b*c) to solve for the unknown.",
            "calculation": "Always verify that both sides of the ratio compare the same corresponding units in the same order."
        }
    }
]

class CurriculumVectorStore:
    """
    In-memory vector store for MathVerse curriculum knowledge.
    Uses TF-IDF + Cosine Similarity for fast, deterministic semantic retrieval.
    """
    def __init__(self, data: List[Dict] = CURRICULUM_DATA):
        self.documents = data
        self.corpus = []
        for doc in self.documents:
            # Combine topic, keywords, formulas, misconceptions, and concept into search text
            text = (
                f"{doc['topic']} {doc['boss']} {doc['keywords']} "
                f"{' '.join(doc['formulas'])} {doc['core_concept']} "
                f"{' '.join(doc['common_misconceptions'])}"
            )
            self.corpus.append(text)
            
        self.vectorizer = TfidfVectorizer(stop_words='english', ngram_range=(1, 2))
        self.tfidf_matrix = self.vectorizer.fit_transform(self.corpus)
        print(f"[VectorStore] Indexed {len(self.documents)} curriculum modules into vector space.")

    def search(self, query: str, top_k: int = 2) -> List[Dict]:
        """
        Retrieves top_k most relevant curriculum modules for the given query.
        """
        if not query or not query.strip():
            return self.documents[:top_k]
            
        query_vec = self.vectorizer.transform([query])
        similarities = cosine_similarity(query_vec, self.tfidf_matrix).flatten()
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        results = []
        for idx in top_indices:
            score = float(similarities[idx])
            doc_copy = dict(self.documents[idx])
            doc_copy["relevance_score"] = score
            results.append(doc_copy)
            
        return results

    def get_by_boss_or_topic(self, boss_or_topic: str) -> Optional[Dict]:
        """Direct lookup by boss name or topic key."""
        target = boss_or_topic.lower().replace("-", " ")
        for doc in self.documents:
            if target in doc["topic"].lower() or target in doc["boss"].lower() or target in doc["id"].lower():
                return doc
        # Fallback to search
        results = self.search(boss_or_topic, top_k=1)
        return results[0] if results else None

# Singleton instance
vector_store = CurriculumVectorStore()

def search_curriculum(query: str, top_k: int = 2) -> List[Dict]:
    return vector_store.search(query, top_k=top_k)

def get_curriculum_context(topic_or_boss: str) -> Dict:
    doc = vector_store.get_by_boss_or_topic(topic_or_boss)
    if not doc:
        doc = CURRICULUM_DATA[0]
    return doc

