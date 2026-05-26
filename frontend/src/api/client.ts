const API_URL = import.meta.env.VITE_API_URL ?? '';
export const WS_URL = API_URL ? API_URL.replace(/^http/, 'ws') : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

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
}

export const api = new ApiClient();

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
  getAll: () => api.get<any[]>('/api/projects'),
  getOne: (id: number) => api.get<any>(`/api/projects/${id}`),
  create: (data: any) => api.post<any>('/api/projects', data),
  update: (id: number, data: any) => api.put<any>(`/api/projects/${id}`, data),
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
  createProvider: (data: any) => api.post<any>('/api/vps/providers', data),
  getServers: () => api.get<any[]>('/api/vps/servers'),
  getServer: (id: number) => api.get<any>(`/api/vps/servers/${id}`),
  createServer: (data: any) => api.post<any>('/api/vps/servers', data),
  updateServer: (id: number, data: any) => api.put<any>(`/api/vps/servers/${id}`, data),
  deleteServer: (id: number) => api.delete<any>(`/api/vps/servers/${id}`),
  linkServer: (serverId: number, projectId: number, costShare?: number) =>
    api.post<any>(`/api/vps/servers/${serverId}/link`, { projectId, costShare }),
  getItems: () => api.get<any[]>('/api/vps/items'),
  createItem: (data: any) => api.post<any>('/api/vps/items', data),
  updateItem: (id: number, data: any) => api.put<any>(`/api/vps/items/${id}`, data),
  deleteItem: (id: number) => api.delete<any>(`/api/vps/items/${id}`),
  linkItem: (itemId: number, projectId: number, costShare?: number) =>
    api.post<any>(`/api/vps/items/${itemId}/link`, { projectId, costShare }),
  getCosts: () => api.get<any>('/api/vps/costs'),
};

export const financeApi = {
  getTransactions: (params?: any) => api.get<any[]>(`/api/finance/transactions${params ? '?' + new URLSearchParams(params).toString() : ''}`),
  createTransaction: (data: any) => api.post<any>('/api/finance/transactions', data),
  deleteTransaction: (id: number) => api.delete<any>(`/api/finance/transactions/${id}`),
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
