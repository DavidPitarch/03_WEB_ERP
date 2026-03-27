import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export interface UserProfile {
  nombre_completo: string;
  nombre:          string;
  apellidos:       string;
  nif:             string;
  email:           string;
  extension:       string;
  username:        string;
  telefono:        string;
  avatar_url:      string | null;
  roles:           string[];
}

// ─── Query ────────────────────────────────────────────────────────────────────

export function useUserProfile() {
  return useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const res = await api.get<UserProfile>('/users/me');
      if (res.error) throw new Error(res.error.message);
      return res.data!;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Mutaciones ───────────────────────────────────────────────────────────────

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Pick<UserProfile, 'nombre' | 'apellidos' | 'nif' | 'extension' | 'telefono'>>) => {
      const res = await api.put<UserProfile>('/users/me', patch);
      if (res.error) throw new Error(res.error.message);
      return res.data!;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['user-profile'] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async ({ oldPassword, newPassword }: { oldPassword: string; newPassword: string }) => {
      // Obtener email del usuario actual
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user?.email) throw new Error('No se pudo obtener el usuario actual');

      // Re-autenticar con la contraseña antigua para confirmarla explícitamente
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email:    user.email,
        password: oldPassword,
      });
      if (signInError) throw new Error('La contraseña actual no es correcta');

      // Actualizar contraseña
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw new Error(updateError.message);
    },
  });
}
