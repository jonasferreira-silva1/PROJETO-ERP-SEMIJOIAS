import { IsIn } from 'class-validator';

export class VendasResumoDto {
  @IsIn(['hoje', 'ontem', '7dias'], {
    message: 'Período inválido. Use: hoje, ontem ou 7dias',
  })
  periodo: 'hoje' | 'ontem' | '7dias';
}
