from flask import Flask, request, jsonify
from flask_cors import CORS
from langgraph.graph import StateGraph
from langchain_together import ChatTogether
import os
from dotenv import load_dotenv
from pydantic import BaseModel
import pickle
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from typing import Optional
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()
api_key = os.getenv("TOGETHER_API_KEY")
if not api_key:
    raise ValueError("TOGETHER_API_KEY is missing. Please check your .env file.")

# Initialize Flask app
app = Flask(__name__)
CORS(app, resources={r"/*": {
    "origins": ["http://localhost:3000", "http://127.0.0.1:3000"],
    "methods": ["GET", "POST", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization", "Accept", "Access-Control-Allow-Origin"]
}})

# Define uploads folder and ensure it exists
UPLOAD_FOLDER = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# Global path to the current .txt used for embedding
current_faq_path = os.path.join(UPLOAD_FOLDER, "default.txt")

# Initialize LLM
llm = ChatTogether(
    model="mistralai/Mistral-7B-Instruct-v0.2",
    together_api_key=api_key,
)

# Define LangGraph state
class QueryState(BaseModel):
    question: str
    response: Optional[str] = None

# Step 1: Embedding creation
def create_and_store_embedding(state: QueryState):
    global current_faq_path
    if not os.path.exists(current_faq_path):
        logger.error(f"FAQ file not found at {current_faq_path}")
        return state

    try:
        with open(current_faq_path, "r", encoding="utf-8") as f:
            raw_text = f.read()

        chunks = raw_text.split("\n\n")
        texts = [chunk.strip() for chunk in chunks if chunk.strip()]
        metadatas = [{"source": f"chunk_{i}"} for i in range(len(texts))]

        embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        vector_store = FAISS.from_texts(texts, embedding_model, metadatas=metadatas)

        with open("local_embeddings.pkl", "wb") as f:
            pickle.dump(vector_store, f)

        logger.info("Embeddings created and stored successfully!")
    except Exception as e:
        logger.error(f"Error creating embeddings: {str(e)}")

    return state

# Step 2: Retrieve context
def retrieve_context(state: QueryState):
    try:
        with open("local_embeddings.pkl", "rb") as f:
            vector_store = pickle.load(f)

        embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        query_embedding = embedding_model.embed_query(state.question)
        results = vector_store.similarity_search_by_vector(query_embedding, k=3)

        context = "\n".join([res.page_content for res in results])
        logger.info(f"Retrieved context for query: {state.question}")
    except Exception as e:
        logger.error(f"Error retrieving context: {str(e)}")
        context = ""

    return QueryState(question=state.question, response=context)

# Step 3: Generate response
def generate_response(state: QueryState):
    try:
        prompt = (
            f"You are a helpful assistant. "
            f"Here is a user question: \"{state.question}\".\n\n"
            f"Relevant context from the uploaded document:\n{state.response}\n\n"
            f"Please provide a clear and helpful answer based on this context."
        )
        final_response = llm.invoke(prompt).content.strip()
        logger.info("Generated response successfully")
    except Exception as e:
        logger.error(f"Error generating response: {str(e)}")
        final_response = "Sorry, something went wrong while generating the response."

    return QueryState(question=state.question, response=final_response)

# Build LangGraph
workflow = StateGraph(QueryState)
workflow.add_node("create_and_store_embedding", create_and_store_embedding)
workflow.add_node("retrieve_context", retrieve_context)
workflow.add_node("generate_response", generate_response)
workflow.add_edge("retrieve_context", "generate_response")
workflow.set_entry_point("retrieve_context")
workflow.set_finish_point("generate_response")

# Routes
@app.route('/test', methods=['GET'])
def test_connection():
    return jsonify({"status": "ok", "message": "Backend is running!"})

@app.route('/upload-faq', methods=['POST'])
def upload_faq():
    global current_faq_path

    if 'file' not in request.files:
        return jsonify({"error": "No file part in request"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    # Save file
    file_save_path = os.path.join(app.config["UPLOAD_FOLDER"], file.filename)
    file.save(file_save_path)
    current_faq_path = file_save_path
    logger.info(f"New FAQ uploaded: {current_faq_path}")

    # Just generate embeddings without running full graph
    create_and_store_embedding(QueryState(question=""))
    return jsonify({"message": "File uploaded and embeddings updated!"}), 200

@app.route('/process', methods=['POST', 'OPTIONS'])
def process_request():
    if request.method == 'OPTIONS':
        return '', 204

    try:
        data = request.get_json()
        if not data or 'description' not in data:
            return jsonify({"error": "Missing description"}), 400

        description = data['description']

        rag_bot = workflow.compile()
        input_question = QueryState(question=description)
        response = rag_bot.invoke(input_question)

        results = [{
            "name": "AI Response",
            "description": response["response"],
            "web_address": "#"
        }]
        return jsonify({"results": results})

    except Exception as e:
        logger.error(f"Error in processing: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500

if __name__ == '__main__':
    logger.info("Starting Flask server...")
    app.run(debug=True, host='0.0.0.0', port=5001)
