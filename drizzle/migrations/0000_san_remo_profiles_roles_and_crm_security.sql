CREATE TYPE public.app_role AS ENUM ('gestor', 'corretor');
CREATE TYPE public.lead_stage AS ENUM ('novo', 'em_contato', 'visita_agendada', 'proposta', 'ganho', 'perdido');

CREATE TABLE public.profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 100),
 avatar_url text CHECK (avatar_url IS NULL OR (char_length(avatar_url) <= 2048 AND avatar_url ~ '^https://')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (display_name, avatar_url) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
 role public.app_role NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
 AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
CREATE POLICY profiles_read_self ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY profiles_read_gestor ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'gestor'));
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY roles_read_self ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY roles_read_gestor ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'gestor'));

CREATE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE FUNCTION public.create_auth_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 INSERT INTO public.profiles (id, display_name) VALUES (NEW.id, coalesce(nullif(left(btrim(NEW.raw_user_meta_data ->> 'display_name'), 100), ''), 'Novo usuário'));
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.create_auth_profile() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_auth_profile();
INSERT INTO public.profiles (id, display_name, created_at)
 SELECT id, coalesce(nullif(left(btrim(raw_user_meta_data ->> 'display_name'), 100), ''), 'Novo usuário'), created_at FROM auth.users ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.leads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
 phone text NOT NULL CHECK (char_length(btrim(phone)) BETWEEN 8 AND 30),
 email text CHECK (email IS NULL OR (char_length(email) <= 255 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
 source text NOT NULL CHECK (char_length(btrim(source)) BETWEEN 1 AND 100),
 property_interest text NOT NULL CHECK (char_length(btrim(property_interest)) BETWEEN 1 AND 500),
 stage public.lead_stage NOT NULL DEFAULT 'novo',
 responsible_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
 created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY leads_gestor_read ON public.leads FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'gestor'));
CREATE POLICY leads_corretor_read_own ON public.leads FOR SELECT TO authenticated USING (responsible_id = auth.uid() AND public.has_role(auth.uid(), 'corretor'));
CREATE POLICY leads_gestor_insert ON public.leads FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'gestor') AND created_by = auth.uid());
CREATE POLICY leads_gestor_update ON public.leads FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'gestor')) WITH CHECK (public.has_role(auth.uid(), 'gestor'));
CREATE POLICY leads_corretor_update_own ON public.leads FOR UPDATE TO authenticated USING (responsible_id = auth.uid() AND public.has_role(auth.uid(), 'corretor')) WITH CHECK (responsible_id = auth.uid() AND public.has_role(auth.uid(), 'corretor'));
CREATE INDEX leads_responsible_stage_idx ON public.leads(responsible_id, stage);
CREATE INDEX leads_reservoir_oldest_idx ON public.leads(created_at, id) WHERE responsible_id IS NULL;
CREATE FUNCTION public.protect_lead_fields() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
 IF TG_OP = 'UPDATE' THEN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
   RAISE EXCEPTION 'Lead identity and creation fields are immutable' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_role(auth.uid(), 'gestor') AND (to_jsonb(NEW) - 'stage' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'stage' - 'updated_at') THEN
   RAISE EXCEPTION 'Corretores may only update their lead stage' USING ERRCODE = '42501';
  END IF;
 END IF;
 IF NEW.responsible_id IS NOT NULL AND NOT public.has_role(NEW.responsible_id, 'corretor') THEN
  RAISE EXCEPTION 'Responsible user must be a corretor' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER leads_protect_fields BEFORE INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.protect_lead_fields();
CREATE TRIGGER leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.lead_observations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
 author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT DEFAULT auth.uid(),
 content text NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 5000),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.lead_observations TO authenticated;
GRANT ALL ON public.lead_observations TO service_role;
ALTER TABLE public.lead_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY observations_read_accessible_lead ON public.lead_observations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.leads WHERE id = lead_id));
CREATE POLICY observations_insert_accessible_lead ON public.lead_observations FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.leads WHERE id = lead_id));
CREATE INDEX observations_lead_date_idx ON public.lead_observations(lead_id, created_at);

CREATE TABLE public.attendance_tokens (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
 valid_from timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT attendance_token_window CHECK (expires_at = valid_from + interval '5 minutes')
);
GRANT ALL ON public.attendance_tokens TO service_role;
ALTER TABLE public.attendance_tokens ENABLE ROW LEVEL SECURITY;
CREATE INDEX attendance_tokens_expiry_idx ON public.attendance_tokens(expires_at);

CREATE TABLE public.broker_attendance (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 broker_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE RESTRICT,
 confirmed_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT broker_attendance_window CHECK (expires_at = confirmed_at + interval '5 hours')
);
GRANT SELECT ON public.broker_attendance TO authenticated;
GRANT ALL ON public.broker_attendance TO service_role;
ALTER TABLE public.broker_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY attendance_read_gestor ON public.broker_attendance FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'gestor'));
CREATE POLICY attendance_read_own ON public.broker_attendance FOR SELECT TO authenticated USING (broker_id = auth.uid() AND public.has_role(auth.uid(), 'corretor'));
CREATE INDEX broker_attendance_expiry_idx ON public.broker_attendance(expires_at);
CREATE TRIGGER attendance_updated_at BEFORE UPDATE ON public.broker_attendance FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.broker_queue (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 broker_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE RESTRICT,
 position bigint NOT NULL UNIQUE CHECK (position > 0),
 joined_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.broker_queue TO authenticated;
GRANT ALL ON public.broker_queue TO service_role;
ALTER TABLE public.broker_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY queue_read_gestor ON public.broker_queue FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'gestor'));
CREATE POLICY queue_read_own ON public.broker_queue FOR SELECT TO authenticated USING (broker_id = auth.uid() AND public.has_role(auth.uid(), 'corretor'));
CREATE TRIGGER queue_updated_at BEFORE UPDATE ON public.broker_queue FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.lead_distribution_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 operation_id uuid NOT NULL UNIQUE,
 lead_id uuid NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE RESTRICT,
 broker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 distributed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 distributed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lead_distribution_history TO authenticated;
GRANT ALL ON public.lead_distribution_history TO service_role;
ALTER TABLE public.lead_distribution_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY history_read_gestor ON public.lead_distribution_history FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'gestor'));
CREATE INDEX distribution_history_date_idx ON public.lead_distribution_history(distributed_at DESC);
COMMENT ON TABLE public.attendance_tokens IS 'Stage 2 schema only. Token generation and secure validation are implemented in Stage 4.';
COMMENT ON TABLE public.broker_queue IS 'Stage 2 schema only. No client writes; transactional queue operations are implemented in Stages 4 and 5.';
COMMENT ON TABLE public.lead_distribution_history IS 'Stage 2 schema only. Clients cannot mutate audit history; transactional distribution is implemented in Stage 5.';