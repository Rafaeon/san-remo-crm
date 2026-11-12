export type AppRole = 'gestor' | 'corretor';
export interface UserProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}
// Only protected database records determine roles; never user metadata.
export function canAccessRole(actual: AppRole | null, required: AppRole): boolean {
  return actual === required;
}