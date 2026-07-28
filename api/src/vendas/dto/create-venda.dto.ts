import { IsString, IsUUID, IsEnum, IsOptional, IsArray, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { FormaPagamento } from '@prisma/client';

export class CreateItemVendaDto {
  @IsInt({ message: 'O ID do produto deve ser um número inteiro' })
  @Min(1, { message: 'ID do produto inválido' })
  produtoId: number;

  @IsInt({ message: 'A quantidade deve ser um número inteiro' })
  @Min(1, { message: 'A quantidade mínima deve ser 1' })
  quantidade: number;
}

export class CreateVendaDto {
  @IsUUID('all', { message: 'A chave de idempotência deve ser um UUID válido' })
  uuid: string;

  @IsEnum(FormaPagamento, { message: 'Forma de pagamento inválida. Use: DINHEIRO, CREDITO, DEBITO ou PIX' })
  formaPagamento: FormaPagamento;

  @IsString({ message: 'O nome do cliente deve ser uma string' })
  @IsOptional()
  clienteNome?: string;

  @IsString({ message: 'O telefone do cliente deve ser uma string' })
  @IsOptional()
  clienteTelefone?: string;

  @IsString({ message: 'A observação deve ser uma string' })
  @IsOptional()
  observacao?: string;

  @IsArray({ message: 'Os itens devem ser uma lista' })
  @ValidateNested({ each: true })
  @Type(() => CreateItemVendaDto)
  itens: CreateItemVendaDto[];
}
