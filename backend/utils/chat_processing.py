from supabase_client import supabase
from typing import AsyncGenerator
import json
import asyncio
from langchain_openai import ChatOpenAI
from langchain.memory import ConversationBufferMemory
from langchain.schema import HumanMessage, AIMessage
from langchain.callbacks.base import BaseCallbackHandler
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.chains import ConversationalRetrievalChain
from langchain.prompts import PromptTemplate
from langchain.chains.question_answering import load_qa_chain
import queue
import threading


class StreamingCallbackHandler(BaseCallbackHandler):
    def __init__(self):
        self.tokens = []
        self.token_queue = queue.Queue()
        self.done = False
        
    def on_llm_new_token(self, token: str, **kwargs) -> None:
        self.tokens.append(token)
        self.token_queue.put(token)
    
    def on_llm_end(self, *args, **kwargs) -> None:
        self.done = True
        self.token_queue.put(None)  # Sentinel value to indicate completion

# Global memory store (in production, use Redis or similar)
memory_store = {}

def get_or_create_memory(session_id: str) -> ConversationBufferMemory:
    if session_id not in memory_store:
        memory_store[session_id] = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True,
            output_key="answer"  # Specify which key to store in memory
        )
    return memory_store[session_id]

async def get_pdf_content(pdf_url: str):
    """Extract text content from PDF URL and create vector store"""
    try:
        # Download and load PDF
        loader = PyPDFLoader(pdf_url)
        documents = loader.load()
        
        # Split documents into chunks
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200
        )
        texts = text_splitter.split_documents(documents)
        
        # Create embeddings and vector store
        embeddings = OpenAIEmbeddings()
        vectorstore = FAISS.from_documents(texts, embeddings)
        
        return vectorstore
    except Exception as e:
        print(f"Error processing PDF: {str(e)}")
        return None

