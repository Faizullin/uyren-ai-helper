import os
from datetime import datetime
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from supabase import create_client
from openai import OpenAI
from dotenv import load_dotenv

# --- Load environment variables ---
load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app = FastAPI(title="Course Info Update Service")

# --- Pydantic schema for update ---
class UpdateCourseRequest(BaseModel):
    course_title: str
    lesson_title: str
    new_content: Optional[str] = None
    new_course_title: Optional[str] = None
    new_lesson_title: Optional[str] = None

# --- Helper: Generate embedding ---
def generate_embedding(text: str) -> list:
    """Generate embedding using OpenAI model"""
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding

# --- Helper: Get current record data ---
def get_current_record(course_title: str, lesson_title: str):
    """Get current record to use existing data for embedding generation"""
    response = supabase.table("courses_info").select("*").eq("course_title", course_title).eq("lesson_title", lesson_title).execute()
    
    if not response.data:
        raise Exception(f"No record found with course_title: '{course_title}' and lesson_title: '{lesson_title}'")
    
    return response.data[0]

# --- Helper: Update course_info in Supabase ---
def update_course_info(course_title: str, lesson_title: str, new_content: str = None, new_course_title: str = None, new_lesson_title: str = None):
    update_data = {
        "updated_at": datetime.utcnow().isoformat()
    }

    # Add fields to update only if they are provided
    if new_content is not None:
        update_data["content"] = new_content
    
    if new_course_title is not None:
        update_data["course_title"] = new_course_title

    if new_lesson_title is not None:
        update_data["lesson_title"] = new_lesson_title

    response = supabase.table("courses_info").update(update_data).eq("course_title", course_title).eq("lesson_title", lesson_title).execute()
    
    if not response.data:
        raise Exception(f"Error updating course_info: No records found or updated")
    
    return response.data[0]

# --- Helper: Update embeddings in Supabase ---
def update_embeddings(course_title: str, lesson_title: str, final_content: str, final_course_title: str, final_lesson_title: str):
    """Update embeddings with the final combined text"""
    # Create combined text for embedding (same format as create_data embeddings.py)
    text_to_embed = f"Course: {final_course_title}\nLesson: {final_lesson_title}\nContent: {final_content}"
    
    # Generate new embedding
    embedding = generate_embedding(text_to_embed)
    
    # Update embeddings table
    update_data = {
        "embedding": embedding,
        "content": final_content,
        "course_title": final_course_title,
        "lesson_title": final_lesson_title
    }
    
    response = supabase.table("embeddings").update(update_data).eq("course_title", course_title).eq("lesson_title", lesson_title).execute()

    if not response.data:
        raise Exception(f"Error updating embedding: No records found or updated")

    return response.data[0]

# --- Endpoint: Update course_info and embeddings ---
@app.put("/update")
async def update_course(req: UpdateCourseRequest):
    try:
        # Validate that at least one field is being updated
        if not any([req.new_content, req.new_course_title, req.new_lesson_title]):
            raise HTTPException(status_code=400, detail="At least one field (new_content, new_course_title, or new_lesson_title) must be provided for update")
        
        # Get current record to use existing data where not updated
        current_record = get_current_record(req.course_title, req.lesson_title)
        
        # Determine final values (use new values if provided, otherwise keep existing)
        final_content = req.new_content if req.new_content is not None else current_record["content"]
        final_course_title = req.new_course_title if req.new_course_title is not None else current_record["course_title"]
        final_lesson_title = req.new_lesson_title if req.new_lesson_title is not None else current_record["lesson_title"]
        
        # Update the course_info table
        updated_course = update_course_info(
            req.course_title, 
            req.lesson_title, 
            req.new_content,
            req.new_course_title, 
            req.new_lesson_title
        )

        # Update the embeddings table with new embedding based on final combined data
        updated_embedding = update_embeddings(
            req.course_title, 
            req.lesson_title, 
            final_content,
            final_course_title,
            final_lesson_title
        )

        # Build response message
        updated_fields = []
        if req.new_content is not None:
            updated_fields.append("content")
        if req.new_course_title is not None:
            updated_fields.append("course_title")
        if req.new_lesson_title is not None:
            updated_fields.append("lesson_title")

        return {
            "message": f"✅ Successfully updated {', '.join(updated_fields)} for course: '{req.course_title}', lesson: '{req.lesson_title}'",
            "updated_fields": updated_fields,
            "updated_course_info": updated_course,
            "updated_embedding_id": updated_embedding["id"]
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

# --- Run the server ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)