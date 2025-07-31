import chromadb
from chromadb.utils import embedding_functions 
import os
from backend.config import CHROMA_DIR

try:
    embedding_func = embedding_functions.OpenAIEmbeddingFunction(
        api_key=os.getenv("OPENAI_API_KEY")
    )
    client = chromadb.PersistentClient(path=CHROMA_DIR)
    print(f"✅ ChromaDB client initialized at: {CHROMA_DIR}")
except Exception as e:
    print(f"❌ Error initializing ChromaDB: {e}")
    client = None
    embedding_func = None

collections = {}
collection_names = {
    "reddit": "reddit_python",
    "stackoverflow": "stackoverflow_python", 
    "devto": "devto",
    "github": "github_discussions",
    "hackernews": "haysckernews",
}

for key, collection_name in collection_names.items():
    try:
        if client and embedding_func:
            try:
                collections[key] = client.get_collection(
                    name=collection_name,
                    embedding_function=embedding_func
                )
                print(f"✅ Successfully loaded existing collection: {collection_name}")
            except Exception:
                collections[key] = client.create_collection(
                    name=collection_name,
                    embedding_function=embedding_func
                )
                print(f"✅ Successfully created new collection: {collection_name}")
        else:
            print(f"⚠️ Cannot load collection {collection_name}: Client not initialized")
            collections[key] = None
    except Exception as e:
        print(f"⚠️ Warning: Could not load collection {collection_name}: {e}")
        collections[key] = None

async def semantic_search(query: str, user_id: str, feature_type: str, source_id: str, top_k: int = 5):
    """
    Perform semantic search on embeddings stored in Supabase
    """
    try:
        print(f"DEBUG: semantic_search called with - user_id: {user_id}, feature_type: {feature_type}, source_id: {source_id}")
        # Only patch CSV feature_type for similarity_search_with_score
        if feature_type == "csv":
            try:
                from langchain_community.vectorstores import Chroma
                from langchain_openai import OpenAIEmbeddings
                from backend.config import CHROMA_DIR
                import os
                embeddings_model = OpenAIEmbeddings(model="text-embedding-3-small")
                db = Chroma(persist_directory=CHROMA_DIR, embedding_function=embeddings_model)
                query_embedding = embeddings_model.embed_query(query)
                # Filter by source_id and user_id in metadatas
                results = db.similarity_search_with_score(
                    query,
                    k=top_k,
                    filter={"source_id": source_id, "user_id": user_id, "feature_type": "csv"}
                )
                formatted = []
                for doc, score in results:
                    meta = doc.metadata if hasattr(doc, "metadata") else {}
                    formatted.append({
                        "chunk_text": doc.page_content if hasattr(doc, "page_content") else str(doc),
                        "score": score,
                        "title": meta.get("title", "CSV Chunk"),
                        "row_start": meta.get("row_start"),
                        "row_end": meta.get("row_end"),
                        "source_id": meta.get("source_id"),
                        "user_id": meta.get("user_id"),
                        "feature_type": meta.get("feature_type"),
                    })
                print(f"[semantic_search] Returning {len(formatted)} CSV chunks with scores.")
                return formatted
            except Exception as chroma_e:
                print(f"❌ ChromaDB CSV semantic search error: {chroma_e}")
                # Fallback to Supabase
                try:
                    from backend.supabase_client import supabase
                    response = supabase.table("document_chunks").select("*").eq("user_id", user_id).eq("feature_type", feature_type).eq("source_id", source_id).limit(top_k).execute()
                    return response.data if response.data else []
                except Exception as fallback_error:
                    print(f"❌ Fallback search also failed: {fallback_error}")
                    return []
        else:
            # Default: Supabase RPC for other feature_types
            from backend.supabase_client import supabase
            from langchain_openai import OpenAIEmbeddings
            embeddings_model = OpenAIEmbeddings(model="text-embedding-3-small")
            query_embedding = embeddings_model.embed_query(query)
            response = supabase.rpc(
                'match_documents',
                {
                    'query_embedding': query_embedding,
                    'match_user_id': user_id,
                    'match_feature_type': feature_type,
                    'match_source_id': source_id,
                    'match_count': top_k
                }
            ).execute()
            return response.data if response.data else []
    except Exception as e:
        print(f"❌ Semantic search error: {e}")
        return []