async def generate_response_stream(
    question: str, 
    session_id: str, 
    pdf_id: str = None,
    current_user: dict = None,
    csv_id: str = None,
    web_id: str = None
) -> AsyncGenerator[str, None]:
    try:
        vectorstore = None
        context_text = ""
        
        # Handle PDF
        if pdf_id:
            # Get PDF URL from database
            pdf_response = supabase.table("pdf_files").select("public_url").eq("id", pdf_id).eq("user_id", current_user["id"]).execute()
            
            if not pdf_response.data:
                yield f"data: {json.dumps({'content': 'PDF not found or access denied.'})}\n\n"
                yield "data: [DONE]\n\n"
                return
                
            pdf_url = pdf_response.data[0]["public_url"]
            
            # Get or create vector store for the PDF
            vectorstore = await get_pdf_content(pdf_url)
            
            if not vectorstore:
                yield f"data: {json.dumps({'content': 'Unable to process PDF content.'})}\n\n"
                yield "data: [DONE]\n\n"
                return
        
        # Handle CSV
        elif csv_id:
            # Get relevant context from CSV embeddings using semantic search
            from utils.semantic_search import semantic_search
            
            search_results = await semantic_search(
                query=question,
                user_id=current_user["id"],
                feature_type="csv",
                source_id=csv_id,
                top_k=5
            )
            
            if search_results:
                context_text = "\n".join([result["chunk_text"] for result in search_results])
            else:
                yield f"data: {json.dumps({'content': 'No relevant CSV data found for your question.'})}\n\n"
                yield "data: [DONE]\n\n"
                return
        
        # Handle Web
        elif web_id:
            # Get relevant context from web embeddings using semantic search
            from utils.semantic_search import semantic_search
            
            search_results = await semantic_search(
                query=question,
                user_id=current_user["id"],
                feature_type="web",
                source_id=web_id,
                top_k=5
            )
            
            if search_results:
                context_text = "\n".join([result["chunk_text"] for result in search_results])
            else:
                yield f"data: {json.dumps({'content': 'No relevant web content found for your question.'})}\n\n"
                yield "data: [DONE]\n\n"
                return
        
        else:
            yield f"data: {json.dumps({'content': 'No data source provided.'})}\n\n"
            yield "data: [DONE]\n\n"
            return
        
        # Get conversation memory
        memory = get_or_create_memory(session_id)
        
        # Build context and sources based on data type
        if vectorstore:  # PDF approach
            # Get relevant documents
            retriever = vectorstore.as_retriever(search_kwargs={"k": 5})
            docs = await asyncio.get_event_loop().run_in_executor(
                None, 
                retriever.get_relevant_documents, 
                question
            )
            
            # Build context from retrieved documents (top 3 for context)
            context = "\n\n".join([doc.page_content for doc in docs[:3]])
            
            # Extract sources information for display (all 5)
            sources = []
            for i, doc in enumerate(docs):
                source_info = {
                    "title": f"Page {doc.metadata.get('page', i+1)}",
                    "content_preview": doc.page_content[:150] + "..." if len(doc.page_content) > 150 else doc.page_content,
                    "page": doc.metadata.get('page', i+1),
                    "relevance_score": round(0.95 - i*0.05, 2)
                }
                sources.append(source_info)
        
        else:  # CSV or Web approach
            context = context_text
            # For CSV and Web, we'll use simpler source information
            if csv_id:
                sources = [{
                    "title": "CSV Data",
                    "content_preview": context[:150] + "..." if len(context) > 150 else context,
                    "page": 1,
                    "relevance_score": 0.95
                }]
            elif web_id:
                # Get web page title from database
                web_response = supabase.table("web_pages").select("title, url").eq("id", web_id).eq("user_id", current_user["id"]).execute()
                web_title = web_response.data[0]["title"] if web_response.data else "Web Content"
                web_url = web_response.data[0]["url"] if web_response.data else ""
                
                sources = [{
                    "title": web_title,
                    "content_preview": context[:150] + "..." if len(context) > 150 else context,
                    "page": 1,
                    "relevance_score": 0.95,
                    "url": web_url
                }]
        
        # Get chat history
        chat_history = memory.chat_memory.messages
        history_text = ""
        for msg in chat_history[-6:]:  # Last 3 exchanges
            if isinstance(msg, HumanMessage):
                history_text += f"Human: {msg.content}\n"
            elif isinstance(msg, AIMessage):
                history_text += f"Assistant: {msg.content}\n"
        # Create appropriate prompt based on data type
        if csv_id:
            prompt_template = """You are an expert AI assistant specializing in data analysis and CSV interpretation. Your role is to provide comprehensive, accurate, and contextually relevant answers based on CSV data and conversation history.
                ## Instructions:
                1. **Analyze thoroughly**: Carefully examine the provided CSV data and identify all relevant information
                2. **Be comprehensive**: Provide detailed explanations, include supporting data points, and elaborate on patterns
                3. **Reference data**: When possible, mention specific columns, values, or statistics from the CSV
                4. **Maintain context**: Consider the conversation history to provide cohesive, progressive responses
                5. **Be precise**: Use exact column names and values from the dataset when applicable
                6. **Structure clearly**: Organize your response with clear paragraphs, bullet points, or tables when appropriate

                ## Previous Conversation:
                {chat_history}

                ## CSV Data Context:
                {context}

                ## Current Question: 
                {question}

                ## Response Guidelines:
                - If the information is clearly available in the data, provide a detailed answer with specific references
                - If the information is partially available, provide what you can and clearly state what aspects need additional data
                - If the information is not available in the context, explicitly state: "Based on the provided CSV data, I cannot find specific information about [topic]. The dataset contains [brief summary of what the data actually covers]."
                - Use specific data points, statistics, or patterns from the CSV when relevant
                - For data analysis, provide insights, trends, or summaries as appropriate

            ## Detailed Answer:"""
        elif web_id:
            prompt_template = """You are an expert AI assistant specializing in web content analysis and comprehension. Your role is to provide comprehensive, accurate, and contextually relevant answers based on web page content and conversation history.
                ## Instructions:
                1. **Analyze thoroughly**: Carefully examine the provided web content and identify all relevant information
                2. **Be comprehensive**: Provide detailed explanations, include supporting details, and elaborate on key points
                3. **Reference content**: When possible, mention specific sections, facts, or concepts from the web page
                4. **Maintain context**: Consider the conversation history to provide cohesive, progressive responses
                5. **Be precise**: Use exact terminology and information from the web content when applicable
                6. **Structure clearly**: Organize your response with clear paragraphs, bullet points, or numbered lists when appropriate

                ## Previous Conversation:
                {chat_history}

                ## Web Content Context:
                {context}

                ## Current Question: 
                {question}

                ## Response Guidelines:
                - If the information is clearly available in the content, provide a detailed answer with specific references
                - If the information is partially available, provide what you can and clearly state what aspects need additional information
                - If the information is not available in the context, explicitly state: "Based on the provided web content, I cannot find specific information about [topic]. The content focuses on [brief summary of what the content actually covers]."
                - Use examples, quotes, or specific information from the web page when relevant
                - For complex topics, break down your explanation into logical steps or sections

            ## Detailed Answer:"""
        else:
            prompt_template = """You are an expert AI assistant specializing in document analysis and comprehension. Your role is to provide comprehensive, accurate, and contextually relevant answers based on PDF content and conversation history.
                ## Instructions:
                1. **Analyze thoroughly**: Carefully examine the provided context and identify all relevant information
                2. **Be comprehensive**: Provide detailed explanations, include supporting details, and elaborate on key points
                3. **Reference sources**: When possible, mention specific sections, data points, or concepts from the document
                4. **Maintain context**: Consider the conversation history to provide cohesive, progressive responses
                5. **Be precise**: Use exact terminology and concepts from the document when applicable
                6. **Structure clearly**: Organize your response with clear paragraphs, bullet points, or numbered lists when appropriate

                ## Previous Conversation:
                {chat_history}

                ## Document Context:
                {context}

                ## Current Question: 
                {question}

                ## Response Guidelines:
                - If the information is clearly available in the context, provide a detailed answer with specific references
                - If the information is partially available, provide what you can and clearly state what aspects need additional information
                - If the information is not available in the context, explicitly state: "Based on the provided document, I cannot find specific information about [topic]. The document focuses on [brief summary of what the document actually covers]."
                - Use examples, quotes, or specific data from the document when relevant
                - For complex topics, break down your explanation into logical steps or sections

            ## Detailed Answer:"""

        # Setup LLM with streaming callback
        callback_handler = StreamingCallbackHandler()
        llm = ChatOpenAI(
            model="gpt-3.5-turbo",
            temperature=0.3,
            streaming=True,
            callbacks=[callback_handler]
        )
        
        # Format the prompt
        formatted_prompt = prompt_template.format(
            chat_history=history_text,
            context=context,
            question=question
        )
        
        # Start LLM generation in a separate thread
        def run_llm():
            try:
                response = llm.invoke(formatted_prompt)
                return response.content
            except Exception as e:
                callback_handler.token_queue.put(f"Error: {str(e)}")
                callback_handler.done = True
                return str(e)
        
        # Start the LLM generation
        llm_thread = threading.Thread(target=run_llm)
        llm_thread.start()
        
        # First, send the sources
        yield f"data: {json.dumps({'sources': sources})}\n\n"
        
        # Stream tokens as they come
        full_response = ""
        while True:
            try:
                # Get token from queue with timeout
                token = callback_handler.token_queue.get(timeout=1)
                
                if token is None:  # Sentinel value indicating completion
                    break
                    
                full_response += token
                yield f"data: {json.dumps({'content': token})}\n\n"
                
            except queue.Empty:
                if callback_handler.done:
                    break
                continue
        
        # Wait for thread to complete
        llm_thread.join(timeout=30)
        
        # Update memory with the conversation
        memory.chat_memory.add_user_message(question)
        memory.chat_memory.add_ai_message(full_response)
        
        # Save conversation to database
        try:
            # Save user message
            supabase.table("chat_messages").insert({
                "session_id": session_id,
                "role": "user",
                "message": question,
                "sources": None
            }).execute()
            
            # Save AI message with sources
            supabase.table("chat_messages").insert({
                "session_id": session_id,
                "role": "ai-agent",
                "message": full_response,
                "sources": json.dumps(sources)
            }).execute()
        except Exception as e:
            print(f"Error saving messages to database: {e}")
        
    except Exception as e:
        error_msg = f"Error generating response: {str(e)}"
        print(error_msg)
        yield f"data: {json.dumps({'content': error_msg})}\n\n"
    
    yield "data: [DONE]\n\n"


