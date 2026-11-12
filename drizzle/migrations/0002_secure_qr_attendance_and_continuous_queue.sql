ALTER TABLE public.attendance_tokens ADD COLUMN token_value text;
COMMENT ON COLUMN public.attendance_tokens.token_value IS 'Restricted QR payload, disclosed only by manager-authorized RPC. Never grants account access.';
CREATE OR REPLACE FUNCTION public.current_attendance_qr()
RETURNS TABLE(token text, expires_at timestamptz, server_now timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_now timestamptz; v_start timestamptz; v_token text;
BEGIN
 IF NOT public.has_role(auth.uid(), 'gestor') THEN RAISE EXCEPTION 'Apenas gestores podem exibir o QR Code.' USING ERRCODE = '42501'; END IF;
 PERFORM pg_advisory_xact_lock(714004);
 v_now := clock_timestamp();
 v_start := date_bin(interval '5 minutes', v_now, timestamptz '2026-01-01 00:00:00+00');
 SELECT t.token_value INTO v_token FROM public.attendance_tokens t WHERE t.valid_from = v_start AND t.token_value IS NOT NULL ORDER BY t.created_at DESC LIMIT 1;
 IF v_token IS NULL THEN
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.attendance_tokens(token_hash, token_value, valid_from, expires_at) VALUES (encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), v_token, v_start, v_start + interval '5 minutes');
 END IF;
 RETURN QUERY SELECT v_token, v_start + interval '5 minutes', v_now;
END;
$$;
REVOKE ALL ON FUNCTION public.current_attendance_qr() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_attendance_qr() TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_broker_attendance(p_token text)
RETURNS TABLE(confirmed_at timestamptz, expires_at timestamptz, queue_position bigint, renewed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_now timestamptz; v_uid uuid := auth.uid(); v_old_expiry timestamptz; v_position bigint; v_renewed boolean;
BEGIN
 IF NOT public.has_role(v_uid, 'corretor') THEN RAISE EXCEPTION 'Apenas corretores podem confirmar presença.' USING ERRCODE = '42501'; END IF;
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'QR Code inválido ou expirado.' USING ERRCODE = '22023'; END IF;
 -- Shared lock serializes renewal/re-entry and will also protect the future distribution RPC.
 PERFORM pg_advisory_xact_lock(714004);
 v_now := clock_timestamp();
 IF NOT EXISTS (SELECT 1 FROM public.attendance_tokens t WHERE t.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') AND t.valid_from = date_bin(interval '5 minutes', v_now, timestamptz '2026-01-01 00:00:00+00') AND t.valid_from <= v_now AND t.expires_at > v_now) THEN
  RAISE EXCEPTION 'QR Code inválido ou expirado.' USING ERRCODE = '22023';
 END IF;
 SELECT a.expires_at INTO v_old_expiry FROM public.broker_attendance a WHERE a.broker_id = v_uid;
 SELECT q.position INTO v_position FROM public.broker_queue q WHERE q.broker_id = v_uid;
 v_renewed := coalesce(v_old_expiry > v_now, false) AND v_position IS NOT NULL;
 IF NOT v_renewed THEN
  SELECT coalesce(max(q.position), 0) + 1 INTO v_position FROM public.broker_queue q;
  INSERT INTO public.broker_queue(broker_id, position, joined_at) VALUES (v_uid, v_position, v_now)
  ON CONFLICT (broker_id) DO UPDATE SET position = EXCLUDED.position, joined_at = EXCLUDED.joined_at;
 END IF;
 INSERT INTO public.broker_attendance(broker_id, confirmed_at, expires_at) VALUES (v_uid, v_now, v_now + interval '5 hours')
 ON CONFLICT (broker_id) DO UPDATE SET confirmed_at = EXCLUDED.confirmed_at, expires_at = EXCLUDED.expires_at;
 RETURN QUERY SELECT v_now, v_now + interval '5 hours', v_position, v_renewed;
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_broker_attendance(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_broker_attendance(text) TO authenticated;
COMMENT ON FUNCTION public.confirm_broker_attendance(text) IS 'Stage 4: database-clock token validation and atomic five-hour attendance/continuous queue; identity always from auth.uid().';
COMMENT ON TABLE public.attendance_tokens IS 'Stage 4: global five-minute QR rotation, restricted manager RPC and SHA-256 validation.';
COMMENT ON TABLE public.broker_queue IS 'Stage 4: continuous queue; valid renewals preserve position, expired returns append atomically. Distribution belongs to Stage 5.';