
import React, { useState } from 'react';
import { ArrowRight, Sparkles, Loader2, Mail, Lock, CheckCircle } from 'lucide-react';
import { authService } from '../services/auth';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState(''); 
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('请输入邮箱和密码');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      if (isRegister) {
        await authService.register(email, password);
        setNeedsVerification(true);
      } else {
        const user = await authService.login(email, password);
        onLogin(user);
      }
    } catch (err: any) {
      setError(err.message || '发生未知错误');
    } finally {
      setIsLoading(false);
    }
  };

  if (needsVerification) {
      return (
        <div className="h-screen w-full bg-[#FDFBF7] flex flex-col items-center justify-center p-8 text-center animate-fade-in">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 text-green-500 animate-pop-in">
                <CheckCircle size={40} />
            </div>
            <h2 className="text-2xl font-bold text-brand-brown mb-2 animate-slide-up">验证邮件已发送</h2>
            <p className="text-brand-brownLight mb-8 animate-slide-up delay-100 max-w-sm">
                我们已向 <strong>{email}</strong> 发送了一封验证邮件。请查收并点击链接激活您的账号。
            </p>
            <button 
                onClick={() => {
                    setNeedsVerification(false);
                    setIsRegister(false);
                }}
                className="w-full max-w-sm py-4 bg-brand-brown text-white rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-transform animate-slide-up delay-200"
            >
                返回登录
            </button>
        </div>
      );
  }

  return (
    <div className="h-screen w-full bg-[#FDFBF7] flex flex-col items-center justify-center p-8 relative overflow-hidden animate-fade-in">
      <div className="absolute top-[-10%] right-[-20%] w-96 h-96 bg-brand-greenLight rounded-full blur-3xl opacity-60 animate-pulse"></div>
      <div className="absolute bottom-[-10%] left-[-20%] w-96 h-96 bg-brand-orangeLight rounded-full blur-3xl opacity-60 animate-pulse delay-300"></div>

      <div className="z-10 w-full max-w-sm flex flex-col items-center">
        <div className="w-24 h-24 bg-brand-green rounded-3xl rotate-3 flex items-center justify-center shadow-lg mb-8 animate-pop-in">
            <Sparkles className="text-white w-12 h-12" />
        </div>

        <h1 className="text-4xl font-extrabold text-brand-brown mb-2 animate-slide-up delay-100">蜜蜂狗农场</h1>
        <p className="text-brand-brownLight mb-10 text-center animate-slide-up delay-100">
          {isRegister ? "创建一个账号，开启冒险！" : "欢迎回家，准备好玩耍了吗？"}
        </p>

        <div className="w-full space-y-4 animate-slide-up delay-200">
          <div className="relative group">
             <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-green" size={20} />
             <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="电子邮箱" 
              className="w-full p-4 pl-12 rounded-2xl bg-white border border-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-green text-brand-brown"
            />
          </div>
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-green" size={20} />
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码" 
              className="w-full p-4 pl-12 rounded-2xl bg-white border border-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-green text-brand-brown"
            />
          </div>
          {error && <div className="text-red-500 text-sm font-bold text-center bg-red-50 p-2 rounded-lg">{error}</div>}
          <button 
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full py-4 mt-4 bg-brand-brown text-white rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <>{isRegister ? '立即注册' : '开启农场'}<ArrowRight size={20} /></>}
          </button>
        </div>
        <div className="mt-8 text-center animate-slide-up delay-300">
            <p className="text-brand-brownLight text-sm font-bold">
                {isRegister ? "已有账号？" : "还没有账号？"}
                <button onClick={() => setIsRegister(!isRegister)} className="ml-2 text-brand-orange underline">
                    {isRegister ? "去登录" : "去注册"}
                </button>
            </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
