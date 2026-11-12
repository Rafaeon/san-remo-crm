CREATE OR REPLACE FUNCTION public.distribute_next_lead()
RETURNS TABLE(lead_id uuid, lead_name text, broker_id uuid, broker_name text, operation_id uuid, distributed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now timestamptz;
  v_lead_id uuid;
  v_lead_name text;
  v_broker_id uuid;
  v_broker_name text;
  v_operation_id uuid;
BEGIN
  IF NOT public.has_role(v_uid, 'gestor') THEN
    RAISE EXCEPTION 'Apenas gestores podem distribuir leads.' USING ERRCODE = '42501';
  END IF;
  -- Mesmo ponto de serialização das RPCs de presença.
  PERFORM pg_advisory_xact_lock(714004);
  v_now := clock_timestamp();
  -- Lead sem responsável mais antigo que nunca foi distribuído (desempate por UUID).
  SELECT l.id, l.name
    INTO v_lead_id, v_lead_name
    FROM public.leads l
   WHERE l.responsible_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.lead_distribution_history h WHERE h.lead_id = l.id)
   ORDER BY l.created_at, l.id
   LIMIT 1
     FOR UPDATE OF l;
  IF v_lead_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum lead disponível para distribuição.' USING ERRCODE = 'P0002';
  END IF;
  -- Primeiro da fila com presença válida e papel de corretor ativo.
  SELECT q.broker_id, p.display_name
    INTO v_broker_id, v_broker_name
    FROM public.broker_queue q
    JOIN public.broker_attendance a ON a.broker_id = q.broker_id
    JOIN public.profiles p ON p.id = q.broker_id
   WHERE a.expires_at > v_now
     AND public.has_role(q.broker_id, 'corretor')
   ORDER BY q.position
   LIMIT 1;
  IF v_broker_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum corretor disponível na fila de presença.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.leads l SET responsible_id = v_broker_id WHERE l.id = v_lead_id;
  -- Fila contínua: o corretor atendido vai para o fim.
  UPDATE public.broker_queue q
     SET position = (SELECT coalesce(max(q2.position), 0) + 1 FROM public.broker_queue q2)
   WHERE q.broker_id = v_broker_id;
  v_operation_id := gen_random_uuid();
  INSERT INTO public.lead_distribution_history(operation_id, lead_id, broker_id, distributed_by, distributed_at)
  VALUES (v_operation_id, v_lead_id, v_broker_id, v_uid, v_now);
  RETURN QUERY SELECT v_lead_id, v_lead_name, v_broker_id, v_broker_name, v_operation_id, v_now;
END;
$$;
REVOKE ALL ON FUNCTION public.distribute_next_lead() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.distribute_next_lead() TO authenticated;