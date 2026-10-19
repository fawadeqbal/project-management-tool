import type { RouteObject } from 'react-router-dom';
import type { Command } from '@/shared/commands/command';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

/** Public surface of the "auth" feature: its routes and the commands it contributes to ⌘K. */
export const routes: RouteObject[] = [
  { path: '/login', Component: LoginPage },
  { path: '/register', Component: RegisterPage },
];
export const commands: Command[] = [];
