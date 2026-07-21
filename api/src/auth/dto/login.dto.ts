import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

// Objeto de Transferência de Dados (DTO) para validação do corpo da requisição de Login
export class LoginDto {
  // Garante que o e-mail não seja nulo e seja um endereço de e-mail estruturado
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório' })
  email!: string;

  // Garante que a senha não seja vazia e tenha pelo menos 6 caracteres
  @IsNotEmpty({ message: 'A senha é obrigatória' })
  @MinLength(6, { message: 'A senha deve conter no mínimo 6 caracteres' })
  password!: string;
}
