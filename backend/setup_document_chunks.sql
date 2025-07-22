-- Create document_chunks table for storing embeddings
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    source_id UUID NOT NULL,
    feature_type TEXT NOT NULL, -- 'pdf' or 'csv'
    chunk_text TEXT NOT NULL,
    embedding vector(1536), -- OpenAI text-embedding-3-small produces 1536 dimensions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_document_chunks_user_feature_source 
ON public.document_chunks (user_id, feature_type, source_id);

CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding 
ON public.document_chunks USING ivfflat (embedding vector_cosine_ops);

-- Enable Row Level Security
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- Create RLS policy (users can only access their own chunks)
CREATE POLICY "Users can view their own document chunks" ON public.document_chunks
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own document chunks" ON public.document_chunks
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own document chunks" ON public.document_chunks
    FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own document chunks" ON public.document_chunks
    FOR DELETE USING (auth.uid()::text = user_id);

-- Create the match_documents function for vector similarity search
CREATE OR REPLACE FUNCTION public.match_documents(
    query_embedding vector(1536),
    match_user_id text,
    match_feature_type text,
    match_source_id uuid,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    user_id text,
    source_id uuid,
    feature_type text,
    chunk_text text,
    embedding vector(1536),
    created_at timestamp with time zone,
    similarity float
)
LANGUAGE SQL STABLE
AS $$
    SELECT 
        dc.id,
        dc.user_id,
        dc.source_id,
        dc.feature_type,
        dc.chunk_text,
        dc.embedding,
        dc.created_at,
        1 - (dc.embedding <=> query_embedding) AS similarity
    FROM public.document_chunks dc
    WHERE dc.user_id = match_user_id
        AND dc.feature_type = match_feature_type
        AND dc.source_id = match_source_id
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
$$;
