// import { createClient, createOpenAI, embed } from "@workspace/ai-bot/vercel-spbs/server";
// import { connectToDatabase } from "@workspace/common-logic";
// import * as readline from 'readline';

// import "dotenv/config";
// import { generateText } from "ai";

// interface SearchResult {
//     id: string;
//     content: string;
//     metadata: {
//         courseId?: string;
//         title?: string;
//         source?: string;
//         tags?: string[];
//         level?: string;
//         heading?: string;
//         slug?: string;
//         path?: string;
//     };
//     similarity?: number;
// }

// class RAGSearchTester {
//     private supabase!: ReturnType<typeof createClient>;
//     private openai!: ReturnType<typeof createOpenAI>;
//     private rl: readline.Interface;

//     constructor() {
//         this.rl = readline.createInterface({
//             input: process.stdin,
//             output: process.stdout
//         });
//     }

//     async initialize() {
//         // Connect to MongoDB
//         await connectToDatabase();

//         const credentials = {
//             url: process.env.NEXT_PUBLIC_RAG_SUPABASE_URL!,
//             key: process.env.RAG_SUPABASE_SERVICE_ROLE_KEY!,
//         }

//         if (!credentials.url || !credentials.key || !process.env.OPENAI_API_KEY) {
//             throw new Error('Missing required environment variables: NEXT_PUBLIC_RAG_SUPABASE_URL, RAG_SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY');
//         }

//         this.supabase = createClient(credentials.url, credentials.key, {
//             auth: {
//                 persistSession: false,
//                 autoRefreshToken: false,
//             },
//         });

//         this.openai = createOpenAI({
//             apiKey: process.env.OPENAI_API_KEY,
//         });

//         console.log("✅ RAG Search Tester initialized successfully!");
//     }

//     async searchSimilarDocuments(query: string, limit = 5): Promise<SearchResult[]> {
//         console.log(`🔍 Searching for: "${query}"`);

//         // Generate embedding for the query
//         const { embedding } = await embed({
//             model: this.openai.embedding("text-embedding-3-small"),
//             value: query,
//         });

//         // Search using the nods_page_section RPC function
//         const { error, data } = await this.supabase!.rpc(
//             'match_page_sections',
//             {
//                 embedding: embedding,
//                 match_threshold: 0.2,
//                 match_count: limit,
//                 min_content_length: 50,
//             } as any
//         ) as any;


//         if (error) {
//             console.error("❌ Search error:", error);
//             return [];
//         }

//         console.log("🔍 Search results:", data?.length || 0, "documents found");

//         return data.map((doc: any) => ({
//             id: doc.id,
//             content: doc.content,
//             metadata: {
//                 courseId: doc.course_id,
//                 title: doc.title,
//                 source: doc.source,
//                 tags: doc.tags,
//                 level: doc.level,
//                 heading: doc.heading,
//                 slug: doc.slug,
//                 path: doc.path
//             },
//             similarity: doc.similarity
//         }));
//     }


//     private calculateCosineSimilarity(a: number[], b: number[]): number {
//         if (a.length !== b.length) return 0;

//         let dotProduct = 0;
//         let normA = 0;
//         let normB = 0;

//         for (let i = 0; i < a.length; i++) {
//             dotProduct += (a[i] || 0) * (b[i] || 0);
//             normA += (a[i] || 0) * (a[i] || 0);
//             normB += (b[i] || 0) * (b[i] || 0);
//         }

//         return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
//     }

//     async generateAnswer(query: string, context: SearchResult[]): Promise<string> {
//         if (context.length === 0) {
//             return "I couldn't find any relevant information to answer your question.";
//         }

//         // Prepare context from search results
//         const contextText = context.map((result, index) => {
//             const metadata = result.metadata;
//             const source = metadata.title || metadata.courseId || 'Unknown source';
//             const heading = metadata.heading ? ` (${metadata.heading})` : '';
//             return `[${index + 1}] Source: ${source}${heading}\nContent: ${result.content}\n`;
//         }).join('\n');

