# Frontend Development Guide - Frontend3

## Project Architecture

### Tech Stack
- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **State:** Zustand (persistent stores)
- **Data Fetching:** TanStack Query v5
- **API Client:** OpenAPI generated (`@hey-api/openapi-ts`)
- **Auth:** Supabase Auth
- **Forms:** React Hook Form (optional)

---

## OpenAPI Client Pattern (PRIMARY)

### ✅ Always Use OpenAPI Client for API Calls

**Generated Client Location:** `src/client/`
- `sdk.gen.ts` - Service classes
- `types.gen.ts` - TypeScript types
- `client.gen.ts` - Axios client instance

### Service Pattern:
```typescript
import { AgentsService } from '@/client';
import type { AgentPublic, AgentCreate } from '@/client/types.gen';

// Query
const response = await AgentsService.list_agents({ query: { limit: 100 } });
const agents = response.data?.data || [];

// Mutation
const response = await AgentsService.create_agent({ 
  body: { name: 'My Agent', model: 'gpt-4' } 
});
```

### Available Services:
- `UsersService` - User management
- `ThreadsService` - Thread CRUD
- `AgentsService` - Agent CRUD
- `AgentRunsService` - Agent execution
- `KnowledgeBaseService` - Knowledge base management
- `VectorStoreService` - Vector store, pages, and sections management

### Regenerate Client:
```bash
cd frontend3
npm run client:generate
```

---

## React Query Hooks Pattern

### Standard Hook Structure:
```typescript
// Query Hook
export function useAgents(params?: ListAgentsData['query']) {
  return useQuery({
    queryKey: ['agents', params],
    queryFn: async () => {
      const response = await AgentsService.list_agents({ query: params });
      return response.data;
    },
  });
}

// Mutation Hook
export function useCreateAgent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (agent: AgentCreate) => 
      AgentsService.create_agent({ body: agent }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Agent created');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create agent');
    },
  });
}
```

### Query Key Conventions:
```typescript
export const agentKeys = {
  all: ['agents'] as const,
  list: (params?: any) => ['agents', params] as const,
  detail: (id: string) => ['agent', id] as const,
};
```

### Naming Pattern:
- Queries: `use{Resource}Query` or `load{Resource}Query`
- Mutations: `use{Action}{Resource}Mutation` or `{action}{Resource}Mut`

---

## Component Patterns

### Dialog Control Hook:
```typescript
import { useDialogControl } from '@/hooks/use-dialog-control';

// In component:
const editDialog = useDialogControl<string>(); // With data type

editDialog.show(agentId);  // Pass data
editDialog.hide();
editDialog.isVisible;
editDialog.data;  // Access passed data
```

### Loading States:
```typescript
const loadAgentsQuery = useAgents();

if (loadAgentsQuery.isLoading) return <Skeleton />;
if (loadAgentsQuery.error) return <Error />;

const agents = loadAgentsQuery.data?.data || [];
```

### Mutation Patterns:
```typescript
const deleteMut = useDeleteAgent();

const handleDelete = async (agentId: string) => {
  try {
    await deleteMut.mutateAsync(agentId);
    // Success handled by hook's onSuccess
  } catch (error) {
    // Error handled by hook's onError
  }
};

// Button state
<Button disabled={deleteMut.isPending}>
  {deleteMut.isPending ? 'Deleting...' : 'Delete'}
</Button>
```

---

## Backend API Conventions

### Endpoint Structure:
```
/api/v1/{resource}
/api/v1/{resource}/{id}
/api/v1/{resource}/{id}/{action}
```

### Common Patterns:

**List Resources (Paginated):**
```python
@router.get("/agents")
def list_agents(
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    current_user: CurrentUser,
) -> PaginatedResponse[AgentPublic]:
    return {
        "data": agents,
        "pagination": { "total": count, "page": 1, "limit": limit }
    }
```

**Create Resource:**
```python
@router.post("/agents")
def create_agent(
    agent: AgentCreate,
    session: SessionDep,
    current_user: CurrentUser,
) -> AgentPublic:
    return created_agent
```

