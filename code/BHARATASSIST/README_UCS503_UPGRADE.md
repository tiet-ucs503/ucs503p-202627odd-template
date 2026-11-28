# BharatAssist — UCS503 Upgrade Structure

This folder is the upgraded structure around the existing BharatAssist
starter project.

## Important
Do not delete the existing application files. The next implementation
steps will upgrade them incrementally.

## Main upgrade areas

1. UCS503 documentation and journals
2. Government-service database
3. State/category filtering
4. RAG metadata and source verification
5. PII/privacy improvements
6. Feedback collection
7. Evaluation dashboard
8. Automated testing
9. CI/CD
10. UI/UX improvements

## Run the current prototype

```bash
pip install -r requirements.txt
python seed_data.py
python app.py
```

The official UCS503 master-template/report requirements should be merged
into this repository before final submission.
