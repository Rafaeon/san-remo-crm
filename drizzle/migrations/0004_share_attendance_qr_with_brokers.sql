CREATE OR REPLACE FUNCTION public.current_attendance_qr()
RETURNS TABLE(token text, expires_at timestamptz, server_now timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_now timestamptz; v_start timestamptz; v_token text;
BEGIN
 IF NOT (public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'corretor')) THEN
  RAISE EXCEPTION 'Apenas a equipe autenticada pode exibir o QR Code.' USING ERRCODE = '42501';
 END IF;
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
COMMENT ON FUNCTION public.current_attendance_qr() IS 'QR vigente exibido para gestores e corretores na tela de presença; confirmação continua exclusiva de corretores, validada pelo relógio do banco.';
