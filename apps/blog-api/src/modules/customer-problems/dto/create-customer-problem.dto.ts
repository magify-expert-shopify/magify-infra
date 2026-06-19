import { ProblemSource, SearchIntent } from 'src/common/types/prisma-enums';

export class CreateCustomerProblemDto {
  title!: string;
  description?: string;
  source!: ProblemSource;
  intention?: SearchIntent | null;
  categoryId?: string | null;
  clusterIds?: string[];
}
