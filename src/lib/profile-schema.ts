import { z } from 'zod';

export const profileSchema = z.object({
  display_name: z.string().trim().min(1, 'Informe seu nome.').max(100, 'Use no máximo 100 caracteres.'),
});