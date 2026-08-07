import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class RelatoriosMensalDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'O mês deve ser um número inteiro' })
  @Min(1, { message: 'O mês deve ser entre 1 e 12' })
  @Max(12, { message: 'O mês deve ser entre 1 e 12' })
  mes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'O ano deve ser um número inteiro' })
  @Min(2020, { message: 'O ano deve ser a partir de 2020' })
  ano?: number;
}