# Alternative approach using the newer LangChain LCEL (LangChain Expression Language)
async def generate_response_stream_lcel(
    question: str, 
    session_id: str, 
    pdf_id: str,
    current_user: dict
) -> AsyncGenerator[str, None]:
    """Alternative implementation using newer LangChain patterns"""
    try:
        from langchain.schema.runnable import RunnablePassthrough
        from langchain.schema.output_parser import StrOutputParser
        
        # Get PDF URL from database
        pdf_response = supabase.table("pdf_files").select("public_url").eq("id", pdf_id).eq("user_id", current_user["id"]).execute()
        
        if not pdf_response.data:
            yield f"data: {json.dumps({'content': 'PDF not found or access denied.'})}\n\n"
            yield "data: [DONE]\n\n"
            return
            
        pdf_url = pdf_response.data[0]["public_url"]
        vectorstore = await get_pdf_content(pdf_url)
        
        if not vectorstore:
            yield f"data: {json.dumps({'content': 'Unable to process PDF content.'})}\n\n"
            yield "data: [DONE]\n\n"
            return
        
        # Setup streaming callback
        callback_handler = StreamingCallbackHandler()
        llm = ChatOpenAI(
            model="gpt-3.5-turbo",
            temperature=0.7,
            streaming=True,
            callbacks=[callback_handler]
        )
        
        # Get memory
        memory = get_or_create_memory(session_id)
        
        # Create RAG chain using LCEL
        retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
        
        prompt = PromptTemplate.from_template("""
Answer the question based on the context and chat history:

Context: {context}
Chat History: {chat_history}
Question: {question}

Answer:""")
        
        def format_docs(docs):
            return "\n\n".join(doc.page_content for doc in docs)
        
        def get_chat_history():
            messages = memory.chat_memory.messages
            history = ""
            for msg in messages[-6:]:  # Last 3 exchanges
                if isinstance(msg, HumanMessage):
                    history += f"Human: {msg.content}\n"
                elif isinstance(msg, AIMessage):
                    history += f"Assistant: {msg.content}\n"
            return history
        
        # Build the chain
        rag_chain = (
            {
                "context": retriever | format_docs,
                "question": RunnablePassthrough(),
                "chat_history": lambda x: get_chat_history()
            }
            | prompt
            | llm
            | StrOutputParser()
        )
        
        # Stream the response
        full_response = ""
        async for chunk in rag_chain.astream(question):
            full_response += chunk
            yield f"data: {json.dumps({'content': chunk})}\n\n"
        
        # Update memory
        memory.chat_memory.add_user_message(question)
        memory.chat_memory.add_ai_message(full_response)
        
    except Exception as e:
        error_msg = f"Error generating response: {str(e)}"
        print(error_msg)
        yield f"data: {json.dumps({'content': error_msg})}\n\n"
    
    yield "data: [DONE]\n\n"