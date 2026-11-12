REVOKE ALL ON public.profiles, public.user_roles, public.leads, public.lead_observations, public.attendance_tokens, public.broker_attendance, public.broker_queue, public.lead_distribution_history FROM anon;
REVOKE ALL ON public.attendance_tokens FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles, public.broker_attendance, public.broker_queue, public.lead_distribution_history FROM authenticated;
REVOKE INSERT, DELETE ON public.profiles FROM authenticated;
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name, avatar_url) ON public.profiles TO authenticated;
REVOKE DELETE ON public.leads FROM authenticated;
REVOKE UPDATE, DELETE ON public.lead_observations FROM authenticated;
COMMENT ON FUNCTION public.has_role(uuid, public.app_role) IS 'Intentional SECURITY DEFINER boolean helper for non-recursive RLS checks. Read only; no role assignment or private profile data.';