import os
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from supabase import create_client
from dotenv import load_dotenv

# --- Load env vars ---
load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

app = FastAPI(title="Data Embeddings Read Service")

# --- Pydantic response models ---
class CourseRecord(BaseModel):
    id: str
    content: str
    course_title: str
    lesson_title: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class EmbeddingRecord(BaseModel):
    id: str
    content: str
    course_title: str
    lesson_title: str
    embedding: Optional[List[float]] = None

class ReadResponse(BaseModel):
    message: str
    count: int
    data: List[Dict[str, Any]]

# --- Helper functions ---
def build_query_filters(table_query, record_id: Optional[str], course_title: Optional[str], lesson_title: Optional[str]):
    """Build query filters based on provided parameters"""
    if record_id:
        table_query = table_query.eq("id", record_id)
    if course_title:
        table_query = table_query.ilike("course_title", f"%{course_title}%")
    if lesson_title:
        table_query = table_query.ilike("lesson_title", f"%{lesson_title}%")
    return table_query

def read_from_courses_info(record_id: Optional[str] = None, course_title: Optional[str] = None, lesson_title: Optional[str] = None):
    """Read data from courses_info table with optional filters"""
    try:
        query = supabase.table("courses_info").select("*")
        query = build_query_filters(query, record_id, course_title, lesson_title)
        
        response = query.execute()
        
        if response.data:
            return response.data
        else:
            return []
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading from courses_info: {str(e)}")

def read_from_embeddings(record_id: Optional[str] = None, course_title: Optional[str] = None, lesson_title: Optional[str] = None, include_embeddings: bool = False):
    """Read data from embeddings table with optional filters"""
    try:
        # Select fields based on whether embeddings are requested
        select_fields = "id, content, course_title, lesson_title"
        if include_embeddings:
            select_fields += ", embedding"
            
        query = supabase.table("embeddings").select(select_fields)
        query = build_query_filters(query, record_id, course_title, lesson_title)
        
        response = query.execute()
        
        if response.data:
            return response.data
        else:
            return []
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading from embeddings: {str(e)}")

# --- API Endpoints ---
@app.get("/read/courses", response_model=ReadResponse)
async def read_courses(
    id: Optional[str] = Query(None, description="Filter by record ID"),
    course_title: Optional[str] = Query(None, description="Filter by course title (partial match)"),
    lesson_title: Optional[str] = Query(None, description="Filter by lesson title (partial match)")
):
    """Read data from courses_info table with optional filters"""
    
    # Check if at least one filter is provided
    if not any([id, course_title, lesson_title]):
        raise HTTPException(
            status_code=400, 
            detail="At least one filter parameter (id, course_title, or lesson_title) must be provided"
        )
    
    try:
        data = read_from_courses_info(id, course_title, lesson_title)
        
        return ReadResponse(
            message=f"Successfully retrieved {len(data)} records from courses_info",
            count=len(data),
            data=data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/read/embeddings", response_model=ReadResponse)
async def read_embeddings(
    id: Optional[str] = Query(None, description="Filter by record ID"),
    course_title: Optional[str] = Query(None, description="Filter by course title (partial match)"),
    lesson_title: Optional[str] = Query(None, description="Filter by lesson title (partial match)"),
    include_embeddings: bool = Query(False, description="Include embedding vectors in response")
):
    """Read data from embeddings table with optional filters"""
    
    # Check if at least one filter is provided
    if not any([id, course_title, lesson_title]):
        raise HTTPException(
            status_code=400, 
            detail="At least one filter parameter (id, course_title, or lesson_title) must be provided"
        )
    
    try:
        data = read_from_embeddings(id, course_title, lesson_title, include_embeddings)
        
        return ReadResponse(
            message=f"Successfully retrieved {len(data)} records from embeddings",
            count=len(data),
            data=data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/read/all", response_model=Dict[str, ReadResponse])
async def read_all_tables(
    id: Optional[str] = Query(None, description="Filter by record ID"),
    course_title: Optional[str] = Query(None, description="Filter by course title (partial match)"),
    lesson_title: Optional[str] = Query(None, description="Filter by lesson title (partial match)"),
    include_embeddings: bool = Query(False, description="Include embedding vectors in response")
):
    """Read data from both courses_info and embeddings tables with optional filters"""
    
    # Check if at least one filter is provided
    if not any([id, course_title, lesson_title]):
        raise HTTPException(
            status_code=400, 
            detail="At least one filter parameter (id, course_title, or lesson_title) must be provided"
        )
    
    try:
        courses_data = read_from_courses_info(id, course_title, lesson_title)
        embeddings_data = read_from_embeddings(id, course_title, lesson_title, include_embeddings)
        
        return {
            "courses_info": ReadResponse(
                message=f"Successfully retrieved {len(courses_data)} records from courses_info",
                count=len(courses_data),
                data=courses_data
            ),
            "embeddings": ReadResponse(
                message=f"Successfully retrieved {len(embeddings_data)} records from embeddings",
                count=len(embeddings_data),
                data=embeddings_data
            )
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/read/by-id/{record_id}")
async def read_by_id(record_id: str, include_embeddings: bool = Query(False)):
    """Convenience endpoint to read a specific record by ID from both tables"""
    try:
        courses_data = read_from_courses_info(record_id=record_id)
        embeddings_data = read_from_embeddings(record_id=record_id, include_embeddings=include_embeddings)
        
        if not courses_data and not embeddings_data:
            raise HTTPException(status_code=404, detail=f"No records found with ID: {record_id}")
        
        return {
            "id": record_id,
            "courses_info": courses_data[0] if courses_data else None,
            "embeddings": embeddings_data[0] if embeddings_data else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Health check ---
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Data Embeddings Read Service"}

# --- Run the server ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)