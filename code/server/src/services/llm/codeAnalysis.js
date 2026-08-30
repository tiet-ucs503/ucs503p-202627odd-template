import { GoogleGenAI } from "@google/genai";

/**
 * Analyze code complexity using Gemini 2.0 Flash.
 * Returns structured time/space complexity analysis.
 *
 * @param {object} params
 * @param {string} params.code        - The accepted solution source code
 * @param {string} params.problemTitle - LeetCode problem title
 * @param {string} params.difficulty   - "Easy" | "Medium" | "Hard"
 * @param {string} [params.language]   - Programming language (optional)
 * @returns {Promise<{
 *   actualTimeComplexity: string,
 *   actualSpaceComplexity: string,
 *   optimalTimeComplexity: string,
 *   optimalSpaceComplexity: string,
 *   explanation: string
 * }>}
 */
/**
 * Analyze code complexity and pedagogical feedback using Gemini.
 * Returns structured time/space complexity analysis + rich qualitative evaluation.
 *
 * @param {object} params
 * @param {string} params.code           - The accepted solution source code
 * @param {string} [params.problemTitle] - LeetCode problem title
 * @param {string} [params.difficulty]   - "Easy" | "Medium" | "Hard"
 * @param {string} [params.language]     - Programming language (optional)
 * @param {object} [params.problemContext] - Additional problem context (description, patterns, constraints)
 * @returns {Promise<{
 *   actualTimeComplexity: string,
 *   actualSpaceComplexity: string,
 *   optimalTimeComplexity: string,
 *   optimalSpaceComplexity: string,
 *   explanation: string,
 *   richAnalysis: {
 *     problemUnderstanding: string,
 *     yourApproach: string,
 *     correctness: string,
 *     optimalApproach: string,
 *     comparison: string,
 *     efficiencyAssessment: string,
 *     improvementSuggestions: string
 *   }
 * }>}
 */
export async function analyzeCodeComplexity({
  code,
  problemTitle,
  difficulty,
  language,
  problemContext = {},
}) {
  const title = problemContext.title || problemTitle || "Unknown Problem";
  const diff = problemContext.difficulty || difficulty || "Medium";
  const patterns = Array.isArray(problemContext.patterns) && problemContext.patterns.length > 0
    ? problemContext.patterns.join(", ")
    : "General DSA";
  
  // Clean description if available
  let cleanDescription = "";
  if (problemContext.description) {
    cleanDescription = problemContext.description
      .replace(/<[^>]*>?/gm, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
    if (cleanDescription.length > 3000) {
      cleanDescription = cleanDescription.slice(0, 3000) + "... (truncated)";
    }
  }

  const prompt = `You are an elite competitive programming and algorithm analysis expert.
Analyze the following ${language || "code"} solution for the LeetCode problem "${title}" (${diff}).
Associated DSA Patterns: ${patterns}

${cleanDescription ? `--- PROBLEM STATEMENT & CONSTRAINTS ---\n${cleanDescription}\n--------------------------------------\n` : ""}

--- USER CODE ---
\`\`\`${language || ""}
${code}
\`\`\`
-----------------

Evaluate this code strictly in the context of the problem requirements and constraints.
Determine:
1. The actual time complexity of this specific solution (e.g. "O(N)", "O(N log N)", "O(N^2)")
2. The actual space complexity of this specific solution (e.g. "O(1)", "O(N)")
3. The optimal/best-known time complexity for this problem under given constraints
4. The optimal/best-known space complexity for this problem under given constraints
5. A concise 1-2 sentence complexity explanation
6. A rich pedagogical breakdown:
   - problemUnderstanding: Concise breakdown of what problem requires and key constraints (e.g., input bounds).
   - yourApproach: Algorithmic approach the user used (data structures, loops, recursion) and how it functions.
   - correctness: Evaluation of logical correctness, edge cases handled, or potential hidden bugs.
   - optimalApproach: The standard/optimal approach and why it is best suited for the constraints.
   - comparison: Direct comparison between user's approach and the optimal approach (time/space tradeoffs, constraint suitability).
   - efficiencyAssessment: Evaluation of efficiency, constraint feasibility, and whether there are redundant operations.
   - improvementSuggestions: 1-2 actionable, concrete suggestions for cleaner or more optimal code.

Return ONLY a valid JSON object with EXACTLY this structure:
{
  "actualTimeComplexity": "O(...)",
  "actualSpaceComplexity": "O(...)",
  "optimalTimeComplexity": "O(...)",
  "optimalSpaceComplexity": "O(...)",
  "explanation": "...",
  "richAnalysis": {
    "problemUnderstanding": "...",
    "yourApproach": "...",
    "correctness": "...",
    "optimalApproach": "...",
    "comparison": "...",
    "efficiencyAssessment": "...",
    "improvementSuggestions": "..."
  }
}`;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const interaction = await ai.interactions.create({
      model: "gemini-3.6-flash",
      input: prompt,
    });

    let text = interaction.output_text || "";
    if (text.startsWith("```json")) {
      text = text.replace(/^```json/, "").replace(/```$/, "");
    } else if (text.startsWith("```")) {
      text = text.replace(/^```/, "").replace(/```$/, "");
    }

    const analysis = JSON.parse(text.trim());

    // Validate essential complexity fields
    const required = [
      "actualTimeComplexity",
      "actualSpaceComplexity",
      "optimalTimeComplexity",
      "optimalSpaceComplexity",
    ];

    for (const field of required) {
      if (!analysis[field]) {
        analysis[field] = "O(N)"; // Safe fallback
      }
    }

    if (!analysis.explanation) {
      analysis.explanation = `${analysis.actualTimeComplexity} time, ${analysis.actualSpaceComplexity} space.`;
    }

    // Ensure richAnalysis object exists with fallbacks
    if (!analysis.richAnalysis || typeof analysis.richAnalysis !== "object") {
      analysis.richAnalysis = {
        problemUnderstanding: `Problem: ${title} (${diff})`,
        yourApproach: analysis.explanation,
        correctness: "Solution passed test cases.",
        optimalApproach: `Target complexity: ${analysis.optimalTimeComplexity} time, ${analysis.optimalSpaceComplexity} space.`,
        comparison: analysis.actualTimeComplexity === analysis.optimalTimeComplexity ? "Approach matches optimal time complexity." : "Approach is non-optimal.",
        efficiencyAssessment: "Evaluation completed.",
        improvementSuggestions: "Review optimal algorithmic patterns for this problem."
      };
    }

    return analysis;
  } catch (error) {
    console.error("[LLM] Gemini analysis failed:", error.message);
    throw new Error(`LLM Analysis failed: ${error.message}`);
  }
}

