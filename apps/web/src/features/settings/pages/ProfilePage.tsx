import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MeDto } from '@hearth/contracts';
import { ACCENT_COLORS, type AccentColor } from '@hearth/domain';
import { Avatar, Button, Input } from '@hearth/ui';
import { api } from '@/shared/api/client';
import { ApiError } from '@/shared/api/http';
import { queryKeys } from '@/shared/api/query-keys';
import { useAuthStore } from '@/shared/auth';
import { useToast } from '@/shared/toast';
import styles from '../settings.module.css';

/** Settings → Profile: name, job title, avatar color (PATCH /me). */
export function ProfilePage() {
  const me = useAuthStore((s) => s.me);
  const setMe = useAuthStore((s) => s.setMe);
  const client = useQueryClient();
  const { show } = useToast();
  const [name, setName] = useState(me?.user.name ?? '');
  const [jobTitle, setJobTitle] = useState(me?.user.jobTitle ?? '');
  const [color, setColor] = useState<AccentColor>(me?.user.avatarColor ?? 'blue');
  const [nameError, setNameError] = useState<string>();

  useEffect(() => {
    if (!me) return;
    setName(me.user.name);
    setJobTitle(me.user.jobTitle ?? '');
    setColor(me.user.avatarColor);
  }, [me]);

  const save = useMutation<MeDto, ApiError, void>({
    mutationFn: async () => {
      try {
        return await api.me.update({
          name: name.trim(),
          jobTitle: jobTitle.trim() || null,
          avatarColor: color,
        });
      } catch (e) {
        throw ApiError.from(e);
      }
    },
    onSuccess: (next) => {
      setMe(next);
      client.setQueriesData({ queryKey: queryKeys.me }, next);
      void client.invalidateQueries({ queryKey: queryKeys.members });
      show({ message: 'Profile saved' });
    },
    onError: (e) => {
      if (e.field('name')) setNameError(e.field('name'));
      else show({ message: e.message, tone: 'danger', icon: 'alert' });
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setNameError('Add your name — teammates see it on tasks and comments.');
    setNameError(undefined);
    save.mutate();
  };

  const initials =
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ||
    me?.user.initials ||
    '?';
  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <h1 className={styles.title}>Profile</h1>
        <p className={styles.subtitle}>How you appear to teammates on tasks, comments and @mentions.</p>
      </div>
      <form className={`${styles.card} ${styles.formCard}`} onSubmit={submit} noValidate>
        <div className={styles.avatarRow}>
          <Avatar initials={initials} name={name} size={40} color={color} />
          <span className={styles.muted}>{me?.user.email}</span>
        </div>
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameError}
          autoComplete="name"
          maxLength={80}
        />
        <Input
          label="Job title"
          hint="Optional — shown on your profile card."
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          maxLength={80}
          placeholder="Product designer"
        />
        <fieldset className={styles.colorField}>
          <legend className={styles.legend}>Avatar color</legend>
          <div className={styles.swatches}>
            {ACCENT_COLORS.map((c) => (
              <label
                key={c}
                className={`${styles.swatch} ${color === c ? styles.swatchOn : ''}`}
                style={{ background: `var(--accent-${c}-avatar)` }}
              >
                <input
                  type="radio"
                  name="avatar-color"
                  value={c}
                  checked={color === c}
                  onChange={() => setColor(c)}
                  aria-label={c.charAt(0).toUpperCase() + c.slice(1)}
                />
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <Button type="submit" loading={save.isPending}>
            Save profile
          </Button>
        </div>
      </form>
    </div>
  );
}