**Update Resource:**
```python
@router.patch("/agents/{agent_id}")  # Use PATCH, not PUT
def update_agent(
    agent_id: UUID,
    agent: AgentUpdate,
    session: SessionDep,
    current_user: CurrentUser,
) -> AgentPublic:
    return updated_agent
```

**Delete Resource:**
```python
@router.delete("/agents/{agent_id}")
def delete_agent(
    agent_id: UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    return {"message": "Agent deleted successfully"}
```

### Schema Patterns:

**Public Schema (Response):**
```python
class AgentPublic(SQLModel):
    id: UUID
    name: str
    description: str | None
    created_at: datetime
    # All fields visible to user
```

**Create Schema (Request):**
```python
class AgentCreate(SQLModel):
    name: str
    description: str | None = None
    model: str
    # Only fields needed for creation
```

**Update Schema (Request):**
```python
class AgentUpdate(SQLModel):
    name: str | None = None
    description: str | None = None
    # All fields optional
```

---

## Type Safety Principles

### ✅ Always Use Generated Types:
```typescript
import type { AgentPublic, ThreadPublic } from '@/client/types.gen';

// NOT:
// interface Agent { ... }
```

### ✅ Unwrap Responses Correctly:
```typescript
// Paginated response
const response = await AgentsService.list_agents();
const agents = response.data?.data || [];  // Unwrap pagination
const pagination = response.data?.pagination;

// Single resource
const response = await AgentsService.get_agent({ path: { agent_id: id } });
const agent = response.data!;
```

### ✅ Property Names Match Backend:
```typescript
// Backend returns 'id', not 'agent_id'
agent.id          // ✅ Correct
agent.agent_id    // ❌ Wrong

// Backend returns 'is_default', not 'is_suna_default'
agent.is_default  // ✅ Correct
```

---

## Zustand Store Pattern

### Persistent Store:
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface StoreState {
  selectedAgentId: string | undefined;
  setSelectedAgent: (id: string | undefined) => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      selectedAgentId: undefined,
      setSelectedAgent: (id) => set({ selectedAgentId: id }),
    }),
    {
      name: 'store-name-storage',
      partialize: (state) => ({ selectedAgentId: state.selectedAgentId }),
    }
  )
);
```

---

## File Upload Pattern

### FormData Upload:
```typescript
const formData = new FormData();
formData.append('prompt', message);
formData.append('agent_id', agentId);
files.forEach(file => formData.append('files', file, file.name));

const response = await AgentRunsService.initiate_agent_session({
  body: formData as any,
});
```

### File Download:
```typescript
const handleDownload = async (entryId: string, filename: string) => {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  const response = await fetch(`${API_URL}/api/v1/kb/entries/${entryId}/download`, {
    headers: { 'Authorization': `Bearer ${session.access_token}` }
  });
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};
```

---

## Authentication Pattern

### Supabase Auth (Keep for Auth Only):
```typescript
import { createClient } from '@/lib/supabase/client';

// Get user
const supabase = createClient();
const { data: { user } } = await supabase.auth.getUser();

// Sign out
await supabase.auth.signOut();
router.push('/auth');
```

### API Auth (Handled Automatically):
```typescript
// OpenAPI client automatically adds auth headers
// See: src/lib/my-api.ts

export const createClientConfig: CreateClientConfig = (clientConfig) => ({
  ...clientConfig,
  auth: async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  },
  baseURL: config.BACKEND_URL,
});
```

---

## Routing Conventions

### Dashboard Routes:
```
/dashboard             - Main dashboard with chat
/agents                - Agent management
/agents/threads/{id}   - Thread conversation
/threads               - All threads list
/knowledge             - Knowledge base
/settings              - Settings hub
/settings/api-keys     - API keys management
/projects              - Projects list
/projects/{id}         - Project details
/projects/{id}/vector-stores              - Vector stores list (project-scoped)
/projects/{id}/vector-stores/{vsId}       - Vector store details with pages
/projects/{id}/vector-stores/{vsId}/pages/{pageId} - Page details with sections
```

### Route Components:
```typescript
// Page component
export default function MyPage() {
  return <PageContent />;
}

