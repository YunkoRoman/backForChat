import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { useEffect } from 'react';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1, 'Display name is required').max(255, 'Display name is too long'),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerUser, user } = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  // Redirect to chat if already logged in
  useEffect(() => {
    if (user) {
      navigate('/chat', { replace: true });
    }
  }, [user, navigate]);

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await registerUser(data.email, data.password, data.displayName);
      navigate('/chat', { replace: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
      setError('root', { message: errorMessage });
    }
  };

  return (
    <div className="w-full h-screen bg-bg flex">
      {/* Left: Brand panel */}
      <div className="w-1/3 bg-text flex-shrink-0 px-14 py-14 flex flex-col justify-between">
        {/* Logo and brand name */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-accent flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-bg">
              <path d="M4 4H20V16H8L4 20V4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="font-display text-lg text-bg tracking-wide">Розмова</span>
        </div>

        {/* Headline and description */}
        <div className="flex flex-col gap-5">
          <div className="font-display text-4xl leading-tight text-bg">
            Спілкуйтесь
            <br />
            без затримок.
          </div>
          <div className="text-sm leading-relaxed text-gray-400 max-w-sm">
            Приватні та групові чати, статус &ldquo;у мережі&rdquo; в реальному часі та позначки прочитання — все в одному місці.
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-7">
          <div>
            <div className="font-display text-2xl text-bg">12k+</div>
            <div className="text-xs text-gray-500 mt-0.5">активних команд</div>
          </div>
          <div>
            <div className="font-display text-2xl text-bg">99.9%</div>
            <div className="text-xs text-gray-500 mt-0.5">аптайм</div>
          </div>
        </div>
      </div>

      {/* Right: Form */}
      <div className="flex-1 flex items-center justify-center p-10">
        <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-xs flex flex-col gap-7">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-text mb-2">Створити акаунт</h1>
            <p className="text-sm text-text-secondary">Приєднайтесь до Розмови сьогодні</p>
          </div>

          {/* Error message */}
          {errors.root && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {errors.root.message}
            </div>
          )}

          {/* Form fields */}
          <div className="flex flex-col gap-4">
            {/* Email field */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-semibold text-gray-700">
                Email
              </label>
              <input
                {...register('email')}
                id="email"
                type="email"
                placeholder="your@email.com"
                className={`w-full px-3.5 py-3 rounded-lg border-1.5 bg-input-bg font-sans text-sm text-text transition-colors ${
                  errors.email ? 'border-red-500' : 'border-border'
                } focus:outline-none focus:border-accent focus:bg-surface`}
              />
              {errors.email && (
                <p className="text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>

            {/* Display name field */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="displayName" className="text-xs font-semibold text-gray-700">
                Ім&rsquo;я
              </label>
              <input
                {...register('displayName')}
                id="displayName"
                type="text"
                placeholder="Ваше ім&rsquo;я"
                className={`w-full px-3.5 py-3 rounded-lg border-1.5 bg-input-bg font-sans text-sm text-text transition-colors ${
                  errors.displayName ? 'border-red-500' : 'border-border'
                } focus:outline-none focus:border-accent focus:bg-surface`}
              />
              {errors.displayName && (
                <p className="text-xs text-red-600">{errors.displayName.message}</p>
              )}
            </div>

            {/* Password field */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-xs font-semibold text-gray-700">
                Пароль
              </label>
              <input
                {...register('password')}
                id="password"
                type="password"
                placeholder="••••••••"
                className={`w-full px-3.5 py-3 rounded-lg border-1.5 bg-input-bg font-sans text-sm text-text transition-colors ${
                  errors.password ? 'border-red-500' : 'border-border'
                } focus:outline-none focus:border-accent focus:bg-surface`}
              />
              {errors.password && (
                <p className="text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-4 py-3 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm font-sans flex items-center justify-center gap-2 transition-colors"
          >
            {isSubmitting ? 'Завантажується...' : 'Зареєструватися'}
            {!isSubmitting && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-text-tertiary">або</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Sign in link */}
          <div className="text-center text-sm text-text-secondary">
            Вже маєте акаунт?{' '}
            <Link to="/login" className="text-accent hover:text-accent-hover font-semibold transition-colors">
              Увійти
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
