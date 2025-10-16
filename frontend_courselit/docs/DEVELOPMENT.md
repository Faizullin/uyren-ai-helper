# Development Guide - TRPC Router Patterns

## ✅ **Must-Do Patterns**

### **1. Imports**
```typescript
// ✅ Use common-logic models
import { ModelName, IModelHydratedDocument } from "@workspace/common-logic/models/...";
import { jsonify } from "@workspace/common-logic/lib/response";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import { documentIdValidator } from "@/server/api/core/validators";
import { getFormDataSchema } from "@/server/api/core/schema";
import { paginate } from "@/server/api/core/utils";

// ❌ Don't use old models
import ModelName from "@/models/ModelName";
```

### **2. Input Validation**

#### **For IDs:**
```typescript
// ✅ Always use documentIdValidator()
z.object({ id: documentIdValidator() })

// ❌ Don't use plain strings
z.object({ id: z.string() })
```

#### **For Create/Update:**
```typescript
// ✅ Use getFormDataSchema(fields, params)
getFormDataSchema({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
}, {
  id: documentIdValidator(),  // params (route params like id)
})

// ❌ Don't use .extend()
getFormDataSchema({...}).extend({ id: z.string() })
```

#### **For Retrieve/Delete:**
```typescript
// ✅ Simple object for non-form data
z.object({
  id: documentIdValidator(),
})
```

### **3. Populate Pattern**
```typescript
// ✅ Always use Pick<I...HydratedDocument, "fields">
.populate<{
  owner: Pick<IUserHydratedDocument, "username" | "fullName" | "email">;
}>("owner", "username fullName email")

.populate<{
  tags: Pick<ITagHydratedDocument, "name">[];  // ✅ Note: [] for arrays
}>("tags", "name")

// ❌ Don't populate without types
.populate("owner", "username fullName")
```

### **4. Response Pattern**
```typescript
// ✅ Always use jsonify()
return jsonify(document.toObject());  // For mutations (after save)
return jsonify(document);             // For queries with .lean()

// ❌ Don't return raw documents
return document;
```

### **5. Pagination**
```typescript
// ✅ Use paginate() utility
const paginationMeta = paginate(input.pagination);

const [items, total] = await Promise.all([
  Model.find(query)
    .skip(paginationMeta.skip)
    .limit(paginationMeta.take)
    .lean(),
  paginationMeta.includePaginationCount
    ? Model.countDocuments(query)
    : Promise.resolve(null),
]);

return jsonify({
  items,
  total,
  meta: paginationMeta,
});

// ❌ Don't manually calculate skip/limit
```

### **6. ObjectId Comparisons**
```typescript
// ✅ Use .equals()
if (document.ownerId.equals(ctx.user._id)) { }

// ❌ Don't use .toString()
if (document.ownerId.toString() === ctx.user._id.toString()) { }
```

### **7. Permissions**
```typescript
// ✅ Use UIConstants.permissions directly
checkPermission(ctx.user.permissions, [
  UIConstants.permissions.manageAnyCourse
])

// ❌ Don't destructure permissions
const { permissions } = UIConstants;
checkPermission(ctx.user.permissions, [permissions.manageAnyCourse])
```

### **8. Field Naming Conventions**

#### **For IDs:**
```typescript
// ✅ Use ...Id for single reference
userId: mongoose.Types.ObjectId
ownerId: mongoose.Types.ObjectId

// ✅ Use ...Ids for array of references
tagIds: mongoose.Types.ObjectId[]
paymentPlanIds: mongoose.Types.ObjectId[]
```

#### **For Virtuals:**
```typescript
// ✅ Use ...ById for field, simple name for virtual
interface IModel {
  ownerId: mongoose.Types.ObjectId;  // Field
}

ModelSchema.virtual("owner", {      // Virtual (no "By")
  ref: "User",
  localField: "ownerId",
  foreignField: "_id",
  justOne: true,
});
```

### **9. Query Patterns**

#### **With Populates (read-only):**
```typescript
// ✅ Use .lean() for queries
const doc = await Model.findOne({ _id: id })
  .populate<{ owner: Pick<IUserHydratedDocument, "username"> }>("owner", "username")
  .lean();

return jsonify(doc);
```

#### **For Mutations:**
```typescript
// ✅ Use .toObject() after save
const doc = await Model.create({...});
return jsonify(doc.toObject());

// OR
doc = await doc.save();
return jsonify(doc.toObject());
```

