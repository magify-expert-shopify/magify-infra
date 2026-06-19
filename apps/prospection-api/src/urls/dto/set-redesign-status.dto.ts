import { RedesignStatus } from '../urls.service';

export class SetRedesignStatusDto {
  ids!: number[];
  status?: RedesignStatus;
  decision?: 'draft' | 'accepted' | 'rejected' | 'manual' | 'none';
}
