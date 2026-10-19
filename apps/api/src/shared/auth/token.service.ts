import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface AccessTokenPayload {
  sub: string;
}

/** Issues and verifies access tokens. Used by the HTTP guard and the websocket handshake. */
@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  issue(userId: string): Promise<string> {
    return this.jwt.signAsync({ sub: userId } satisfies AccessTokenPayload);
  }

  async verify(token: string | undefined | null): Promise<AccessTokenPayload> {
    if (!token) throw new UnauthorizedException('Sign in to continue.');
    try {
      return await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Your session has expired. Sign in again.');
    }
  }
}