//         const prompt = `Based on the following context from course materials, please answer the user's question. If the answer cannot be found in the context, please say so.

// Context:
// ${contextText}

// Question: ${query}

// Answer:`;

//         try {
//             const response =  await generateText({
//                 model: this.openai("gpt-3.5-turbo"),
//                 messages: [
//                     {
//                         role: "system",
//                         content: "You are a helpful assistant that answers questions based on course materials. Provide accurate, helpful answers based only on the provided context."
//                     },
//                     {
//                         role: "user",
//                         content: prompt
//                     }
//                 ],
//                 maxOutputTokens: 500,
//                 temperature: 0.7
//             });

//             return response.text || "I couldn't generate an answer.";
//         } catch (error) {
//             console.error("Error generating answer:", error);
//             return "I encountered an error while generating an answer.";
//         }
//     }

//     async askQuestion(question: string): Promise<void> {
//         console.log(`\n🤔 Question: ${question}`);
//         console.log("🔍 Searching for relevant information...\n");

//         try {
//             // Search using the documents table
//             const searchResults = await this.searchSimilarDocuments(question, 3);

//             if (searchResults.length === 0) {
//                 console.log("❌ No relevant information found.");
//                 return;
//             }

//             // Display search results
//             console.log("📚 Found relevant information:");
//             searchResults.forEach((result, index) => {
//                 const metadata = result.metadata;
//                 const source = metadata.title || metadata.courseId || 'Unknown';
//                 const heading = metadata.heading ? ` - ${metadata.heading}` : '';
//                 const similarity = (result.similarity! * 100).toFixed(1);

//                 console.log(`\n[${index + 1}] ${source}${heading} (${similarity}% match)`);
//                 console.log(`   ${result.content.substring(0, 200)}${result.content.length > 200 ? '...' : ''}`);
//             });

//             // Generate and display answer
//             console.log("\n🤖 Generating answer...\n");
//             const answer = await this.generateAnswer(question, searchResults);
//             console.log("💡 Answer:");
//             console.log(answer);

//         } catch (error) {
//             console.error("❌ Error processing question:", error);
//         }
//     }

//     async interactiveMode(): Promise<void> {
//         console.log("\n🎯 RAG Search Tester - Interactive Mode");
//         console.log("Ask questions about your course content. Type 'quit' or 'exit' to stop.\n");

//         const askQuestion = (): void => {
//             this.rl.question("❓ Enter your question: ", async (input) => {
//                 const question = input.trim();

//                 if (question.toLowerCase() === 'quit' || question.toLowerCase() === 'exit') {
//                     console.log("\n👋 Goodbye!");
//                     this.rl.close();
//                     return;
//                 }

//                 if (question.length === 0) {
//                     console.log("Please enter a question.\n");
//                     askQuestion();
//                     return;
//                 }

//                 await this.askQuestion(question);
//                 console.log("\n" + "=".repeat(80) + "\n");
//                 askQuestion();
//             });
//         };

//         askQuestion();
//     }

//     // async testWithSampleQuestions(): Promise<void> {
//     //     console.log("\n🧪 Testing with sample questions...\n");

//     //     const sampleQuestions = [
//     //         "What is this course about?",
//     //         "What are the main topics covered?",
//     //         "What level is this course for?",
//     //         "What skills will I learn?",
//     //         "How long does it take to complete?"
//     //     ];

//     //     for (const question of sampleQuestions) {
//     //         await this.askQuestion(question);
//     //         console.log("\n" + "=".repeat(80) + "\n");
//     //     }
//     // }

//     // async showStats(): Promise<void> {
//     //     console.log("\n📊 Database Statistics:\n");

//     //     try {
//     //         // Get page count
//     //         const { count: pageCount, error: pageError } = await this.supabase
//     //             .from('nods_page')
//     //             .select('*', { count: 'exact', head: true });

//     //         if (pageError) {
//     //             console.error("Error getting page count:", pageError);
//     //         } else {
//     //             console.log(`📄 Total pages: ${pageCount}`);
//     //         }

