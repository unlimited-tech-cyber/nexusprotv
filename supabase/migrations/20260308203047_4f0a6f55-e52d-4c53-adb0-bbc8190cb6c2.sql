-- Add device_id column to profiles to lock account to one device
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS device_id TEXT DEFAULT NULL;

-- Function to reset device for a user (admin use)
CREATE OR REPLACE FUNCTION public.reset_device_id(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET device_id = NULL WHERE user_id = p_user_id;
END;
$$;