import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

export interface AICompletionRequest {
  action:
    | "improve"
    | "summarize"
    | "expand"
    | "translate"
    | "correct"
    | "custom";
  text: string;
  prompt?: string;
  language?: string;
}

export interface AICompletionResponse {
  success: boolean;
  stream?: ReadableStream;
  error?: string;
}

// Create system prompts for different actions
const getSystemPrompt = (action: string, language?: string) => {
  switch (action) {
    case "improve":
      return "You are a professional writing assistant. Improve the given text by enhancing clarity, structure, and flow while maintaining the original meaning. Make it more engaging and professional.";

    case "summarize":
      return "You are a summarization expert. Create a concise, clear summary that captures the key points and main ideas of the given text.";

    case "expand":
      return "You are a content expansion specialist. Take the given text and expand it with additional context, examples, detailed explanations, and supporting insights while maintaining coherence.";

    case "translate":
      return `You are a professional translator. Translate the given text to ${language || "English"} while maintaining the original tone, style, and meaning.`;

    case "correct":
      return "You are a grammar and spelling expert. Correct any grammatical errors, spelling mistakes, and improve sentence structure while preserving the original meaning and style.";

    case "custom":
      return "You are a helpful AI assistant. Follow the user's specific instructions for processing the given text.";

    default:
      return "You are a helpful AI assistant.";
  }
};

const getUserPrompt = (action: string, text: string, customPrompt?: string) => {
  if (action === "custom" && customPrompt) {
    return `${customPrompt}\n\nText to process: "${text}"`;
  }

  const actionText =
    action === "translate"
      ? "Translate"
      : action === "improve"
        ? "Improve"
        : action === "summarize"
          ? "Summarize"
          : action === "expand"
            ? "Expand"
            : action === "correct"
              ? "Correct"
              : "Process";

  return `${actionText} this text: "${text}"`;
};

export async function POST(request: Request) {
  try {
    const body: AICompletionRequest = await request.json();

    // Validate request
    if (!body.text || !body.action) {
      return Response.json(
        { success: false, error: "Missing required fields: text and action" },
        { status: 400 },
      );
    }

    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { success: false, error: "OpenAI API key not configured" },
        { status: 500 },
      );
    }

    const systemPrompt = getSystemPrompt(body.action, body.language);
    const userPrompt = getUserPrompt(body.action, body.text, body.prompt);

    // Create streaming text completion
    const result = streamText({
      model: openai("gpt-3.5-turbo"),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,
      // maxTokens: 1000,
    });

    // Return streaming response
    return result.toTextStreamResponse();
  } catch (error) {
    console.error("AI completion error:", error);
    return Response.json(
      { success: false, error: "Failed to process AI completion" },
      { status: 500 },
    );
  }
}
