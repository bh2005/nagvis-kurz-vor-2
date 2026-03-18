# backend/help_router.py
from fastapi import APIRouter, HTTPException
import os
import markdown2  # pip install markdown2 (empfohlen für schönes HTML)

router = APIRouter(prefix="/api/help", tags=["help"])

HELP_DIR = "help_content"

@router.get("/{topic}")
async def get_help(topic: str):
    # Sicherheits-Check: Verhindert Directory Traversal
    safe_topic = os.path.basename(topic).replace(".md", "")
    file_path = f"{HELP_DIR}/{safe_topic}.md"
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Hilfe-Thema nicht gefunden")
    
    with open(file_path, "r", encoding="utf-8") as f:
        md_content = f.read()
        # Wir extrahieren die erste Zeile als Titel, den Rest als Body
        lines = md_content.split("\n")
        title = lines[0].replace("# ", "") if lines[0].startswith("#") else safe_topic
        body_html = markdown2.markdown("\n".join(lines[1:]))
        
        return {
            "title": title,
            "body": body_html
        }