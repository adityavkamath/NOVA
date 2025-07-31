import csv
import io
from backend.supabase_client import supabase
from typing import List, Dict, Any
import supabase
import os

# You may need to adjust this import based on your supabase client setup
from backend.supabase_client import supabase

# Utility: Download CSV file from Supabase storage


# Main function: Extract CSV text chunks for semantic search

def extract_csv_text_chunks(csv_id: str, user_id: str, chunk_size: int = 50) -> List[Dict[str, Any]]:
    """
    Loads CSV file by ID, reads contents, and returns a list of text chunks for embedding/semantic search.
    Each chunk is a dict: {"content": ..., "title": ..., "row_start": ..., "row_end": ...}
    """
    print(f"[extract_csv_text_chunks] Called with csv_id={csv_id}, user_id={user_id}, chunk_size={chunk_size}")
    # Fetch CSV record from Supabase
    response = supabase.table("csv_datasets").select("*").eq("id", csv_id).eq("user_id", user_id).single().execute()
    print(f"[extract_csv_text_chunks] Supabase response: {response}")
    if not response or not response.data:
        print("[extract_csv_text_chunks] CSV record not found.")
        return [{"chunk_text": "", "error": "CSV record not found."}]
    csv_record = response.data
    # Use supabase_path to get the file
    csv_path = csv_record.get("supabase_path")
    print(f"[extract_csv_text_chunks] csv_path: {csv_path}")
    # Generate public URL for the CSV file
    public_url = supabase.storage.from_('csvs').get_public_url(csv_path)
    print(f"[extract_csv_text_chunks] public_url: {public_url}")
    if not public_url or not public_url.get('publicUrl'):
        print(f"[extract_csv_text_chunks] Could not generate public URL for CSV: {csv_path}")
        return [{"chunk_text": "", "error": f"Could not generate public URL for CSV: {csv_path}"}]
    file_url = public_url['publicUrl']
    print(f"[extract_csv_text_chunks] file_url: {file_url}")

    # Download the CSV file using requests
    import requests
    try:
        response = requests.get(file_url)
        print(f"[extract_csv_text_chunks] Download response status: {response.status_code}")
        if response.status_code != 200:
            print(f"[extract_csv_text_chunks] Failed to download CSV file: {file_url}")
            return [{"chunk_text": "", "error": f"Failed to download CSV file: {file_url}"}]
        csv_content = response.content.decode('utf-8')
    except Exception as e:
        print(f"[extract_csv_text_chunks] Exception during download: {e}")
        return [{"chunk_text": "", "error": f"Exception during download: {e}"}]

    reader = csv.reader(io.StringIO(csv_content))
    rows = list(reader)
    print(f"[extract_csv_text_chunks] Number of rows: {len(rows)}")
    if not rows or not isinstance(rows, list):
        print("[extract_csv_text_chunks] No rows found in CSV.")
        return [{"chunk_text": "", "error": "No rows found in CSV."}]
    header = rows[0] if rows else []
    chunks = []
    for i in range(1, len(rows), chunk_size):
        chunk_rows = rows[i:i+chunk_size]
        chunk_text = '\n'.join([', '.join(row) for row in chunk_rows])
        chunk_dict = {
            "chunk_text": chunk_text,
            "content": f"Header: {', '.join(header)}\nRows:\n{chunk_text}",
            "title": f"CSV Data Rows {i} to {i+len(chunk_rows)-1}",
            "row_start": i,
            "row_end": i+len(chunk_rows)-1
        }
        chunks.append(chunk_dict)
    print(f"[extract_csv_text_chunks] Returning {len(chunks)} chunks.")
    # Always return a list of dicts, never a string
    return chunks
