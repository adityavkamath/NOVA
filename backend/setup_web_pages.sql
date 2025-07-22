-- SQL to create web_pages table for storing scraped web content
CREATE TABLE IF NOT EXISTS public.web_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    meta_description TEXT,
    word_count INTEGER,
    embedding_status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_web_pages_user_id ON public.web_pages (user_id);
CREATE INDEX IF NOT EXISTS idx_web_pages_url ON public.web_pages (url);
CREATE INDEX IF NOT EXISTS idx_web_pages_embedding_status ON public.web_pages (embedding_status);

-- Enable Row Level Security
ALTER TABLE public.web_pages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (users can only access their own web pages)
CREATE POLICY "Users can view their own web pages" ON public.web_pages
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own web pages" ON public.web_pages
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own web pages" ON public.web_pages
    FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own web pages" ON public.web_pages
    FOR DELETE USING (auth.uid()::text = user_id);
