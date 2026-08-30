import Problem from "../models/Problem.js";
import { analyzeCodeComplexity } from "../services/llm/codeAnalysis.js";

/**
 * Fetch description HTML from LeetCode GraphQL API with timeout and error resilience.
 */
async function fetchLeetCodeDescription(titleSlug) {
  if (!titleSlug) return null;
  const query = `
    query questionContent($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        content
      }
    }
  `;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
      },
      body: JSON.stringify({ query, variables: { titleSlug } }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.question?.content || null;
  } catch (err) {
    console.warn(`[LeetCode Fetch] Failed to fetch description for ${titleSlug}:`, err.message);
    return null;
  }
}

/**
 * POST /api/analyze
 * Called by the Tampermonkey extension to get LLM-powered code complexity and pedagogical analysis.
 *
 * Request body:
 * {
 *   code: string          - The accepted source code
 *   problemTitle: string  - LeetCode problem title
 *   difficulty: string    - "Easy" | "Medium" | "Hard"
 *   language: string      - e.g. "python3", "javascript"
 *   titleSlug?: string    - e.g. "two-sum"
 * }
 */
export const analyzeCode = async (req, res, next) => {
  try {
    const { code, problemTitle, difficulty, language, titleSlug } = req.body;

    // Validate required fields
    if (!code || !problemTitle) {
      return res.status(400).json({
        message: "Missing required fields: code, problemTitle",
      });
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "your_gemini_api_key_here") {
      return res.status(503).json({
        message: "LLM analysis not configured. Please set GEMINI_API_KEY in server .env",
      });
    }

    // 1. Identify and lookup problem in DB
    const slug = (titleSlug || problemTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")).replace(/^-|-$/g, "");
    let problem = await Problem.findOne({
      $or: [
        { titleSlug: slug },
        { title: problemTitle },
      ],
    });

    // 2. Lazy load description if missing
    if (problem && !problem.description) {
      try {
        const fetchedDesc = await fetchLeetCodeDescription(problem.titleSlug || slug);
        if (fetchedDesc) {
          problem.description = fetchedDesc;
          await problem.save();
        }
      } catch (e) {
        console.warn("[Analyze] Error updating cached description:", e.message);
      }
    }

    const problemContext = {
      title: problem?.title || problemTitle,
      difficulty: problem?.difficulty || difficulty || "Medium",
      patterns: problem?.patterns || [],
      description: problem?.description || "",
      titleSlug: problem?.titleSlug || slug,
    };

    // 3. Perform context-aware LLM analysis
    const analysis = await analyzeCodeComplexity({
      code,
      problemTitle: problemContext.title,
      difficulty: problemContext.difficulty,
      language,
      problemContext,
    });

    return res.status(200).json(analysis);
  } catch (error) {
    next(error);
  }
};

