
import React, { useState } from 'react';
import {
  BrainCircuit, ArrowRight, User, Lock, Loader2, Mail,
  Facebook, AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { UserProfile } from '../types';
import { useData } from '../context/DataContext';

interface AuthProps {
  onLogin: (user: UserProfile) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const { systemSettings } = useData();
  const registrationEnabled = systemSettings.features.registrationEnabled;
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    termsAccepted: false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isRegistering && formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (isRegistering && !formData.termsAccepted) {
      setError('Você deve aceitar os termos de uso.');
      return;
    }

    setIsLoading(true);

    if (isRegistering) {
      // Mock registration for now, or implement api/auth/register.php
      // Keeping mock logic as per plan scope (Login was priority)
      await new Promise(resolve => setTimeout(resolve, 1200));
      setIsEmailSent(true);
      setIsLoading(false);
    } else {
      try {
        const response = await fetch('http://localhost/questao-pro-backend/api/auth/login.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email, password: formData.password })
        });
        const result = await response.json();

        if (result.success && result.data) {
          const user = result.data;
          // Ensure fields map correctly to UserProfile
          onLogin({
            ...user,
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            level: Number(user.level),
            xp: Number(user.xp),
            // Defaults for fields not yet in DB or JSON
            savedQuestionIds: [],
            simulations: [],
            purchasedMaterialIds: [],
            preferences: user.preferences ? JSON.parse(user.preferences) : { shareData: true, notifications: true },
            billing: { plan: user.plan, billingCycle: user.billing_cycle || 'monthly' },
            reputation: Number(user.reputation || 100),
            status: user.status
          });
        } else {
          setError(result.message || 'Credenciais inválidas.');
        }
      } catch (err) {
        console.error(err);
        setError('Erro de conexão com o servidor.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSocialLogin = (provider: string) => {
    setIsLoading(true);
    setTimeout(() => {
      // Mock Admin Login for Facebook (Requested for Testing)
      if (provider === 'Facebook') {
        onLogin({
          id: 'u-admin', // Matches seed.sql
          name: 'Administrador',
          email: 'admin@concursomestre.com',
          role: 'admin',
          level: 99,
          xp: 100000,
          reputation: 1000,
          status: 'active',
          emailVerified: true,
          billing: { plan: 'Elite', billingCycle: 'annual' },
          // Defaults
          savedQuestionIds: [],
          simulations: [],
          purchasedMaterialIds: [],
          preferences: { shareData: true, notifications: true },
          isAdmin: true,
          targetExam: 'Geral'
        });
      } else {
        // Use a fixed set of mock users that correspond to the database seeding
        const mockUsers: Record<string, any> = {
          'Google': {
            id: 'u-partner',
            name: 'Renato Silva',
            email: 'renato@concursomestre.com',
          },
          'Apple': {
            id: 'u-pro',
            name: 'Usuário Pro',
            email: 'pro@concursomestre.com',
          }
        };

        const mockUser = mockUsers[provider] || {
          id: 'u-partner',
          name: `${provider} User`,
          email: `social@${provider.toLowerCase()}.com`,
        };

        onLogin({
          ...mockUser,
          emailVerified: true,
          targetExam: 'Concurso Público',
          level: 1,
          xp: 0,
          savedQuestionIds: [],
          simulations: [],
          purchasedMaterialIds: [],
          preferences: { shareData: true, notifications: true },
          billing: { plan: 'Gratuito', billingCycle: 'monthly' },
          isAdmin: false,
          reputation: 100,
          status: 'active',
          role: 'user'
        });
      }
      setIsLoading(false);
    }, 1000);
  };

  if (isEmailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 font-sans animate-fade-in transition-colors">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-10 text-center space-y-6 border border-slate-100 dark:border-slate-800 transition-colors">
          <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-2">
            <Mail size={40} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 transition-colors">Quase lá!</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed transition-colors">
            Enviamos um e-mail de confirmação para <strong>{formData.email}</strong>.<br />
            Acesse sua caixa de entrada para ativar sua conta.
          </p>
          <button
            onClick={() => handleSocialLogin('Email')}
            className="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl font-bold uppercase text-xs tracking-widest shadow-xl hover:bg-slate-800 dark:hover:bg-indigo-700 transition-all"
          >
            Continuar (Simular Confirmação)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-4 font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900/30 transition-colors">
      <div className="max-w-xl w-full bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-scale-in transition-colors">
        <div className="p-8 md:p-12 w-full">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-2xl mb-10 justify-center">
            <BrainCircuit className="w-8 h-8" />
            <span className="tracking-tight">ConcursoMestre</span>
          </div>

          <div className="mb-8 text-center">
            <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight transition-colors">
              {isRegistering ? 'Crie sua conta' : 'Acesse sua conta'}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 font-medium transition-colors">
              Prepare-se para a aprovação com tecnologia e estratégia.
            </p>
          </div>

          {isRegistering && !registrationEnabled ? (
            <div className="p-8 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-3xl text-center space-y-4 animate-scale-in">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-500 rounded-2xl flex items-center justify-center mx-auto">
                <AlertCircle size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Registros Suspensos</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">No momento não estamos aceitando novos alunos. Tente novamente mais tarde!</p>
              </div>
              <button
                onClick={() => setIsRegistering(false)}
                className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:underline"
              >
                Voltar para Login
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-8">
                <button
                  onClick={() => handleSocialLogin('Google')}
                  className="flex items-center justify-center gap-2 h-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-750 transition-all shadow-sm text-slate-700 dark:text-slate-300 font-bold text-xs"
                >
                  <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-4 h-4" alt="Google" />
                  Google
                </button>
                <button
                  onClick={() => handleSocialLogin('Facebook')}
                  className="flex items-center justify-center gap-2 h-12 bg-[#1877F2] text-white rounded-2xl hover:bg-[#166fe5] transition-all shadow-sm font-bold text-xs"
                >
                  <Facebook size={16} fill="white" />
                  Facebook (Admin + Elite)
                </button>
              </div>

              <div className="relative flex py-5 items-center mb-4">
                <div className="flex-grow border-t border-slate-100 dark:border-slate-800"></div>
                <span className="flex-shrink mx-4 text-slate-300 dark:text-slate-600 text-[10px] font-black uppercase tracking-widest transition-colors">ou use seu e-mail</span>
                <div className="flex-grow border-t border-slate-100 dark:border-slate-800"></div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {isRegistering && (
                  <div className="space-y-1 animate-slide-right">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 transition-colors">Nome Completo</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full h-12 pl-11 pr-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                        placeholder="Seu nome"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 transition-colors">E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full h-12 pl-11 pr-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                      placeholder="exemplo@email.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 transition-colors">Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                      <input
                        type="password"
                        required
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                        className="w-full h-12 pl-11 pr-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                  {isRegistering && (
                    <div className="space-y-1 animate-slide-left">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 transition-colors">Confirmar</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                        <input
                          type="password"
                          required
                          value={formData.confirmPassword}
                          onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                          className="w-full h-12 pl-11 pr-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {isRegistering && (
                  <label className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.termsAccepted}
                      onChange={e => setFormData({ ...formData, termsAccepted: e.target.checked })}
                      className="mt-1 w-4 h-4 rounded text-indigo-600 dark:text-indigo-500 focus:ring-indigo-500 dark:focus:ring-indigo-400 dark:bg-slate-700 dark:border-slate-600"
                    />
                    <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">
                      Li e aceito os <Link to="/terms" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">Termos de Uso</Link> e a <Link to="/privacy" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">Política de Privacidade</Link>.
                    </span>
                  </label>
                )}

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold animate-shake transition-colors">
                    <AlertCircle size={14} />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-14 bg-slate-900 dark:bg-indigo-600 text-white font-black rounded-2xl text-xs uppercase tracking-[0.2em] hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : (isRegistering ? 'Criar Conta Grátis' : 'Entrar na Plataforma')}
                  {!isLoading && <ArrowRight size={18} />}
                </button>
              </form>

              <div className="mt-8 text-center">
                <button
                  onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
                  className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center justify-center gap-2 mx-auto"
                >
                  {isRegistering ? 'Já possui conta?' : 'Novo por aqui?'}
                  <span className="text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-widest">{isRegistering ? 'Login' : 'Criar Conta'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
