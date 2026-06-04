const API_URL = import.meta.env.VITE_API_URL ?? '';
export const WS_URL = API_URL ? API_URL.replace(/^http/, 'ws') : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

export type ProjectStatus = 'ACTIVE' | 'PAUSED' | 'ABANDONED' | 'EXPERIMENTAL' | 'RENTABLE';

export type Client = {
  id: number;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  document?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  projects?: Project[];
  totalIncome?: number;
  totalExpense?: number;
  netRevenue?: number;
};

export type Project = {
  id: number;
  name: string;
  description?: string | null;
  status: ProjectStatus | string;
  publicUrl?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  contractValue?: number | null;
  clientId?: number | null;
  client_id?: number | null;
  client?: Client | null;
  members?: any[];
  vpsLinks?: any[];
  infraLinks?: any[];
  transactions?: any[];
  tasks?: any[];
  bugs?: any[];
  metrics?: any[];
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectPayload = {
  name: string;
  description?: string | null;
  status?: ProjectStatus | string;
  publicUrl?: string | null;
  responsibleIds?: number[];
  clientId: number;
};

export type ClientPayload = {
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  document?: string | null;
  notes?: string | null;
};

export function getClientDisplayName(client?: Pick<Client, 'name' | 'company'> | null) {
  return client?.company || client?.name || 'Cliente sem nome';
}

export function getProjectClientId(project?: Pick<Project, 'clientId' | 'client_id'> | null) {
  return project?.clientId ?? project?.client_id ?? null;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getToken() {
    if (!this.token) {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Falha na requisição' }));
      throw new Error(error.error || 'Falha na requisição');
    }

    return response.json();
  }

  get<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T>(endpoint: string, data?: unknown) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  put<T>(endpoint: string, data?: unknown) {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  patch<T>(endpoint: string, data?: unknown) {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data ?? {}),
    });
  }
}

export const api = new ApiClient();

export type ProposalFieldType = 'text' | 'number' | 'boolean' | 'select';

export type ProposalTypeField = {
  id?: number;
  label: string;
  key: string;
  fieldType: ProposalFieldType;
  options?: string | null;
  required: boolean;
  order: number;
};

export type ProposalTypeTextBlock = { id?: number; title: string; content: string; order: number };
export type ProposalTypeItem = { id?: number; description: string; qty: number; unitPrice: number; discount: number; tax: number; order: number };

export type ProposalType = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  active: boolean;
  defaultCurrency: string;
  paymentTermsDefault?: string | null;
  fields: ProposalTypeField[];
  textBlocks: ProposalTypeTextBlock[];
  items: ProposalTypeItem[];
};

export type ProposalItem = {
  id?: number;
  description: string;
  qty: number;
  unitPrice: number;
  discount: number;
  tax: number;
  lineTotal?: number;
  recurring: boolean;
  order: number;
};

export type ProposalFieldValue = { id?: number; fieldKey: string; label: string; value: string };
export type ProposalTextBlockValue = { id?: number; title: string; content: string; order: number };

export type Proposal = {
  id: number;
  number?: string | null;
  title: string;
  description?: string | null;
  value: number;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  currency: string;
  validUntil?: string | null;
  clientName?: string | null;
  status: string;
  typeId?: number | null;
  type?: { id: number; name: string } | null;
  clientId?: number | null;
  client?: Client | null;
  leadId?: number | null;
  lead?: { id: number; name: string; company?: string | null } | null;
  items?: ProposalItem[];
  fieldValues?: ProposalFieldValue[];
  textBlocks?: ProposalTextBlockValue[];
  createdAt?: string;
  updatedAt?: string;
};

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ user: any; token: string }>('/api/auth/login', { email, password }),
  requestOtp: (email: string) => api.post<{ success: boolean; expiresAt: string; devCode?: string }>('/api/auth/request-otp', { email }),
  register: (email: string, password: string, name: string, otp: string) =>
    api.post<{ user: any; token: string }>('/api/auth/register', { email, password, name, otp }),
  me: () => api.get<any>('/api/auth/me'),
  getUsers: () => api.get<any[]>('/api/auth/users'),
  getUser: (id: number) => api.get<any>(`/api/auth/users/${id}`),
  updateMe: (data: any) => api.put<any>('/api/auth/me', data),
  getRoles: () => api.get<any[]>('/api/auth/roles'),
  updateUserRole: (userId: number, roleId: number) => api.put<any>(`/api/auth/users/${userId}/role`, { roleId }),
};