// Client component (if needed)
'use client';
export function PageContent() {
  // Use hooks here
}
```

---

## Common Pitfalls & Solutions

### ❌ Wrong: Direct Supabase for Business Logic
```typescript
const { data } = await supabase.from('agents').select('*');
```

### ✅ Right: Use OpenAPI Client
```typescript
const response = await AgentsService.list_agents();
```

---

### ❌ Wrong: Manual Type Definitions
```typescript
interface Agent {
  agent_id: string;
  name: string;
}
```

### ✅ Right: Use Generated Types
```typescript
import type { AgentPublic } from '@/client/types.gen';
```

---

### ❌ Wrong: Hardcoded API URLs
```typescript
await fetch('http://localhost:8000/api/v1/agents')
```

### ✅ Right: Use Service
```typescript
await AgentsService.list_agents()
```

---

### ❌ Wrong: Inline Loading States
```typescript
{isLoading && <div>Loading...</div>}
{data && <div>{data}</div>}
```

### ✅ Right: Early Returns
```typescript
if (query.isLoading) return <Skeleton />;
if (query.error) return <Error />;

const data = query.data || [];
```

---

## Backend Schema Principles

### UUID as Primary Keys:
```python
id: UUID = Field(default_factory=uuid.uuid4, primary_key=True)
```

### Timestamps:
```python
created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

### Foreign Keys with Cascade:
```python
owner_id: UUID = Field(foreign_key="user.id", ondelete="CASCADE")
```

### Optional Fields:
```python
description: str | None = Field(default=None)  # Optional in Python
description?: string | null;  // Optional in TypeScript
```

### Enums:
```python
# Backend
status: str  # Could be literal type

# Frontend (from OpenAPI)
status: 'active' | 'revoked' | 'expired';
```

---

## Code Organization

### Hook Files:
```
src/hooks/
  use-agents.ts        - Agent CRUD
  use-threads.ts       - Thread CRUD
  use-knowledge-base.ts - KB operations
  use-vector-stores.ts - Vector store, page, and section CRUD
  use-initiate-agent.ts - Special operations
```

### Component Structure:
```
src/app/(dashboard)/
  {feature}/
    page.tsx                    - Route
    _components/
      {feature}-header.tsx
      {feature}-content.tsx
      
src/components/
  {feature}/
    {feature}-card.tsx          - Reusable
    {feature}-dialog.tsx
```

---

## Performance Tips

### Parallel Tool Calls:
```typescript
// Good - Parallel reads
const [agents, threads, stats] = await Promise.all([
  AgentsService.list_agents(),
  ThreadsService.list_user_threads(),
  KnowledgeBaseService.get_kb_stats(),
]);

// Bad - Sequential
const agents = await AgentsService.list_agents();
const threads = await ThreadsService.list_user_threads();
```

### Query Invalidation:
```typescript
// Specific invalidation
queryClient.invalidateQueries({ queryKey: ['agents'] });

// Cascade invalidation
queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
queryClient.invalidateQueries({ queryKey: ['agents'] });
```

---

## Environment Variables

### Required:
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Access:
```typescript
import { config } from '@/lib/config';

const API_URL = config.BACKEND_URL;
```

---

## Testing Approach

### Query Testing:
```typescript
const { result } = renderHook(() => useAgents(), {
  wrapper: createQueryWrapper(),
});

await waitFor(() => expect(result.current.isSuccess).toBe(true));
expect(result.current.data).toBeDefined();
```

---

## Key Learnings

### 1. **OpenAPI First**
Always check OpenAPI client before implementing. If endpoint exists, use it. Never duplicate with fetch.

### 2. **Type Safety**
OpenAPI types are the source of truth. Never create manual interfaces for API data.

### 3. **Separation of Concerns**
- **Supabase:** Auth, Storage, Realtime only
- **OpenAPI:** All business logic, CRUD operations
- **Zustand:** Client-side state only

