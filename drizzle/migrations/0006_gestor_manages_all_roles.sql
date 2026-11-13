CREATE OR REPLACE FUNCTION public.assign_user_role(p_user_id uuid, p_role public.app_role)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(), 'gestor') THEN
  RAISE EXCEPTION 'Apenas gestores podem configurar usuários.' USING ERRCODE = '42501';
 END IF;
 IF p_user_id = auth.uid() THEN
  RAISE EXCEPTION 'Você não pode alterar o próprio papel.' USING ERRCODE = '22023';
 END IF;
 IF p_role IS NULL THEN
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
 ELSE
  INSERT INTO public.user_roles(user_id, role) VALUES (p_user_id, p_role)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
 END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_user_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid, public.app_role) TO authenticated;
COMMENT ON FUNCTION public.assign_user_role(uuid, public.app_role) IS 'Gestor atribui ou remove os papéis gestor e corretor de outros usuários pela tela Equipe; nunca altera o próprio papel — o último gestor não consegue se rebaixar.';