export const companyApi = {
  get: () => api.get<{ companyName: string; companyObjective: string; companyLogoUrl: string }>('/api/settings/company'),
  update: (data: { companyName: string; companyObjective?: string; companyLogoUrl?: string }) =>
    api.put<{ companyName: string; companyObjective: string; companyLogoUrl: string }>('/api/settings/company', data),
};

export const projectApi = {
  getAll: () => api.get<Project[]>('/api/projects'),
  getOne: (id: number) => api.get<Project>(`/api/projects/${id}`),
  create: (data: ProjectPayload | any) => api.post<Project>('/api/projects', data),
  update: (id: number, data: Partial<ProjectPayload> | any) => api.put<Project>(`/api/projects/${id}`, data),
  delete: (id: number) => api.delete(`/api/projects/${id}`),
  addMember: (projectId: number, userId: number, role?: string) =>
    api.post<any>(`/api/projects/${projectId}/members`, { userId, role }),
  removeMember: (projectId: number, userId: number) =>
    api.delete<any>(`/api/projects/${projectId}/members/${userId}`),
  addMetrics: (projectId: number, data: {
    totalUsers: number;
    activeUsers: number;
    paidUsers?: number;
    referralUsers?: number;
    freeUsers?: number;
    collaborationUsers?: number;
    date?: string;
  }) =>
    api.post<any>(`/api/projects/${projectId}/metrics`, data),
  getSummary: (id: number) => api.get<any>(`/api/projects/${id}/summary`),
};

export const vpsApi = {
  getProviders: () => api.get<any[]>('/api/vps/providers'),
  getProvider: (id: number) => api.get<any>(`/api/vps/providers/${id}`),
  createProvider: (data: any) => api.post<any>('/api/vps/providers', data),
  updateProvider: (id: number, data: any) => api.put<any>(`/api/vps/providers/${id}`, data),
  deleteProvider: (id: number) => api.delete<any>(`/api/vps/providers/${id}`),
  getServers: () => api.get<any[]>('/api/vps/servers'),
  getServer: (id: number) => api.get<any>(`/api/vps/servers/${id}`),
  createServer: (data: any) => api.post<any>('/api/vps/servers', data),
  updateServer: (id: number, data: any) => api.put<any>(`/api/vps/servers/${id}`, data),
  deleteServer: (id: number) => api.delete<any>(`/api/vps/servers/${id}`),
  linkServer: (serverId: number, projectId: number, costShare?: number) =>
    api.post<any>(`/api/vps/servers/${serverId}/link`, { projectId, costShare }),
  unlinkServer: (serverId: number, projectId: number) =>
    api.delete<any>(`/api/vps/servers/${serverId}/link/${projectId}`),
  getItems: () => api.get<any[]>('/api/vps/items'),
  createItem: (data: any) => api.post<any>('/api/vps/items', data),
  updateItem: (id: number, data: any) => api.put<any>(`/api/vps/items/${id}`, data),
  deleteItem: (id: number) => api.delete<any>(`/api/vps/items/${id}`),
  linkItem: (itemId: number, projectId: number, costShare?: number) =>
    api.post<any>(`/api/vps/items/${itemId}/link`, { projectId, costShare }),
  unlinkItem: (itemId: number, projectId: number) =>
    api.delete<any>(`/api/vps/items/${itemId}/link/${projectId}`),
  getCosts: () => api.get<any>('/api/vps/costs'),
};

export const financeApi = {
  getTransactions: (params?: any) => api.get<any[]>(`/api/finance/transactions${params ? '?' + new URLSearchParams(params).toString() : ''}`),
  getTransaction: (id: number) => api.get<any>(`/api/finance/transactions/${id}`),
  createTransaction: (data: any) => api.post<any>('/api/finance/transactions', data),
  updateTransaction: (id: number, data: any) => api.put<any>(`/api/finance/transactions/${id}`, data),
  deleteTransaction: (id: number) => api.delete<any>(`/api/finance/transactions/${id}`),
  settleTransaction: (id: number, data?: { paymentDate?: string }) => api.patch<any>(`/api/finance/transactions/${id}/settle`, data || {}),
  getSummary: (params?: any) => api.get<any>(`/api/finance/summary${params ? '?' + new URLSearchParams(params).toString() : ''}`),
  getRates: () => api.get<any[]>('/api/finance/rates'),
  createRate: (data: { code: string; rate: number; source?: string }) => api.post<any>('/api/finance/rates', data),
  getLatestRates: () => api.get<Record<string, any>>('/api/finance/rates/latest'),
  getImpact: () => api.get<any[]>('/api/finance/impact'),
};

