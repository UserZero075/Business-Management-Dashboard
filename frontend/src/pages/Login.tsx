import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useCompany } from '../hooks/useCompany';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [devCode, setDevCode] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const { companyName, companyObjective, companyLogoUrl } = useCompany();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      if (isRegister) {
        if (!otpRequested) {
          const response = await authApi.requestOtp(email);
          setOtpRequested(true);
          setDevCode(response.devCode || '');
          setInfo('Enviamos um código OTP para o seu e-mail. Informe-o para criar a conta.');
          return;
        }

        await register(email, password, name, otp);
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Erro na operação');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setError('');
    setInfo('');
    setOtp('');
    setOtpRequested(false);
    setDevCode('');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            {companyLogoUrl && <img src={companyLogoUrl} alt={companyName} className="w-14 h-14 object-contain mx-auto mb-3" />}
            <h1 className="text-2xl font-bold text-slate-800">{companyName}</h1>
            <p className="text-slate-500">{isRegister ? 'Criar conta' : 'Entrar'}</p>
            <p className="text-xs text-slate-400 mt-2">{companyObjective}</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          {info && (
            <div className="bg-blue-50 text-blue-700 p-3 rounded-lg mb-4 text-sm">
              {info}
              {devCode && <span className="block mt-1 font-mono">Código dev: {devCode}</span>}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                minLength={6}
              />
            </div>

            {isRegister && otpRequested && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código OTP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 tracking-[0.4em]"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Carregando...' : isRegister ? otpRequested ? 'Criar conta' : 'Enviar código OTP' : 'Entrar'}
            </button>
          </form>

          {isRegister && otpRequested && (
            <button
              onClick={() => { setOtpRequested(false); setOtp(''); setDevCode(''); setInfo(''); }}
              className="w-full mt-3 text-sm text-blue-600 hover:underline"
            >
              Reenviar código
            </button>
          )}

          <p className="text-center mt-6 text-sm text-gray-600">
            {isRegister ? 'Já tem uma conta?' : 'Não tem uma conta?'}{' '}
            <button
              onClick={toggleMode}
              className="text-blue-600 hover:underline"
            >
              {isRegister ? 'Entrar' : 'Cadastrar-se'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
