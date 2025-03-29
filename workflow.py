from langgraph.graph import StateGraph
from langchain_together import ChatTogether
import os
from dotenv import load_dotenv
from pydantic import BaseModel
import pickle
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from typing import Optional


# Load environment variables
load_dotenv()
api_key = os.getenv("TOGETHER_API_KEY")

if not api_key:
    raise ValueError("TOGETHER_API_KEY is missing. Please check your .env file.")

# Initialize LLM
llm = ChatTogether(
    model="mistralai/Mistral-7B-Instruct-v0.2",
    together_api_key=api_key,
)

# Define the state schema (no category)
class QueryState(BaseModel):
    question: str
    response: Optional[str] = None

# Step 1: Create and store embeddings from a .txt file
def create_and_store_embedding(state: QueryState):
    file_path = "faq.txt"

    if not os.path.exists(file_path):
        print("Text file not found.")
        return state

    with open(file_path, "r", encoding="utf-8") as f:
        raw_text = f.read()

    # Basic paragraph-based chunking
    chunks = raw_text.split("\n\n")
    texts = [chunk.strip() for chunk in chunks if chunk.strip()]
    metadatas = [{"source": f"chunk_{i}"} for i in range(len(texts))]

    embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    vector_store = FAISS.from_texts(texts, embedding_model, metadatas=metadatas)

    with open("local_embeddings.pkl", "wb") as f:
        pickle.dump(vector_store, f)

    print("Embeddings created and stored locally!")
    return state

# Step 2: Retrieve context from stored embeddings
def retrieve_context(state: QueryState):
    with open("local_embeddings.pkl", "rb") as f:
        vector_store = pickle.load(f)

    embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    query_embedding = embedding_model.embed_query(state.question)
    results = vector_store.similarity_search_by_vector(query_embedding, k=3)

    context = "\n".join([res.page_content for res in results])
    print(f"Retrieved Context:\n{context}")

    return QueryState(question=state.question, response=context)

# Step 3: Generate LLM response
def generate_response(state: QueryState):
    prompt = (
        f"You are a helpful assistant. "
        f"Here is a user question: \"{state.question}\".\n\n"
        f"Relevant context from the uploaded document:\n{state.response}\n\n"
        f"Please provide a clear and helpful answer based on this context."
    )

    final_response = llm.invoke(prompt).content.strip()
    return QueryState(question=state.question, response=final_response)

# Build the LangGraph
workflow = StateGraph(QueryState)
workflow.add_node("create_and_store_embedding", create_and_store_embedding)
workflow.add_node("retrieve_context", retrieve_context)
workflow.add_node("generate_response", generate_response)

workflow.add_edge("create_and_store_embedding", "retrieve_context")
workflow.add_edge("retrieve_context", "generate_response")

workflow.set_entry_point("create_and_store_embedding")
workflow.set_finish_point("generate_response")

rag_bot = workflow.compile()

# Example usage
if __name__ == "__main__":
    input_question = QueryState(question="What are HooHacks logistics?")
    response = rag_bot.invoke(input_question)
    print("\nFinal Answer:\n", response["response"])
