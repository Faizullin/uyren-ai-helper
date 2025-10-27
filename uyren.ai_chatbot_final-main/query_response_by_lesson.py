import os
import json
import numpy as np
import faiss
import tiktoken
from typing import List, Dict, Any
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client

# LangChain imports
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain.schema.runnable import RunnablePassthrough
from langchain.schema.output_parser import StrOutputParser

load_dotenv()

# --- Initialize clients ---
app = FastAPI(title="Course Query Response by Lesson API")

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# Initialize LangChain components
embeddings_model = OpenAIEmbeddings(
    model="text-embedding-3-small",
    openai_api_key=os.getenv("OPENAI_API_KEY")
)

llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0.7,
    max_tokens=1000,
    openai_api_key=os.getenv("OPENAI_API_KEY")
)

# Initialize the tokenizer for token counting
tokenizer = tiktoken.get_encoding("cl100k_base")  # For GPT-4 and GPT-3.5 models

# --- Pydantic request schema ---
class QueryRequest(BaseModel):
    query: str
    lesson_title: str
    top_k: int = 5

class QueryResponse(BaseModel):
    query: str
    answer: str
    sources: List[Dict[str, Any]]

# --- Fetch stored embeddings from Supabase ---
def load_embeddings_from_db(lesson_title: str = None):
    """Load embeddings and documents from Supabase embeddings table, optionally filtered by lesson"""
    try:
        if lesson_title:
            response = supabase.table("embeddings").select("id, content, course_title, lesson_title, embedding").eq("lesson_title", lesson_title).execute()
        else:
            response = supabase.table("embeddings").select("id, content, course_title, lesson_title, embedding").execute()
        data = response.data
        
        if not data:
            if lesson_title:
                raise HTTPException(status_code=404, detail=f"No embeddings found for lesson '{lesson_title}' in Supabase.")
            else:
                raise HTTPException(status_code=404, detail="No embeddings found in Supabase.")
        
        # Extract embeddings and document data
        embeddings = []
        docs = []
        
        for i, row in enumerate(data):
            try:
                # Convert embedding from string/JSON to list of floats if needed
                embedding = row["embedding"]
                if isinstance(embedding, str):
                    embedding = json.loads(embedding)
                elif isinstance(embedding, list):
                    # Already a list, ensure all elements are floats
                    embedding = [float(x) for x in embedding]
                
                embeddings.append(embedding)
                docs.append({
                    "id": row["id"],
                    "content": row["content"],
                    "course_title": row["course_title"],
                    "lesson_title": row["lesson_title"]
                })
            except (ValueError, TypeError, json.JSONDecodeError) as e:
                raise HTTPException(
                    status_code=500, 
                    detail=f"Error processing embedding at row {i}: {str(e)}. Embedding data: {row.get('embedding', 'N/A')[:100]}..."
                )
        
        return np.array(embeddings, dtype=np.float32), docs
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# --- Create FAISS index (fresh for each request) ---
def create_faiss_index_fresh(lesson_title: str = None):
    """Create and return fresh FAISS index with document data, optionally filtered by lesson"""
    embeddings, docs = load_embeddings_from_db(lesson_title)
    
    # Create FAISS index
    dimension = embeddings.shape[1]
    index = faiss.IndexFlatIP(dimension)  # Inner product for cosine similarity
    
    # Normalize embeddings for cosine similarity
    faiss.normalize_L2(embeddings)
    index.add(embeddings)
    
    return index, docs

