import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { authApi } from '../api/client';
import { Avatar } from '../utils/userVisuals';
import { roleLabel, statusLabel } from '../utils/labels';

export default function UserProfile() {
  const { id } = useParams();
  const userId = Number(id);
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: () => authApi.getUser(userId),
    enabled: Number.isFinite(userId),
  });

  if (isLoading) return <p className="text-gray-500">Carregando perfil...</p>;
  if (error || !user) return <p className="text-red-600">Não foi possível carregar o perfil.</p>;

  const links = [
    ['GitHub', user.githubUrl],
    ['Facebook', user.facebookUrl],
    ['LinkedIn', user.linkedinUrl],
    ['Site', user.websiteUrl],
  ].filter(([, url]) => url);

  return (
    <div className="space-y-6 max-w-5xl animate-fade-in">
      <Link to="/team" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline">
        <ArrowLeft size={16} /> Voltar para a equipe
      </Link>

      <section className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <Avatar user={user} size={88} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-800">{user.name}</h1>
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{roleLabel(user.role?.name)}</span>
            </div>
            <p className="text-gray-500 mt-1">{user.email}</p>
            {user.bio && <p className="text-gray-700 mt-4 whitespace-pre-wrap">{user.bio}</p>}

            {links.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {links.map(([label, url]) => (
                  <a key={label} href={url as string} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
                    {label}<ExternalLink size={14} />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Projetos relacionados</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {user.projects?.map((project: any) => (
            <Link key={project.id} to={`/projects/${project.id}/manager`} className="border rounded-lg p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-gray-800">{project.name}</span>
                <span className="text-xs text-gray-500">{statusLabel(project.status)}</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">{project.isResponsible ? 'Responsável' : roleLabel(project.memberRole)}</p>
            </Link>
          ))}

          {(!user.projects || user.projects.length === 0) && <p className="text-gray-500">Sem projetos atribuídos.</p>}
        </div>
      </section>
    </div>
  );
}
