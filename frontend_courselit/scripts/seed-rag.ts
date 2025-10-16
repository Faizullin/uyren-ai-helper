// import CourseModel from "@/models/Course";
// import { createClient, createOpenAI, embed, RecursiveCharacterTextSplitter } from "@workspace/ai-bot/vercel-spbs/server";
// import { connectToDatabase } from "@workspace/common-logic";
// import { createHash } from 'crypto';

// import "dotenv/config";

// type Meta = {
//   title: string
//   courseId: string
//   level: string
//   tags: string[]
//   source: string
// }

// type Section = {
//   content: string
//   heading?: string
//   slug?: string
// }

// type ProcessedCourse = {
//   checksum: string
//   meta: Meta
//   sections: Section[]
// }

// /**
//  * Processes course content for search indexing.
//  * Uses RecursiveCharacterTextSplitter for proper text chunking.
//  */
// async function processCourseForSearch(content: string, courseData: any, splitter: RecursiveCharacterTextSplitter): Promise<ProcessedCourse> {
//   const checksum = createHash('sha256').update(content).digest('base64')

//   const meta = {
//     title: courseData.title,
//     courseId: courseData.courseId,
//     level: courseData.level,
//     tags: courseData.tags,
//     source: 'course'
//   }

//   // Use RecursiveCharacterTextSplitter to properly chunk the content
//   const chunks = await splitter.splitText(content)

//   const sections: Section[] = chunks
//     .map((chunk, index) => {
//       const trimmedChunk = chunk.trim()
//       if (trimmedChunk.length === 0) {
//         return null
//       }

//       // Try to extract heading from first line if it looks like a heading
//       const lines = trimmedChunk.split('\n')
//       const firstLine = lines[0]?.trim()
//       let heading: string | undefined
//       let content = trimmedChunk

//       // Simple heading detection (lines that are short and don't end with punctuation)
//       if (firstLine && firstLine.length < 100 && !firstLine.endsWith('.') && !firstLine.endsWith('!') && !firstLine.endsWith('?')) {
//         heading = firstLine
//         content = lines.slice(1).join('\n').trim() || trimmedChunk
//       }

//       // Create slug from heading or use index
//       const slug = heading ? heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : `section-${index}`

//       return {
//         content,
//         heading,
//         slug
//       } as Section
//     })
//     .filter((section): section is Section => section !== null)

//   return {
//     checksum,
//     meta,
//     sections,
//   }
// }

// async function generateEmbeddings() {
//   // Check for refresh flag from command line arguments
//   const shouldRefresh = process.argv.includes('--refresh') || process.argv.includes('-r')

//   if (
//     !process.env.NEXT_PUBLIC_RAG_SUPABASE_URL ||
//     !process.env.RAG_SUPABASE_SERVICE_ROLE_KEY ||
//     !process.env.OPENAI_API_KEY
//   ) {
//     return console.log(
//       'Environment variables NEXT_PUBLIC_RAG_SUPABASE_URL, RAG_SUPABASE_SERVICE_ROLE_KEY, and OPENAI_API_KEY are required: skipping embeddings generation'
//     )
//   }

//   // Connect to MongoDB
//   await connectToDatabase();

//   const credentials = {
//     url: process.env.NEXT_PUBLIC_RAG_SUPABASE_URL!,
//     key: process.env.RAG_SUPABASE_SERVICE_ROLE_KEY!,
//   }

//   const supabaseClient = createClient(
//     credentials.url,
//     credentials.key,
//     {
//       auth: {
//         persistSession: false,
//         autoRefreshToken: false,
//       },
//     }
//   )

//   const openai = createOpenAI({
//     apiKey: process.env.OPENAI_API_KEY,
//   });

//   const splitter = new RecursiveCharacterTextSplitter({
//     chunkSize: 512,
//     chunkOverlap: 100,
//   });

//   // const scrapePage = async (url: string) => {
//   //     const loader = new PuppeteerWebBaseLoader(url, {
//   //         launchOptions: {
//   //             headless: true,
//   //         },
//   //         gotoOptions: {
//   //             waitUntil: "domcontentloaded",
//   //         },
//   //         evaluate: async (page, browser) => {
//   //             const result = await page.evaluate(() => document.body.innerHTML);
//   //             await browser.close();
//   //             return result;
//   //         },
//   //     });
//   //     const htmlContent = await loader.scrape();
//   //     return convertContentToMarkdown(htmlContent);
//   // };

//   // const loadData = async (webpages: string[]) => {
//   //     for await (const url of webpages) {
//   //         console.log(`Scraping: ${url}`);
//   //         const content = await scrapePage(url);
//   //         const chunks = await splitter.splitText(content);

//   //         console.log(`Processing ${chunks.length} chunks from ${url}`);

//   //         for await (const chunk of chunks) {
//   //             const { embedding } = await embed({
//   //                 model: openai.embedding("text-embedding-3-small"),
//   //                 value: chunk,
//   //             });

//   //             const { error } = await supabase.from("documents").insert({
//   //                 content: chunk,
//   //                 embedding: embedding,
//   //                 metadata: { url, source: 'web_scrape' },
//   //                 created_at: new Date().toISOString(),
//   //                 updated_at: new Date().toISOString(),
//   //             });

