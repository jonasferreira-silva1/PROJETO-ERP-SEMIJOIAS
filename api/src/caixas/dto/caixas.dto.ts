import { IsNumber, IsOptional, IsString, IsIn, Min, MinLength } from 'class-validator';

// DTO para abertura do Caixa
export class AbrirCaixaDto {
  @IsNumber({}, { message: 'O saldo inicial deve ser um número válido' })
  @Min(0, { message: 'O saldo inicial de abertura não pode ser negativo' })
  saldoInicial: number;
}

// DTO para movimentações (Suprimentos e Sangrias)
export class CreateMovimentacaoDto {
  @IsIn(['ENTRADA', 'SAIDA'], { message: 'Tipo inválido. Use ENTRADA ou SAIDA' })
  tipo: 'ENTRADA' | 'SAIDA';

  @IsNumber({}, { message: 'O valor da movimentação deve ser um número válido' })
  @Min(0.01, { message: 'O valor mínimo de movimentação é R$ 0,01' })
  valor: number;

  @IsString({ message: 'A descrição deve ser um texto válido' })
  @MinLength(3, { message: 'A descrição deve conter no mínimo 3 caracteres' })
  descricao: string;
}

// DTO para fechamento do Caixa
export class FecharCaixaDto {
  @IsNumber({}, { message: 'O saldo final real deve ser um número válido' })
  @Min(0, { message: 'O saldo final real não pode ser negativo' })
  saldoFinalReal: number;

  @IsOptional()
  @IsString({ message: 'A observação deve ser um texto' })
  observacao?: string;
}
