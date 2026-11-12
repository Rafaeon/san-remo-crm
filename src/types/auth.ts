export type AppRole = 'gestor' | 'corretor';
export interface UserProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}
// Roles are resolved from a protected database table in Stage 2, never user metadata.
export function canAccessRole(actual: AppRole | null, required: AppRole): boolean {
  return actual === required;
}