export const taskApi = {
  getTasks: (params?: any) => api.get<any[]>(`/api/tasks/tasks${params ? '?' + new URLSearchParams(params).toString() : ''}`),
  createTask: (data: any) => api.post<any>('/api/tasks/tasks', data),
  updateTask: (id: number, data: any) => api.put<any>(`/api/tasks/tasks/${id}`, data),
  deleteTask: (id: number) => api.delete<any>(`/api/tasks/tasks/${id}`),
  getBugs: (params?: any) => api.get<any[]>(`/api/tasks/bugs${params ? '?' + new URLSearchParams(params).toString() : ''}`),
  createBug: (data: any) => api.post<any>('/api/tasks/bugs', data),
  updateBug: (id: number, data: any) => api.put<any>(`/api/tasks/bugs/${id}`, data),
  deleteBug: (id: number) => api.delete<any>(`/api/tasks/bugs/${id}`),
  getOverview: () => api.get<any>('/api/tasks/overview'),
};

export const dashboardApi = {
  getOverview: () => api.get<any>('/api/dashboard'),
  getProjectsOverview: () => api.get<any[]>('/api/dashboard/projects/overview'),
  getAlerts: () => api.get<any[]>('/api/dashboard/alerts'),
  fetchExchangeRates: () => api.get<any>('/api/dashboard/exchange-rate/fetch'),
  getIncomeExpenseChart: (months?: number) => api.get<any[]>(`/api/dashboard/charts/income-expense?months=${months || 6}`),
  getProjectPerformance: () => api.get<any[]>('/api/dashboard/charts/project-performance'),
};

export const activityApi = {
  getAll: () => api.get<any[]>('/api/activity'),
  getLatest: () => api.get<any[]>('/api/activity/latest'),
};

export const chatApi = {
  getChannels: () => api.get<any[]>('/api/chat/channels'),
  getMessages: (channelId: number) => api.get<any[]>(`/api/chat/channels/${channelId}/messages`),
  sendMessage: (channelId: number, content: string) => api.post<any>(`/api/chat/channels/${channelId}/messages`, { content }),
  createPrivate: (userId: number) => api.post<any>('/api/chat/private', { userId }),
};

export const clientApi = {
  getAll: () => api.get<Client[]>('/api/clients'),
  getOne: (id: number) => api.get<Client>(`/api/clients/${id}`),
  create: (data: ClientPayload | any) => api.post<Client>('/api/clients', data),
  update: (id: number, data: Partial<ClientPayload> | any) => api.put<Client>(`/api/clients/${id}`, data),
  delete: (id: number) => api.delete<any>(`/api/clients/${id}`),
};

export const leadApi = {
  getAll: () => api.get<any[]>('/api/leads'),
  create: (data: any) => api.post<any>('/api/leads', data),
  update: (id: number, data: any) => api.put<any>(`/api/leads/${id}`, data),
  updateStatus: (id: number, status: string, createProject?: boolean, projectDetails?: any) => api.put<any>(`/api/leads/${id}/status`, { status, createProject, ...projectDetails }),
  delete: (id: number) => api.delete<any>(`/api/leads/${id}`),
};

export const proposalApi = {
  getAll: () => api.get<Proposal[]>('/api/proposals'),
  get: (id: number) => api.get<Proposal>(`/api/proposals/${id}`),
  create: (data: any) => api.post<Proposal>('/api/proposals', data),
  update: (id: number, data: any) => api.put<Proposal>(`/api/proposals/${id}`, data),
  updateStatus: (id: number, status: string, projectId?: number) => api.put<any>(`/api/proposals/${id}/status`, { status, projectId }),
  delete: (id: number) => api.delete<any>(`/api/proposals/${id}`),
};

export const proposalTypeApi = {
  getAll: () => api.get<ProposalType[]>('/api/proposal-types'),
  get: (id: number) => api.get<ProposalType>(`/api/proposal-types/${id}`),
  create: (data: any) => api.post<ProposalType>('/api/proposal-types', data),
  update: (id: number, data: any) => api.put<ProposalType>(`/api/proposal-types/${id}`, data),
  delete: (id: number) => api.delete<any>(`/api/proposal-types/${id}`),
};
