import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ZTTeamRole } from '@prisma/client';

export const ZTTeamRoles = (...roles: ZTTeamRole[]) => {
  return Reflect.metadata('roles', roles);
};

@Injectable()
export class ZTTeamRolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<ZTTeamRole[]>('roles', context.getHandler());
    if (!requiredRoles) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user?.role);
  }
}
