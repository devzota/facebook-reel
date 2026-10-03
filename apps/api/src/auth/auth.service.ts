import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ZTTeamUsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ZTTeamAuthService {
  constructor(
    private usersService: ZTTeamUsersService,
    private jwtService: JwtService
  ) {}

  async ztteam_login(email: string, pass: string) {
    const user = await this.usersService.ztteam_findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(pass, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    };
  }
}
