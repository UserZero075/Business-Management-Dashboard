import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { authApi, projectApi } from '../api/client';
import { Avatar } from '../utils/userVisuals';
import { ExternalLink } from 'lucide-react';
import { roleLabel } from '../utils/labels';

export default function Team() {
  const queryClient = useQueryClient();
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: authApi.getUsers });
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: authApi.getRoles });
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: projectApi.getAll });

  const roleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: number; roleId: number }) => authApi.updateUserRole(userId, roleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const getUserProjects = (userId: number) => {
    return projects?.filter((p: any) => p.members?.some((m: any) => m.userId === userId)) || [];
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Equipe</h1>
        <p className="text-gray-500">Membros, funções, perfis e projetos relacionados.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {users?.map((user: any) => {
          const userProjects = getUserProjects(user.id);
          const links = [
            ['GitHub', user.githubUrl],
            ['Facebook', user.facebookUrl],
            ['LinkedIn', user.linkedinUrl],
            ['Site', user.websiteUrl],
          ].filter(([, url]) => url);

          return (
            <div key={user.id} className="bg-white rounded-xl shadow-sm border p-6 transition-shadow duration-200 hover:shadow-md">
              <div className="flex items-start gap-4 mb-4">
                <Link to={`/users/${user.id}`} className="shrink-0">
                  <Avatar user={user} size={52} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={`/users/${user.id}`} className="font-semibold text-gray-800 truncate hover:underline block">{user.name}</Link>
                  <p className="text-sm text-gray-500 truncate">{user.email}</p>
                  {user.bio && <p className="text-sm text-gray-600 mt-2 line-clamp-3">{user.bio}</p>}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1">Papel</label>
                <select
                  value={user.roleId || user.role?.id || ''}
                  onChange={(event) => roleMutation.mutate({ userId: user.id, roleId: Number(event.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                >
                  {roles?.map((role: any) => <option key={role.id} value={role.id}>{roleLabel(role.name)}</option>)}
                </select>
              </div>

              {links.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {links.map(([label, url]) => (
                    <a key={label} href={url as string} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200">
                      {label}<ExternalLink size={12} />
                    </a>
                  ))}
                </div>
              )}

              {userProjects.length > 0 ? (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Projetos:</p>
                  <div className="flex flex-wrap gap-1">
                    {userProjects.map((p: any) => (
                      <span key={p.id} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Sem projetos atribuídos</p>
              )}
            </div>
          );
        })}

        {(!users || users.length === 0) && (
          <div className="col-span-full text-center py-12 text-gray-500">
            Não há membros na equipe
          </div>
        )}
      </div>
    </div>
  );
}
