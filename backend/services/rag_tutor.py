import os
from pathlib import Path
from dotenv import load_dotenv
from groq import Groq
from services.vector_store import search_curriculum, get_curriculum_context

# Load environment variables from backend/.env
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# Initialize the Groq client
api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    print("[RAG Tutor] WARNING: GROQ_API_KEY not found in environment.")

client = Groq(api_key=api_key, timeout=3.0, max_retries=0)

def generate_mission_briefing(mission_id: str) -> str:
    """
    Retrieves syllabus context from the curriculum vector store and prompts 
    the Groq LLM to generate an exciting Spider-Man themed mission briefing.
    """
    print(f"[RAG Tutor] Querying vector store for mission: {mission_id}")
    context = get_curriculum_context(mission_id)
    topic = context["topic"]
    villain = context["boss"]
    formulas_str = "; ".join(context.get("formulas", []))

    system_prompt = (
        "You are the AI interface for Spider-Man's high-tech suit. "
        "You must speak in an urgent, encouraging, and heroic tactical tone. "
        "Keep your response strictly to 2-3 sentences max."
    )
    
    user_prompt = (
        f"Generate a tactical mission briefing for Spider-Man. Target villain: {villain}. "
        f"Objective: Master the math curriculum topic '{topic}'. "
        f"Key tactical formula: {formulas_str}. "
        f"Brief Spider-Man on what to watch out for in battle!"
    )

    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            model="openai/gpt-oss-120b",
            temperature=0.7,
            max_tokens=150,
        )
        
        briefing = chat_completion.choices[0].message.content
        if "<think>" in briefing:
            briefing = briefing.split("</think>")[-1].strip()
        print(f"[RAG Tutor] Generated Briefing:\n{briefing}\n")
        return briefing
    except Exception as e:
        error_msg = f"Failed to generate briefing: {e}"
        print(f"[RAG Tutor] ERROR: {error_msg}")
        return f"Suit AI online. Heads up Spider-Man, {villain} is attacking! Focus on {topic}."

def generate_dynamic_question(villain: str, topic: str, difficulty: str) -> str:
    """
    Generates a dynamic math question in JSON format.
    Retrieves curriculum knowledge (formulas, misconceptions) from the vector store
    to ground question generation.
    """
    # RAG Retrieval
    retrieved = search_curriculum(f"{topic} {villain}", top_k=1)
    context_doc = retrieved[0] if retrieved else get_curriculum_context(villain)
    
    formulas_hint = "; ".join(context_doc.get("formulas", []))
    concept = context_doc.get("core_concept", topic)
    misconceptions = "; ".join(context_doc.get("common_misconceptions", []))

    system_prompt = (
        "You are an expert math curriculum designer writing questions for a superhero video game. "
        "You must output ONLY raw JSON, with no markdown formatting, no introductory text, and no conversational filler. "
        "The output must strictly adhere to the requested JSON schema."
    )
    
    user_prompt = (
        f"Generate a {difficulty} math word problem about '{topic}'. "
        f"Narrative context: Spider-Man fighting {villain}. "
        f"Curriculum ground truth formulas: {formulas_hint}. "
        f"Underlying concept: {concept}. "
        f"Common student pitfalls to design good distractors for: {misconceptions}. "
        f"CRITICAL: Keep the question very short and punchy (MAXIMUM 40 WORDS). "
        "Provide 4 multiple choice options (just the option values, no letter prefixes). Return ONLY JSON in the following format:\n"
        "{\n"
        '  "question": "The short story math problem here",\n'
        '  "options": ["option1", "option2", "option3", "option4"],\n'
        '  "correct_answer": "A",\n'
        '  "explanation": "Brief explanation of the solution"\n'
        "}"
    )
    
    try:
        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            model="openai/gpt-oss-120b",
            temperature=0.7,
            max_tokens=800,
        )
        content = completion.choices[0].message.content
        if "<think>" in content:
            content = content.split("</think>")[-1].strip()
        return content
    except Exception as e:
        print(f"[RAG Tutor] Error generating question (fallback triggered): {e}")
        # Robust offline fallback based on retrieved curriculum
        fallback_questions = {
            "solving linear equations": {
                "question": f"Green Goblin's glider is moving at speed: 3x + 12 = 33. What is x?",
                "options": ["7", "5", "9", "15"],
                "correct_answer": "A",
                "explanation": "Subtract 12 from both sides to get 3x = 21, then divide by 3: x = 7."
            },
            "calculating area and perimeter": {
                "question": "Doc Ock creates an energy grid measuring 8m by 6m. What is its total area?",
                "options": ["48 sq m", "28 sq m", "14 sq m", "96 sq m"],
                "correct_answer": "A",
                "explanation": "Area of rectangle = length * width = 8 * 6 = 48 sq m."
            },
            "number sequences and patterns": {
                "question": "Mysterio projects drones at times: 4, 9, 14, 19... What is the next drone time?",
                "options": ["24", "23", "25", "29"],
                "correct_answer": "A",
                "explanation": "The common difference is +5. 19 + 5 = 24."
            },
            "percentages and fractions": {
                "question": "Venom controls 40% of a 120m skyscraper. How many meters are infected?",
                "options": ["48m", "40m", "60m", "30m"],
                "correct_answer": "A",
                "explanation": "40% of 120 = 0.40 * 120 = 48 meters."
            },
            "radicals and exponents": {
                "question": "Lizard's serum grows at rate 2^3 * 2^2. What is the simplified expression?",
                "options": ["A) 2^5 = 32", "B) 2^6 = 64", "C) 4^5 = 1024", "D) 2^1 = 2"],
                "correct_answer": "A",
                "explanation": "Add the exponents: 2^(3+2) = 2^5 = 32."
            },
            "ratios and proportions": {
                "question": "Kingpin's vault has a 3:5 gold-to-cash ratio. If gold is 15kg, what is cash weight?",
                "options": ["A) 25kg", "B) 20kg", "C) 30kg", "D) 10kg"],
                "correct_answer": "A",
                "explanation": "3/5 = 15/x => 3x = 75 => x = 25kg."
            }
        }
        import json
        selected = fallback_questions.get(topic, list(fallback_questions.values())[0])
        return json.dumps(selected)

