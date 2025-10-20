import { defineConfig } from "@hey-api/openapi-ts"

export default defineConfig({
  // Use backend URL to fetch OpenAPI schema
  // You can use environment variable or direct URL
  // Example: http://localhost:8000/openapi.json or https://your-backend.com/openapi.json
  input: process.env.NEXT_PUBLIC_BACKEND_URL 
    ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/openapi.json`
    : "http://localhost:8000/api/v1/openapi.json",
  output: "./src/client",

  plugins: [
    {
      name: "@hey-api/client-axios",
      runtimeConfigPath: "./src/lib/my-api.ts",
    },
    {
      name: "@hey-api/sdk",
      // NOTE: this doesn't allow tree-shaking
      asClass: true,
      operationId: true,
      classNameBuilder: "{{name}}Service",
      methodNameBuilder: (operation) => {
        // @ts-expect-error
        let name: string = operation.name || operation.operationId || 'unknown'
        // @ts-expect-error
        const service: string = operation.service

        if (service && name.toLowerCase().startsWith(service.toLowerCase())) {
          name = name.slice(service.length)
        }

        return name.charAt(0).toLowerCase() + name.slice(1)
      },
      
    },
    {
      name: "@hey-api/schemas",
      type: "json",
    },
  ],
})

