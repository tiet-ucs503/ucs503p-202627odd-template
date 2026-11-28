# System Architecture

```text
User
  |
  v
Web UI (HTML/CSS/JS)
  |
  v
Flask Backend
  |-------------------|-------------------|
  v                   v                   v
SQLite              RAG Pipeline       Privacy Layer
  |                   |                   |
  |                ChromaDB               |
  |                   |                   |
  |              Sentence Transformer     |
  |                   |                   |
  |                 Gemini                 |
  |                   |                   |
  +-------------------+-------------------+
                      |
                      v
             Verified Answer + Sources
```

## Main Components

1. Frontend
2. Flask backend
3. SQLite database
4. ChromaDB vector store
5. Sentence Transformer embeddings
6. Gemini LLM
7. PII redaction layer
8. Evaluation/feedback system