### 4. **Response Unwrapping**
Backend returns paginated responses as:
```typescript
{
  data: [...items],
  pagination: { total, page, limit }
}
```
Always unwrap: `response.data?.data || []`

### 5. **Property Naming**
Backend uses snake_case in schemas but OpenAPI generates camelCase for TypeScript.
Check generated types, don't assume!

### 6. **Error Handling**
Let mutations handle errors in `onError`. Don't wrap every mutateAsync in try/catch unless you need custom handling.

### 7. **Loading States**
Use `isPending` for mutations (TanStack Query v5), `isLoading` for queries.

### 8. **Optimistic Updates**
Not implemented yet. Add when needed:
```typescript
onMutate: async (newData) => {
  await queryClient.cancelQueries({ queryKey: ['agents'] });
  const previous = queryClient.getQueryData(['agents']);
  queryClient.setQueryData(['agents'], (old) => [...old, newData]);
  return { previous };
},
onError: (err, newData, context) => {
  queryClient.setQueryData(['agents'], context.previous);
},
```

---

## Backend Patterns to Remember

### FastAPI Route Pattern:
```python
@router.{method}(
    "/resource/{id}",
    response_model=ResponseSchema,
    summary="Description",
    operation_id="unique_operation_id",  # Used for OpenAPI generation
)
async def operation_name(
    session: SessionDep,
    current_user: CurrentUser,
    {id}: UUID,
    data: RequestSchema,
) -> ResponseSchema:
    # Logic here
    return result
```

### Dependencies:
- `SessionDep` - Database session
- `CurrentUser` - Authenticated user
- Both injected automatically

### CRUD Helper Pattern:
```python
from app.crud import agents as crud

# Create
agent = crud.create_agent(session, user_id, agent_data)

# Read
agent = crud.get_agent_by_id(session, agent_id, user_id)
agents = crud.get_agents(session, user_id, skip=0, limit=100)

# Update
agent = crud.update_agent(session, agent_id, user_id, updates)

# Delete
crud.delete_agent(session, agent_id, user_id)
```

### Always Check Ownership:
```python
agent = crud.get_agent_by_id(session, agent_id, user_id)
if not agent:
    raise HTTPException(status_code=404, detail="Agent not found")
```

---

## Quick Reference

### Create New Feature:

1. **Backend:**
   - Add model in `backend/app/models/{feature}.py`
   - Add schema in `backend/app/schemas/{feature}.py`
   - Add CRUD in `backend/app/crud/{feature}.py`
   - Add router in `backend/app/routers/{feature}.py`
   - Include router in `backend/app/api/main.py`

2. **Frontend:**
   - Run `npm run client:generate` in frontend3
   - Create hook in `src/hooks/use-{feature}.ts`
   - Create page in `src/app/(dashboard)/{feature}/page.tsx`
   - Create components in `src/components/{feature}/`
   - Add to sidebar navigation

3. **Test:**
   - Backend: Swagger UI at `/docs`
   - Frontend: Use the UI
   - Check browser console for errors

---

## Debugging Tips

### Check OpenAPI Schema:
```
http://localhost:8000/api/v1/openapi.json
```

### Check Generated Types:
```typescript
// In VSCode, Cmd+Click on type name
import type { AgentPublic } from '@/client/types.gen';
```

### Query DevTools:
```typescript
// Add to layout:
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
<ReactQueryDevtools initialIsOpen={false} />
```

### Check Network Tab:
- Request payload format
- Response structure
- Status codes
- Headers (especially Auth)

---

## Summary

**Golden Rules:**
1. ✅ OpenAPI client for all API calls
2. ✅ Generated types, never manual
3. ✅ TanStack Query for data fetching
4. ✅ Zustand for client state
5. ✅ Supabase only for auth/storage
6. ✅ Toast for user feedback
7. ✅ Loading states everywhere
8. ✅ Error handling in mutations

**This ensures:**
- Type safety
- Consistency
- Maintainability
- Scalability

Follow these patterns and the codebase stays clean! 🎯