### **10. Model Field Validation**
```typescript
// ✅ Only pass fields that exist in model
const { routeOnlyField, ...modelData } = input.data;

await Model.create({
  ...modelData,
  orgId: ctx.domainData.domainObj.orgId,
  ownerId: ctx.user._id,
});

// ❌ Don't spread all input.data if it contains non-model fields
await Model.create({ ...input.data });
```

## ❌ **Never Do**

### **1. Type Safety**
```typescript
// ❌ Never use 'as any'
(model as any)[key] = value;

// ✅ Use proper typing
Object.keys(data).forEach((key) => {
  (model as any)[key] = (data as any)[key];  // Only when necessary
});
```

### **2. Manual ID Generation**
```typescript
// ❌ Don't manually generate IDs for ObjectId fields
_id: new mongoose.Types.ObjectId()  // Only for embedded subdocs

// ✅ Let Mongoose auto-generate
await Model.create({ title: "..." });  // _id auto-generated
```

### **3. Redundant Fields**
```typescript
// ❌ Don't include redundant _id in populates
.populate<{ owner: Pick<IUserHydratedDocument, "_id" | "username"> }>("owner", "_id username")

// ✅ _id is always included by default
.populate<{ owner: Pick<IUserHydratedDocument, "username"> }>("owner", "username")
```

### **4. Mixed Query/Mutation Patterns**
```typescript
// ❌ Don't mix .lean() with mutations
const doc = await Model.findOne({...}).lean();
doc.title = "new";
await doc.save();  // ❌ Error: .lean() returns plain object

// ✅ Use .lean() only for read-only queries
```

## 📋 **Route Structure Template**

```typescript
export const modelRouter = router({
  // List with pagination
  list: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manage...]))
    .input(ListInputSchema.extend({ /* filters */ }))
    .query(async ({ ctx, input }) => {
      const query: RootFilterQuery<typeof Model> = {
        orgId: ctx.domainData.domainObj.orgId,
      };
      
      if (input.search?.q) {
        query.$text = { $search: input.search.q };
      }
      
      const paginationMeta = paginate(input.pagination);
      const [items, total] = await Promise.all([
        Model.find(query)
          .populate<{ owner: Pick<IUserHydratedDocument, "username"> }>("owner", "username")
          .skip(paginationMeta.skip)
          .limit(paginationMeta.take)
          .lean(),
        paginationMeta.includePaginationCount ? Model.countDocuments(query) : Promise.resolve(null),
      ]);
      
      return jsonify({ items, total, meta: paginationMeta });
    }),

  // Get by ID
  getById: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(z.object({ id: documentIdValidator() }))
    .query(async ({ ctx, input }) => {
      const doc = await Model.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      })
        .populate<{ owner: Pick<IUserHydratedDocument, "username"> }>("owner", "username")
        .lean();
      
      if (!doc) throw new NotFoundException("Model", input.id);
      return jsonify(doc);
    }),

  // Create
  create: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manage...]))
    .input(getFormDataSchema({
      title: z.string().min(1).max(255),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const doc = await Model.create({
        ...input.data,
        orgId: ctx.domainData.domainObj.orgId,
        ownerId: ctx.user._id,
      });
      return jsonify(doc.toObject());
    }),

  // Update
  update: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manage...]))
    .input(getFormDataSchema({
      title: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
    }, {
      id: documentIdValidator(),
    }))
    .mutation(async ({ ctx, input }) => {
      const doc = await Model.findOneAndUpdate(
        { _id: input.id, orgId: ctx.domainData.domainObj.orgId },
        { $set: input.data },
        { new: true },
      );
      if (!doc) throw new NotFoundException("Model", input.id);
      return jsonify(doc.toObject());
    }),

  // Delete
  delete: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manage...]))
    .input(z.object({ id: documentIdValidator() }))
    .mutation(async ({ ctx, input }) => {
      await Model.deleteOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });
      return { success: true };
    }),
});
```

## 🎯 **Key Principles**

1. **Type Safety First** - Always use proper TypeScript types
2. **Consistency** - Follow the same patterns across all routers
3. **Security** - Always check `orgId` and permissions
4. **Clean Code** - Use utility functions (`paginate`, `jsonify`, `documentIdValidator`)
5. **No Redundancy** - Don't pass fields that don't exist in model
6. **Proper Imports** - Use `@workspace/common-logic` models
7. **ObjectId Handling** - Use `.equals()` for comparisons
8. **Populate Types** - Always use `Pick<I...HydratedDocument>`
9. **Response Format** - Always use `jsonify()`
10. **Field Naming** - Use `...Id`/`...Ids` convention consistently

