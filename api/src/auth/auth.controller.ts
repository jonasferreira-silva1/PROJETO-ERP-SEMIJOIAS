import { Controller, Post, Body, HttpCode, HttpStatus, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

// Controller que define as rotas públicas de login
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // Endpoint POST /auth/login
  // Valida o corpo da requisição usando o LoginDto e retorna o token de acesso (200 OK)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}
