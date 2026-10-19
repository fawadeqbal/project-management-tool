import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

/** Port: hashing is an infrastructure detail the identity handlers shouldn't know about. */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}

export const PASSWORD_HASHER = Symbol('PasswordHasher');

/** bcryptjs adapter (pure JS — no native build step). */
@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  private readonly rounds = 10;

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.rounds);
  }

  verify(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
