import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ schema: 'DBO', name: 'tasas_diarias' })
@Index('uq_tasas_diarias_cur_valid', ['curCod', 'validFrom'], { unique: true })
export class TasaDiaria {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'cur_cod', type: 'varchar', length: 3 })
  curCod: string;

  @Column({ name: 'valid_from', type: 'date' })
  validFrom: string;

  @Column({ name: 'rat_exc', type: 'numeric', precision: 18, scale: 6 })
  ratExc: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
