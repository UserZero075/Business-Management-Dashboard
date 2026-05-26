import { useQuery } from '@tanstack/react-query';
import { companyApi } from '../api/client';

export function useCompany() {
  const { data } = useQuery({ queryKey: ['company-settings'], queryFn: companyApi.get });

  return {
    companyName: data?.companyName || 'DevFast',
    companyObjective: data?.companyObjective || 'Gestor open-source para operar projetos, infraestrutura, finanças e equipe.',
    companyLogoUrl: data?.companyLogoUrl || '',
  };
}
