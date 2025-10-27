import os
import uuid
from datetime import datetime
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Union
from supabase import create_client
from openai import OpenAI
from dotenv import load_dotenv

# --- Load env vars ---
load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app = FastAPI(title="Course Info Ingestion Service")

# --- Pydantic schemas ---
class ChunkData(BaseModel):
    content: str
    course_title: str
    lesson_title: str

class IngestRequest(BaseModel):
    data: Union[ChunkData, List[ChunkData]]

# --- Helper: Generate embedding ---
def generate_embedding(text: str) -> list:
    """Generate embedding using OpenAI model"""
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding

# --- Helper: Insert record into Supabase ---
def insert_course_record(content: str, course_title: str, lesson_title: str):
    record_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    response = supabase.table("courses_info").insert({
        "id": record_id,
        "content": content,
        "course_title": course_title,
        "lesson_title": lesson_title,
        "created_at": now,
        "updated_at": now
    }).execute()

    if response.data:
        return record_id
    else:
        raise Exception(f"Supabase insert error: {response}")

def insert_embedding_record(doc_id: str, content: str, course_title: str, lesson_title: str, embedding: list):
    response = supabase.table("embeddings").insert({
        "id": doc_id,
        "content": content,
        "course_title": course_title,
        "lesson_title": lesson_title,
        "embedding": embedding
    }).execute()
    
    if not response.data:
        raise Exception(f"Supabase embedding insert error: {response}")

# --- Endpoint ---
@app.post("/ingest")
async def ingest_data(req: IngestRequest):
    try:
        # Normalize single or list input
        data_list = [req.data] if isinstance(req.data, dict) else req.data

        inserted_ids = []

        for item in data_list:
            content = item.content.strip()
            course_title = item.course_title.strip()
            lesson_title = item.lesson_title.strip()

            # 1️⃣ Insert into courses_info
            record_id = insert_course_record(content, course_title, lesson_title)

            # 2️⃣ Create combined text for embedding (content + course_title + lesson_title)
            text_to_embed = f"Course: {course_title}\nLesson: {lesson_title}\nContent: {content}"

            # 3️⃣ Generate embedding
            embedding = generate_embedding(text_to_embed)

            # 4️⃣ Insert into embeddings table
            insert_embedding_record(record_id, content, course_title, lesson_title, embedding)

            inserted_ids.append(record_id)

        return {
            "message": f"✅ Inserted {len(inserted_ids)} records successfully",
            "record_ids": inserted_ids
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Run the server ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
