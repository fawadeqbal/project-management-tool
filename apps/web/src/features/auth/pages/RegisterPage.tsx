import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button, Input } from '@hearth/ui';
import { RegisterSchema } from '@hearth/contracts';
import { useAuthStore } from '@/shared/auth/auth-store';
import { useRegister } from '../api';
import { AuthCard, FormError } from '../components/AuthCard';
import styles from '../auth.module.css';

type Field = 'name' | 'email' | 'password' | 'workspaceName';
const FIELDS: Field[] = ['name', 'email', 'password', 'workspaceName'];

export function RegisterPage() {
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();
  const register = useRegister();
  const [values, setValues] = useState<Record<Field, string>>({ name: '', email: '', password: '', workspaceName: '' });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  if (token && !register.isPending) return <Navigate to="/home" replace />;

  const set = (field: Field) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [field]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = RegisterSchema.safeParse({ ...values, workspaceName: values.workspaceName.trim() || undefined });
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      setErrors(Object.fromEntries(FIELDS.map((f) => [f, fe[f]?.[0]])));
      return;
    }
    setErrors({});
    register.mutate(parsed.data, {
      onSuccess: () => void navigate('/home', { replace: true }),
      onError: (err) => {
        const fields = Object.fromEntries(FIELDS.map((f) => [f, err.field(f)])) as Partial<Record<Field, string>>;
        setErrors(fields);
        if (!Object.values(fields).some(Boolean)) setFormError(err.message);
      },
    });
  };

  return (
    <AuthCard
      title="Create your workspace"
      subtitle="Free for small teams. Most people are set up in under 5 minutes."
      footer={
        <>
          Already using Hearth? <Link to="/login">Log in</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={submit} noValidate>
        <FormError message={formError} />
        <Input label="Your name" autoComplete="name" value={values.name} onChange={set('name')} error={errors.name} autoFocus />
        <Input
          label="Work email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={values.email}
          onChange={set('email')}
          error={errors.email}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          value={values.password}
          onChange={set('password')}
          error={errors.password}
        />
        <Input
          label="Workspace name"
          placeholder="Acme Studio"
          hint="You can change this later."
          value={values.workspaceName}
          onChange={set('workspaceName')}
          error={errors.workspaceName}
        />
        <Button type="submit" size="lg" loading={register.isPending} className={styles.submit}>
          Create workspace
        </Button>
      </form>
    </AuthCard>
  );
}