//   //             if (error) {
//   //                 console.error("Error inserting chunk:", error);
//   //             } else {
//   //                 console.log("✓ Chunk inserted successfully");
//   //             }
//   //         }
//   //     }
//   // };

//   console.log("Loading courses from MongoDB...");
//   const courses = await CourseModel.find().limit(10);

//   console.log(`Discovered ${courses.length} courses`);

//   if (!shouldRefresh) {
//     console.log('Checking which courses are new or have changed')
//   } else {
//     console.log('Refresh flag set, re-generating all courses')
//   }

//   for (const course of courses) {
//     const courseId = course.courseId;
//     const path = `/courses/${courseId}`;
//     const type = 'course';
//     const source = 'course';

//     try {
//       // Prepare course content for processing
//       let courseContent = '';
//       if (course.shortDescription) {
//         courseContent += course.shortDescription + '\n\n';
//       }
//       if (course.description) {
//         const tmpContentStr = course.description.content.replace(/<[^>]*>?/gm, "");
//         courseContent += tmpContentStr;
//       }

//       if (!courseContent.trim()) {
//         console.log(`[${path}] Skipping course with no content`);
//         continue;
//       }

//       const { checksum, meta, sections } = await processCourseForSearch(courseContent, course, splitter);
//       console.log("sections", {
//         sections,
//         checksum,
//         meta,
//       });
//       // Check for existing course in DB and compare checksums
//       const { error: fetchCourseError, data: existingCourse } = await supabaseClient
//         .from('nods_page')
//         .select('id, path, checksum')
//         .filter('path', 'eq', path)
//         .limit(1)
//         .maybeSingle()

//       if (fetchCourseError) {
//         throw fetchCourseError
//       }

//       // We use checksum to determine if this course & its sections need to be regenerated
//       if (!shouldRefresh && existingCourse?.checksum === checksum) {
//         console.log(`[${path}] Course unchanged, skipping`);
//         continue
//       }

//       if (existingCourse) {
//         if (!shouldRefresh) {
//           console.log(
//             `[${path}] has changed, removing old course sections and their embeddings`
//           )
//         } else {
//           console.log(`[${path}] Refresh flag set, removing old course sections and their embeddings`)
//         }

//         const { error: deleteCourseSectionError } = await supabaseClient
//           .from('nods_page_section')
//           .delete()
//           .filter('page_id', 'eq', existingCourse.id)

//         if (deleteCourseSectionError) {
//           throw deleteCourseSectionError
//         }
//       }

//       // Create/update course record. Intentionally clear checksum until we
//       // have successfully generated all course sections.
//       const { error: upsertCourseError, data: coursePage } = await supabaseClient
//         .from('nods_page')
//         .upsert(
//           {
//             checksum: null,
//             path,
//             type,
//             source,
//             meta,
//           },
//           { onConflict: 'path' }
//         )
//         .select()
//         .limit(1)
//         .single()

//       if (upsertCourseError) {
//         throw upsertCourseError
//       }

//       console.log(`[${path}] Adding ${sections.length} course sections (with embeddings)`)
//       for (const { slug, heading, content } of sections) {
//         // OpenAI recommends replacing newlines with spaces for best results (specific to embeddings)
//         const input = content.replace(/\n/g, ' ')

//         try {
//           const { embedding } = await embed({
//             model: openai.embedding("text-embedding-3-small"),
//             value: input,
//           });

//           const { error: insertCourseSectionError, data: courseSection } = await supabaseClient
//             .from('nods_page_section')
//             .insert({
//               page_id: coursePage.id,
//               slug,
//               heading,
//               content,
//               token_count: 0, // We don't have token count from our embed function
//               embedding: embedding,
//             })
//             .select()
//             .limit(1)
//             .single()

//           if (insertCourseSectionError) {
//             throw insertCourseSectionError
//           }
//         } catch (err) {
//           console.error(
//             `Failed to generate embeddings for '${path}' course section starting with '${input.slice(
//               0,
//               40
//             )}...'`
//           )

//           throw err
//         }
//       }

//       // Set course checksum so that we know this course was stored successfully
//       const { error: updateCourseError } = await supabaseClient
//         .from('nods_page')
//         .update({ checksum })
//         .filter('id', 'eq', coursePage.id)

//       if (updateCourseError) {
//         throw updateCourseError
//       }

//       console.log(`[${path}] Course processing completed successfully`);
//     } catch (err) {
//       console.error(
//         `Course '${path}' or one/multiple of its course sections failed to store properly. Course has been marked with null checksum to indicate that it needs to be re-generated.`
//       )
//       console.error(err)
//     }
//   }

//   console.log('Embedding generation complete')

//   // Explicitly close the MongoDB connection and exit
//   const disconnectFn = global.mongoose?.conn?.disconnect;
//   if (disconnectFn) {
//     await disconnectFn();
//   }
// }

// export const seedDatabase = async () => {
//   await generateEmbeddings()
// }

// async function main() {
//   await generateEmbeddings()
// }


// main().catch((err) => console.error(err))