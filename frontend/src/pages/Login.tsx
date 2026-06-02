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
    <div className="min-h-screen bg-[#070a13] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Glowing Ambient Orbs */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-brand-500/20 rounded-full blur-[100px] pointer-events-none animate-glow"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-600/10 rounded-full blur-[120px] pointer-events-none" style={{ animationDelay: '1.5s' }}></div>

      <div className="max-w-md w-full relative z-10">
        <div className="glass-card rounded-2xl shadow-2xl p-8 sm:p-10 border border-white/10 animate-slide-up backdrop-blur-xl">
          <div className="text-center mb-8">
            {companyLogoUrl ? (
              <img 
                src={companyLogoUrl} 
                alt={companyName} 
                className="w-16 h-16 object-contain mx-auto mb-4 p-2 bg-white/5 border border-white/10 rounded-2xl shadow-md" 
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center font-bold text-white text-3xl mx-auto mb-4 shadow-lg orange-glow">
                {companyName?.[0] || 'W'}
              </div>
            )}
            <h1 className="text-3xl font-extrabold text-white tracking-tight font-display">{companyName}</h1>
            <p className="text-slate-400 text-sm mt-1.5 font-medium">
              {isRegister ? 'Criar nova conta profissional' : 'Entrar na área de gestão'}
            </p>
            {companyObjective && (
              <p className="text-[11px] text-slate-500 mt-2 italic px-4 leading-relaxed">
                {companyObjective}
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-300 p-3.5 rounded-xl mb-5 text-xs font-medium animate-fade-in leading-relaxed">
              {error}
            </div>
          )}

          {info && (
            <div className="bg-brand-500/10 border border-brand-500/20 text-brand-300 p-3.5 rounded-xl mb-5 text-xs font-medium animate-fade-in leading-relaxed">
              <span>{info}</span>
              {devCode && (
                <span className="block mt-2 font-mono text-center bg-black/30 py-1.5 rounded-lg border border-white/5">
                  Código de dev: {devCode}
                </span>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Nome Completo
                </label>
                <input
                  type="text"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all text-sm"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Endereço de E-mail
              </label>
              <input
                type="email"
                placeholder="seu.email@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Senha de Acesso
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all text-sm"
                required
                minLength={6}
              />
            </div>

            {isRegister && otpRequested && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Código OTP de Verificação
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  pattern="\d{6}"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-slate-900/40 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all text-center tracking-[0.3em] font-mono text-lg font-bold"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-brand-500 to-brand-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-brand-600 hover:to-brand-700 shadow-lg orange-glow-hover active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all duration-300 mt-6"
            >
              {loading ? 'Processando...' : isRegister ? otpRequested ? 'Criar Conta' : 'Enviar Código OTP' : 'Acessar Painel'}
            </button>
          </form>

          {isRegister && otpRequested && (
            <button
              onClick={() => { setOtpRequested(false); setOtp(''); setDevCode(''); setInfo(''); }}
              className="w-full mt-4 text-xs text-brand-400 hover:text-brand-300 hover:underline font-medium transition-all"
            >
              Não recebeu? Reenviar código OTP
            </button>
          )}

          <p className="text-center mt-8 text-xs text-slate-400 font-medium">
            {isRegister ? 'Já possui um cadastro?' : 'Ainda não tem conta?'}{' '}
            <button
              onClick={toggleMode}
              className="text-brand-400 hover:text-brand-300 font-semibold hover:underline ml-1"
            >
              {isRegister ? 'Fazer Login' : 'Cadastrar-se'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
