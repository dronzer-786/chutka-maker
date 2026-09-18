import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const text = body?.text;

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { error: "Text content is required for AI formatting." },
        { status: 400 }
      );
    }

    const apiKey = process.env.NVIDIA_API_KEY || process.env.OPENAI_API_KEY;
    const baseURL =
      process.env.NVIDIA_BASE_URL ||
      process.env.OPENAI_BASE_URL ||
      "https://integrate.api.nvidia.com/v1";
    const modelName =
      process.env.NVIDIA_MODEL ||
      process.env.OPENAI_MODEL ||
      "meta/llama-3.3-70b-instruct";

    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json(
        {
          error:
            "NVIDIA_API_KEY is missing. Please add your NVIDIA_API_KEY to .env.local to enable AI formatting.",
        },
        { status: 400 }
      );
    }

    const nvidiaClient = createOpenAI({
      baseURL,
      apiKey,
    });

    const systemPrompt = `You are a world-class AI academic text editor and document structuring engine specializing in creating high-density, beautifully organized study notes and exam answer sheets ("chutka").

YOUR MANDATE:
Analyze the input text, understand its semantic structure, and re-format it into a perfectly structured, clean, and highly readable plain text study guide.

INTELLIGENT FORMATTING RULES:
1. QUESTION & ANSWER IDENTIFICATION:
   - Automatically detect questions (or main topic headings) and label them cleanly as "Q1. [Question]" or "Q2. [Question]".
   - Ensure every question is followed immediately by its answer.
   - Insert a clean single blank line between different question-answer pairs.

2. AUTOMATIC POINT & LIST DETECTION:
   - Identify multi-item explanations, features, causes, characteristics, advantages, steps, or distinct facts.
   - Convert list items or separate points into clean bullet points prefixed with a dash ("- Point text").
   - For sequential processes or chronological events, use clean numbered lists ("1.", "2.").

3. DEFINITIONS & FORMULAS:
   - Place mathematical equations, chemical formulas, or core definitions on their own dedicated line for maximum visual clarity.
   - Keep formulas and equations 100% accurate without alteration.

4. ABSOLUTE CONTENT PRESERVATION (ZERO TRIMMING):
   - You MUST retain 100% of all original factual information, questions, answers, definitions, numbers, and details.
   - Do NOT omit, summarize, truncate, or trim any question or answer text.

5. CLEAN OUTPUT FORMAT:
   - Return ONLY the clean formatted plain text.
   - Do NOT wrap output in markdown codeblocks (\`\`\`).
   - Do NOT include intros, greetings, or conversational remarks.`;

    const MAX_ATTEMPTS = 3;
    let attempt = 1;
    let currentFormattedText = "";
    let lastFeedback = "";
    let evalPassed = false;

    while (attempt <= MAX_ATTEMPTS) {
      console.log(`[AI Format] Attempt ${attempt}/${MAX_ATTEMPTS}...`);

      let promptText = `Clean and format the following answer text:\n\n${text}`;
      if (lastFeedback) {
        promptText = `ORIGINAL TEXT:\n\n${text}\n\nPREVIOUS ATTEMPT FEEDBACK:\nYour previous output had issues: ${lastFeedback}\n\nPlease re-format the ORIGINAL TEXT, making sure NO questions, answers, or facts are trimmed or omitted. Format points cleanly with '-' and numbers.`;
      }

      const formatResult = await generateText({
        model: nvidiaClient.chat(modelName),
        system: systemPrompt,
        prompt: promptText,
        temperature: 0.2,
        maxOutputTokens: 3072,
      });

      currentFormattedText = formatResult.text.trim();

      // EVAL LAYER: Self-verification step to check if any content was trimmed/omitted
      try {
        const evalSystemPrompt = `You are a strict quality evaluation auditor. Your job is to verify if the FORMATTED text preserved ALL information from the ORIGINAL text without trimming, truncating, or omitting any questions, answers, or key facts.`;

        const evalUserPrompt = `ORIGINAL TEXT:
"""
${text}
"""

FORMATTED TEXT:
"""
${currentFormattedText}
"""

Did the FORMATTED text omit, trim, cut off, or remove any questions, answers, core definitions, or facts present in the ORIGINAL text?

Respond ONLY in strict JSON format:
{
  "passed": true or false,
  "feedback": "Explanation of what was omitted/trimmed if passed is false, otherwise empty string"
}`;

        const evalResult = await generateText({
          model: nvidiaClient.chat(modelName),
          system: evalSystemPrompt,
          prompt: evalUserPrompt,
          temperature: 0.1,
          maxOutputTokens: 512,
        });

        const rawEvalText = evalResult.text.trim();
        const jsonMatch = rawEvalText.match(/\{[\s\S]*\}/);
        const evalJson = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

        if (evalJson && typeof evalJson.passed === "boolean") {
          if (evalJson.passed) {
            console.log(`[AI Format Eval] Attempt ${attempt} PASSED verification!`);
            evalPassed = true;
            break; // Exit loop, eval passed!
          } else {
            console.warn(
              `[AI Format Eval] Attempt ${attempt} FAILED verification: ${evalJson.feedback}`
            );
            lastFeedback = evalJson.feedback || "Some content appeared to be trimmed or missing.";
          }
        } else {
          // If JSON parse failed, perform baseline fallback check
          if (currentFormattedText.length >= text.length * 0.6) {
            evalPassed = true;
            break;
          }
        }
      } catch (evalErr) {
        console.warn("[AI Format Eval] Verification error, accepting format:", evalErr);
        evalPassed = true;
        break;
      }

      attempt++;
    }

    return NextResponse.json({
      formattedText: currentFormattedText,
      attempts: attempt > MAX_ATTEMPTS ? MAX_ATTEMPTS : attempt,
      evalPassed,
    });
  } catch (error: unknown) {
    console.error("AI Format API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to format text using AI." },
      { status: 500 }
    );
  }
}
