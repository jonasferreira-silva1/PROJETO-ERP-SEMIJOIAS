import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

// Guarda responsável pela autorização por cargo (Role-Based Access Control - RBAC)
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Recupera a lista de perfis permitidos passados via metadados do decorator @Roles()
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Se a rota não exige cargos específicos, libera o acesso automaticamente
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Pega o usuário logado obtido após a validação do token JWT
    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      return false; // Bloqueia acesso caso não haja usuário associado
    }

    // Permite o acesso se o cargo do usuário estiver contido nas roles exigidas
    return requiredRoles.includes(user.role);
  }
}
