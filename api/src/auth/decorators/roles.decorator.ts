import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

// Chave identificadora para guardar os perfis exigidos nos metadados
export const ROLES_KEY = 'roles';

// Decorator customizado @Roles() para definir os perfis autorizados em cada endpoint HTTP
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