def generate_gwen_hint(villain: str, question_text: str, cognitive_state: str) -> str:
    """
    Generates an adaptive hint from Spider-Gwen over comms.
    Retrieves grounded formulas and pedagogical misconceptions from vector store,
    and tailors tone to the student's eye-tracked cognitive state.
    """
    # RAG Retrieval for the question
    retrieved = search_curriculum(f"{villain} {question_text}", top_k=1)
    context_doc = retrieved[0] if retrieved else get_curriculum_context(villain)
    formulas_hint = "; ".join(context_doc.get("formulas", []))
    pedagogy_hint = context_doc.get("scaffolded_hints", {}).get("procedural", "Break down the problem step-by-step.")

    system_prompt = (
        "You are Spider-Gwen (Gwen Stacy) speaking over comms to Spider-Man. "
        "Be witty, heroic, and brief (2 sentences max). "
        "Do not give the final answer letter, but provide an actionable mathematical clue. "
        "Do NOT output thinking process or <think> tags."
    )
    
    # Adaptive instruction based on cognitive state
    if cognitive_state == "Overwhelmed":
        state_instruction = "The user is panicking and overwhelmed. Calms them down first, then give one gentle starting step."
    elif cognitive_state == "Drifting":
        state_instruction = "The user is losing focus and drifting. Make a sharp, energetic callout to snap their attention back!"
    elif cognitive_state == "Impulsive":
        state_instruction = "The user is rushing impulsively and guessing. Warn them to slow down, check the signs and units."
    else:
        state_instruction = "The user is focused. Deliver a quick, sharp tactical formula hint."
        
    user_prompt = (
        f"Spider-Man is facing {villain} and tackling this question: '{question_text}'. "
        f"Math Context / Formula: {formulas_hint}. "
        f"Scaffold guideline: {pedagogy_hint}. "
        f"Cognitive State Adaptation: {state_instruction} "
        f"Give him your Spider-Gwen comms hint now!"
    )
    
    try:
        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            model="openai/gpt-oss-120b",
            temperature=0.8,
            max_tokens=300,
        )
        content = completion.choices[0].message.content
        if "<think>" in content:
            content = content.split("</think>")[-1].strip()
        return content
    except Exception as e:
        print(f"[RAG Tutor] Error generating hint (fallback triggered): {e}")
        # Adapt fallback based on cognitive state
        if cognitive_state == "Overwhelmed":
            return f"Gwen: Take a breath, Pete! Look at the key formula: {formulas_hint}. Just take it one step at a time."
        elif cognitive_state == "Drifting":
            return f"Gwen: Eyes on the target, Spidey! Focus on {context_doc.get('topic', 'the problem')} and isolate your variables!"
        elif cognitive_state == "Impulsive":
            return "Gwen: Woah, slow down! Don't rush into a trap—double check your arithmetic signs before firing!"
        else:
            return f"Gwen: Use the rule: {formulas_hint}. You've got this!"
