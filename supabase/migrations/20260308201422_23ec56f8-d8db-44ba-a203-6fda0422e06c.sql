
-- Function to check and expire a specific user's subscription
CREATE OR REPLACE FUNCTION public.check_user_subscription(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Expire this user's subscriptions if past expires_at
  UPDATE public.subscriptions
  SET status = 'expired'
  WHERE user_id = p_user_id
    AND status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < now();

  -- Reset profile plan to free if no active subscription remains
  UPDATE public.profiles
  SET plan = 'free'
  WHERE user_id = p_user_id
    AND plan != 'free'
    AND NOT EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = p_user_id
        AND s.status = 'active'
        AND (s.expires_at IS NULL OR s.expires_at > now())
    );
END;
$$;

-- Grant execute to authenticated users (runs as SECURITY DEFINER so safe)
GRANT EXECUTE ON FUNCTION public.check_user_subscription(uuid) TO authenticated;
