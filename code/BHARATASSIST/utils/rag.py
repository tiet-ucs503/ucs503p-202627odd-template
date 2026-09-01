"""
RAG pipeline for BharatAssist.

Embeds government service data using Sentence Transformers,
stores vectors in ChromaDB, and retrieves relevant service
information with metadata for grounded AI responses.
"""

import os

import chromadb
from sentence_transformers import SentenceTransformer


# --------------------------------------------------
# Paths
# --------------------------------------------------

APP_ROOT = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

CHROMA_PATH = os.path.join(
    APP_ROOT,
    "chroma_store"
)


# --------------------------------------------------
# Global objects
# --------------------------------------------------

_embedder = None
_client = None
_collection = None


# --------------------------------------------------
# Embedding model
# --------------------------------------------------

def _get_embedder():
    """
    Load the Sentence Transformer model only once.
    """

    global _embedder

    if _embedder is None:

        _embedder = SentenceTransformer(
            "all-MiniLM-L6-v2"
        )

    return _embedder


# --------------------------------------------------
# ChromaDB
# --------------------------------------------------

def init_vector_store():
    """
    Initialize and return the ChromaDB collection.
    """

    global _client
    global _collection

    if _client is None:

        _client = chromadb.PersistentClient(
            path=CHROMA_PATH
        )

        _collection = (
            _client.get_or_create_collection(
                name="government_services",
                metadata={
                    "hnsw:space": "cosine"
                }
            )
        )

    return _collection


# --------------------------------------------------
# Add service to vector database
# --------------------------------------------------

def add_service_to_index(
    service_id: int,
    name: str,
    text_blob: str,
    category: str = "",
    state: str = "All India",
    source_url: str = "",
    last_verified: str = ""
):
    """
    Add or update one government service
    in the ChromaDB vector store.
    """

    collection = init_vector_store()

    embedder = _get_embedder()

    embedding = embedder.encode(
        text_blob
    ).tolist()

    collection.upsert(
        ids=[
            str(service_id)
        ],

        embeddings=[
            embedding
        ],

        documents=[
            text_blob
        ],

        metadatas=[
            {
                "name": name,
                "category": category,
                "state": state,
                "source_url": source_url,
                "last_verified": last_verified
            }
        ]
    )


# --------------------------------------------------
# Retrieve relevant services
# --------------------------------------------------

def retrieve_relevant_chunks(
    query: str,
    top_k: int = 3
):
    """
    Retrieve relevant government-service records.

    Returns:

        (
            chunks,
            best_similarity_score
        )

    Each chunk contains:

        text
        name
        category
        state
        source_url
        last_verified
        score
    """

    collection = init_vector_store()

    # No services indexed
    if collection.count() == 0:
        return [], 0.0


    embedder = _get_embedder()


    # Convert user query into embedding
    query_embedding = embedder.encode(
        query
    ).tolist()


    # Search ChromaDB
    results = collection.query(
        query_embeddings=[
            query_embedding
        ],

        n_results=top_k,

        include=[
            "documents",
            "metadatas",
            "distances"
        ]
    )


    # Get documents
    documents = results.get(
        "documents",
        [[]]
    )[0]


    # Get metadata
    metadatas = results.get(
        "metadatas",
        [[]]
    )[0]


    # Get similarity distances
    distances = results.get(
        "distances",
        [[]]
    )[0]


    # Convert cosine distance
    # into approximate similarity
    similarities = [
        1 - distance
        for distance in distances
    ]


    # Best similarity score
    best_score = (
        max(similarities)
        if similarities
        else 0.0
    )


    chunks = []


    # Build structured results
    for document, metadata, score in zip(
        documents,
        metadatas,
        similarities
    ):

        # Protect against missing metadata
        if not isinstance(metadata, dict):
            metadata = {}


        chunks.append({

            "text": document,

            "name": metadata.get(
                "name",
                ""
            ),

            "category": metadata.get(
                "category",
                ""
            ),

            "state": metadata.get(
                "state",
                "All India"
            ),

            "source_url": metadata.get(
                "source_url",
                ""
            ),

            "last_verified": metadata.get(
                "last_verified",
                ""
            ),

            "score": round(
                score,
                3
            )

        })


    return (
        chunks,
        round(
            best_score,
            3
        )
    )