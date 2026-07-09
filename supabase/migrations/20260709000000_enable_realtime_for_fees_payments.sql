-- Migration: Enable Postgres Realtime for fees_payments table

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'fees_payments'
    ) THEN
        NULL;
    ELSE
        ALTER PUBLICATION supabase_realtime ADD TABLE public.fees_payments;
    END IF;
END $$;