//     //         // Get section count
//     //         const { count: sectionCount, error: sectionError } = await this.supabase
//     //             .from('nods_page_section')
//     //             .select('*', { count: 'exact', head: true });

//     //         if (sectionError) {
//     //             console.error("Error getting section count:", sectionError);
//     //         } else {
//     //             console.log(`📝 Total sections: ${sectionCount}`);
//     //         }

//     //         // Get sections with embeddings
//     //         const { count: embeddedSections, error: embeddedError } = await this.supabase
//     //             .from('nods_page_section')
//     //             .select('*', { count: 'exact', head: true })
//     //             .not('embedding', 'is', null);

//     //         if (embeddedError) {
//     //             console.error("Error getting embedded sections count:", embeddedError);
//     //         } else {
//     //             console.log(`🔗 Sections with embeddings: ${embeddedSections}`);
//     //         }

//     //         // Get course pages
//     //         const { data: coursePages, error: courseError } = await this.supabase
//     //             .from('nods_page')
//     //             .select('id, path, type, source, meta, checksum')
//     //             .eq('type', 'course')
//     //             .not('checksum', 'is', null);

//     //         if (courseError) {
//     //             console.error("Error getting course pages:", courseError);
//     //         } else {
//     //             console.log(`🎓 Course pages: ${coursePages?.length || 0}`);
//     //             if (coursePages && coursePages.length > 0) {
//     //                 console.log("   Courses:");
//     //                 coursePages.forEach((page: any) => {
//     //                     const meta = page.meta;
//     //                     if (meta) {
//     //                         console.log(`   - ${meta.title} (${meta.courseId}) - ${page.path}`);
//     //                     }
//     //                 });
//     //             }
//     //         }

//     //         // Get sample sections
//     //         const { data: sampleSections, error: sampleError } = await this.supabase
//     //             .from('nods_page_section')
//     //             .select(`
//     //                 id,
//     //                 content,
//     //                 heading,
//     //                 slug,
//     //                 nods_page!inner(
//     //                     id,
//     //                     path,
//     //                     meta
//     //                 )
//     //             `)
//     //             .not('embedding', 'is', null)
//     //             .limit(5);

//     //         if (sampleError) {
//     //             console.error("Error getting sample sections:", sampleError);
//     //         } else {
//     //             console.log(`\n📚 Sample sections:`);
//     //             sampleSections?.forEach((section: any, index: number) => {
//     //                 const meta = section.nods_page?.meta || {};
//     //                 const source = meta.title || meta.courseId || 'Unknown';
//     //                 const heading = section.heading ? ` - ${section.heading}` : '';
//     //                 const content = section.content.substring(0, 100) + (section.content.length > 100 ? '...' : '');
//     //                 console.log(`   [${index + 1}] ${source}${heading}`);
//     //                 console.log(`       Content: ${content}`);
//     //                 console.log(`       Path: ${section.nods_page?.path}`);
//     //             });
//     //         }

//     //     } catch (error) {
//     //         console.error("Error getting stats:", error);
//     //     }
//     // }
// }

// async function main() {
//     const tester = new RAGSearchTester();

//     try {
//         await tester.initialize();

//         // Check command line arguments
//         const args = process.argv.slice(2);

//         // if (args.includes('--stats') || args.includes('-s')) {
//         //     await tester.showStats();
//         //     return;
//         // }

//         // if (args.includes('--test') || args.includes('-t')) {
//         //     await tester.testWithSampleQuestions();
//         //     return;
//         // }

//         if (args.length > 0) {
//             // Single question mode
//             const question = args.join(' ');
//             await tester.askQuestion(question);
//             return;
//         }

//         // Interactive mode
//         await tester.interactiveMode();

//     } catch (error) {
//         console.error("❌ Failed to initialize RAG Search Tester:", error);
//         process.exit(1);
//     }
// }

// // Handle graceful shutdown
// process.on('SIGINT', () => {
//     console.log('\n👋 Goodbye!');
//     process.exit(0);
// });

// main().catch((error) => {
//     console.error("❌ Error:", error);
//     process.exit(1);
// });