# --- Generate response using LangChain ---
def generate_response_with_langchain(query: str, relevant_chunks: List[Dict[str, Any]]) -> str:
    """Generate response using LangChain LLM based on query and relevant chunks"""
    
    # Prepare context from relevant chunks
    context_parts = []
    for i, chunk in enumerate(relevant_chunks, 1):
        context_parts.append(
            f"Source {i}:\n"
            f"Course: {chunk['course_title']}\n"
            f"Lesson: {chunk['lesson_title']}\n"
            f"Content: {chunk['content']}\n"
        )
    
    context = "\n---\n".join(context_parts)
    
    # Create LangChain prompt template
    prompt_template = ChatPromptTemplate.from_messages([
        ("system", "You are a helpful assistant behaves like AI and answers questions based on given materials. Provide helpful and effective responses using the provided context. Not too short, not too long."),
        ("human", """Based on the following content, answer the user's question. Use the provided sources to give a comprehensive and accurate answer.

Context from course materials:
{context}

User Question: {query}

Provide a helpful and effective answer or explanation based on the course content above. Answer should not be too long or too short. If there is no relevant data to the query, say that you don't have any data about that response.""")
    ])
    
    # Create LangChain chain
    chain = (
        {"context": RunnablePassthrough(), "query": RunnablePassthrough()}
        | prompt_template
        | llm
        | StrOutputParser()
    )
    
    try:
        # Generate response using the chain
        response = chain.invoke({"context": context, "query": query})
        return response.strip()
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating response: {str(e)}")

# --- Token tracking function ---
def track_tokens_to_database(input_query: str, output_response: str, model: str = "gpt-4o-mini"):
    """Track token usage and save to data_tokens table in Supabase"""
    try:
        # Tokenize the input query and output response
        tokens_input = tokenizer.encode(input_query)
        tokens_output = tokenizer.encode(output_response)
        
        # Prepare the data to insert into the table
        data = {
            "input_query": input_query,
            "output_response": output_response,
            "tokens_input": len(tokens_input),
            "tokens_output": len(tokens_output),
            "total_tokens": len(tokens_input) + len(tokens_output),
            "model": model
        }
        
        # Insert the row into the 'data_tokens' table
        response = supabase.table('data_tokens').insert(data).execute()
        
        print(f"Token tracking saved: Input tokens: {len(tokens_input)}, Output tokens: {len(tokens_output)}, Total: {len(tokens_input) + len(tokens_output)}")
        return response
        
    except Exception as e:
        print(f"Error tracking tokens to database: {str(e)}")
        # Don't raise exception to avoid breaking the main flow
        return None

# --- Route: Query and get AI response ---
@app.post("/query", response_model=QueryResponse)
async def query_and_respond(req: QueryRequest):
    """Query documents using FAISS and generate AI response - fresh data for each request"""
    try:
        # Step 1: Generate query embedding using LangChain
        query_embedding = embeddings_model.embed_query(req.query)
        query_embedding_array = np.array([query_embedding], dtype=np.float32)
        
        # Normalize query embedding for cosine similarity
        faiss.normalize_L2(query_embedding_array)
        
        # Step 2: Load fresh FAISS index and documents from DB (filtered by lesson)
        index, docs = create_faiss_index_fresh(req.lesson_title)
        
        # Step 3: Perform FAISS vector search
        scores, indices = index.search(query_embedding_array, req.top_k)
        
        # Step 4: Get relevant documents
        relevant_chunks = []
        sources = []
        
        for i, idx in enumerate(indices[0]):
            if idx != -1:  # Valid index
                doc = docs[idx]
                score = float(scores[0][i])
                
                relevant_chunks.append(doc)
                sources.append({
                    "content": doc["content"],
                    "course_title": doc["course_title"],
                    "lesson_title": doc["lesson_title"],
                    "similarity_score": score
                })
        
        # Step 5: Generate AI response using LangChain
        if relevant_chunks:
            answer = generate_response_with_langchain(req.query, relevant_chunks)
        else:
            answer = f"I couldn't find relevant information in the lesson '{req.lesson_title}' to answer your question."
        
        # Step 6: Track tokens to database
        track_tokens_to_database(req.query, answer, "gpt-4o-mini")
        
        return QueryResponse(
            query=req.query,
            answer=answer,
            sources=sources
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Health check ---
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Course Query Response by Lesson API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)