import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from supabase import create_client
from dotenv import load_dotenv

# --- Load env vars ---
load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

app = FastAPI(title="Course Info Deletion Service")

# --- Pydantic schemas ---
class DeleteRequest(BaseModel):
    course_title: Optional[str] = None
    lesson_title: Optional[str] = None

# --- Helper: Delete records from Supabase ---
def delete_course_records(course_title: str = None, lesson_title: str = None):
    if not course_title and not lesson_title:
        raise Exception("At least one of course_title or lesson_title must be provided")
    
    deleted_count = 0
    
    # Build query for courses_info
    courses_query = supabase.table("courses_info").delete()
    if course_title:
        courses_query = courses_query.eq("course_title", course_title)
    if lesson_title:
        courses_query = courses_query.eq("lesson_title", lesson_title)
    
    # Execute delete for courses_info
    response_courses = courses_query.execute()
    courses_deleted = len(response_courses.data) if response_courses.data else 0
    
    # Build query for embeddings
    embeddings_query = supabase.table("embeddings").delete()
    if course_title:
        embeddings_query = embeddings_query.eq("course_title", course_title)
    if lesson_title:
        embeddings_query = embeddings_query.eq("lesson_title", lesson_title)
    
    # Execute delete for embeddings
    response_embeddings = embeddings_query.execute()
    embeddings_deleted = len(response_embeddings.data) if response_embeddings.data else 0
    
    return courses_deleted, embeddings_deleted

# --- DELETE Endpoint ---
@app.delete("/delete")
async def delete_data(req: DeleteRequest):
    try:
        course_title = req.course_title
        lesson_title = req.lesson_title
        
        # Validate that at least one parameter is provided
        if not course_title and not lesson_title:
            raise HTTPException(status_code=400, detail="At least one of course_title or lesson_title must be provided")
        
        # Delete course and embedding records
        courses_deleted, embeddings_deleted = delete_course_records(course_title, lesson_title)
        
        # Build response message
        filter_info = []
        if course_title:
            filter_info.append(f"course_title: '{course_title}'")
        if lesson_title:
            filter_info.append(f"lesson_title: '{lesson_title}'")
        
        filter_str = " AND ".join(filter_info)
        
        return {
            "message": f"✅ Successfully deleted records matching {filter_str}",
            "deleted_counts": {
                "courses_info": courses_deleted,
                "embeddings": embeddings_deleted
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

# --- Run the server ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