def search_similar_docs(query: str, source: str = "all", top_k: int = 5):
    """Search for similar documents across collections"""
    try:
        if not client or not embedding_func:
            print("❌ ChromaDB client not initialized")
            return []
            
        if source == "all":
            selected_sources = collections.keys()
        else:
            selected_sources = [source] if source in collections else []

        results = []
        for src in selected_sources:
            if src not in collections or collections[src] is None:
                print(f"⚠️ Collection {src} not available")
                continue
                
            try:
                collection = collections[src]
                res = collection.query(query_texts=[query], n_results=top_k)

                if not res or not isinstance(res, dict):
                    print(f"⚠️ Invalid result structure from {src}")
                    continue
                    
                documents = res.get("documents")
                metadatas = res.get("metadatas")
                distances = res.get("distances")

                if documents is None or not isinstance(documents, list):
                    print(f"⚠️ No valid documents from {src} - documents is {type(documents)}")
                    continue
                    
                if metadatas is None:
                    metadatas = []
                elif not isinstance(metadatas, list):
                    print(f"⚠️ Invalid metadatas type from {src}: {type(metadatas)}")
                    metadatas = []
                    
                if distances is None:
                    distances = []
                elif not isinstance(distances, list):
                    print(f"⚠️ Invalid distances type from {src}: {type(distances)}")
                    distances = []

                try:
                    if len(documents) > 0 and isinstance(documents[0], list):
                        doc_list = documents[0]
                        meta_list = metadatas[0] if len(metadatas) > 0 and isinstance(metadatas[0], list) else []
                        dist_list = distances[0] if len(distances) > 0 and isinstance(distances[0], list) else []
                    else:

                        doc_list = documents
                        meta_list = metadatas if isinstance(metadatas, list) else []
                        dist_list = distances if isinstance(distances, list) else []

                    if not isinstance(doc_list, list):
                        print(f"⚠️ doc_list is not a list from {src}: {type(doc_list)}")
                        continue

                    for i in range(len(doc_list)):
                        metadata = {}
                        if i < len(meta_list) and meta_list[i] and isinstance(meta_list[i], dict):
                            metadata = meta_list[i]

                        distance = 0.0
                        if i < len(dist_list) and dist_list[i] is not None:
                            try:
                                distance = float(dist_list[i])
                            except (ValueError, TypeError):
                                distance = 0.0

                        url = metadata.get("url", "")
                        if not url or url == "N/A" or not url.startswith(("http://", "https://")):
                            url = None 
                        
                        results.append({
                            "text": str(doc_list[i]),
                            "url": url,
                            "score": distance,
                            "source": src,
                            "title": metadata.get("title", "No title"),
                        })
                        
                except Exception as inner_e:
                    print(f"❌ Error processing documents from {src}: {inner_e}")
                    import traceback
                    traceback.print_exc()
                    continue
                    
            except Exception as e:
                print(f"❌ Error querying collection {src}: {e}")
                import traceback
                traceback.print_exc()
                continue

        return sorted(results, key=lambda d: d["score"])[:top_k]
        
    except Exception as outer_e:
        print(f"❌ Outer error in search_similar_docs: {outer_e}")
        import traceback
        traceback.print_exc()
        return []

def get_all_documents(source: str = "reddit"):
    """Get all documents from a specific source or all sources"""
    if not client:
        print("❌ ChromaDB client not initialized")
        return []
        
    docs = []

    if source == "all":
        sources = collections.keys()
    else:
        sources = [source] if source in collections else []

    for src in sources:
        collection = collections.get(src)
        if not collection:
            print(f"⚠️ Collection {src} not available or not loaded")
            continue

        try:
            results = collection.get(include=["documents", "embeddings", "metadatas"]) 

            for i in range(len(results["documents"])):
                metadata = results["metadatas"][i] if results["metadatas"] else {}
                docs.append({
                    "id": results["ids"][i],
                    "text": results["documents"][i],
                    "embedding": results["embeddings"][i] if results["embeddings"] else None,
                    "url": metadata.get("url", "N/A"),
                    "score": metadata.get("score", 0),
                    "source": metadata.get("source", src),
                    "title": metadata.get("title", "No title"),
                })
        except Exception as e:
            print(f"❌ Error getting documents from collection {src}: {e}")
            continue

    return docs

def get_available_sources():
    """Get list of available sources"""
    available = []
    for key, collection in collections.items():
        if collection is not None:
            available.append(key)
    return available

def reset_collections():
    """Reset and recreate all collections"""
    global collections, client, embedding_func
    
    if not client or not embedding_func:
        print("❌ Cannot reset collections: Client not initialized")
        return False
    
    print("🔄 Resetting all collections...")

    for key, collection_name in collection_names.items():
        try:
            client.delete_collection(name=collection_name)
            print(f"🗑️ Deleted collection: {collection_name}")
        except Exception as e:
            print(f"ℹ️ Collection {collection_name} doesn't exist or couldn't be deleted: {e}")

    collections = {}
    for key, collection_name in collection_names.items():
        try:
            collections[key] = client.create_collection(
                name=collection_name,
                embedding_function=embedding_func
            )
            print(f"✅ Created new collection: {collection_name}")
        except Exception as e:
            print(f"❌ Failed to create collection {collection_name}: {e}")
            collections[key] = None
    
    return True

def check_collections_status():
    """Check which collections are available and working"""
    status = {}
    for key, collection_name in collection_names.items():
        try:
            if key in collections and collections[key] is not None:
                collection = collections[key]
                result = collection.count()
                status[key] = {"status": "available", "count": result, "collection_name": collection_name}
            else:
                status[key] = {"status": "not_loaded", "count": 0, "collection_name": collection_name}
        except Exception as e:
            status[key] = {"status": "error", "error": str(e), "collection_name": collection_name}
    
    return status
