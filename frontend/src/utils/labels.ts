const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativo',
  PAUSED: 'Pausado',
  ABANDONED: 'Abandonado',
  EXPERIMENTAL: 'Experimental',
  RENTABLE: 'Rentável',
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em progresso',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
  OPEN: 'Aberto',
  RESOLVED: 'Resolvido',
  CLOSED: 'Fechado',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

const INFRA_TYPE_LABELS: Record<string, string> = {
  VPS: 'VPS',
  DOMAIN: 'Domínio',
  DATABASE: 'Banco de dados',
  SSL_CERT: 'Certificado SSL',
  CDN: 'CDN',
  EMAIL: 'E-mail',
  EMAIL_SERVICE: 'E-mail',
  API_SERVICE: 'API',
  PAYMENT: 'Pagamentos',
  OTHER: 'Outro',
};

const BILLING_CYCLE_LABELS: Record<string, string> = {
  monthly: 'mês',
  yearly: 'ano',
  annual: 'ano',
  weekly: 'semana',
  daily: 'dia',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  founder: 'Fundador',
  fundador: 'Fundador',
  cofounder: 'Cofundador',
  cofundador: 'Cofundador',
  marketing: 'Marketing',
  sales: 'Vendas',
  operations: 'Operações',
  developer: 'Desenvolvedor',
  designer: 'Designer',
  finance: 'Financeiro',
  support: 'Suporte',
  member: 'Membro',
  responsible: 'Responsável',
};

function formatFallback(value?: string | null) {
  return value || '';
}

export function statusLabel(value?: string | null) {
  return value ? STATUS_LABELS[value] || value : '';
}

export function priorityLabel(value?: string | null) {
  return value ? PRIORITY_LABELS[value] || value : '';
}

export function severityLabel(value?: string | null) {
  return priorityLabel(value);
}

export function infraTypeLabel(value?: string | null) {
  return value ? INFRA_TYPE_LABELS[value] || value : '';
}

export function billingCycleLabel(value?: string | null) {
  return value ? BILLING_CYCLE_LABELS[value] || value : '';
}

export function roleLabel(value?: string | null) {
  return value ? ROLE_LABELS[value.toLowerCase()] || formatFallback(value) : '';
}
