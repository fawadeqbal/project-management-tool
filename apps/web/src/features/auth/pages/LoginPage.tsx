import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button, Input } from '@hearth/ui';
import { LoginSchema } from '@hearth/contracts';
import { useAuthStore } from '@/shared/auth/auth-store';
import { useLogin } from '../api';
import { AuthCard, FormError } from '../components/AuthCard';
import { useSafeNext } from '../use-safe-next';
import styles from '../auth.module.css';

type Field = 'email' | 'password';

export function LoginPage() {
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();
  const next = useSafeNext();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  if (token && !login.isPending) return <Navigate to={next} replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = LoginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      setErrors({ email: fe.email?.[0], password: fe.password?.[0] });
      return;
    }
    setErrors({});
    login.mutate(parsed.data, {
      onSuccess: () => void navigate(next, { replace: true }),
      onError: (err) => {
        const fields = { email: err.field('email'), password: err.field('password') };
        setErrors(fields);
        if (!fields.email && !fields.password) setFormError(err.message);
      },
    });
  };

  return (
    <AuthCard
      title="Log in to Hearth"
      subtitle="Welcome back. Pick up right where you left off."
      footer={
        <>
          New to Hearth? <Link to="/register">Create a workspace</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={submit} noValidate>
        <FormError message={formError} />
        <Input
          label="Work email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          autoFocus
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <Button type="submit" size="lg" loading={login.isPending} className={styles.submit}>
          Log in
        </Button>
      </form>
    </AuthCard>
  );
}
