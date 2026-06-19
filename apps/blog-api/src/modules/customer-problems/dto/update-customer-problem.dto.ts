import { ProblemSource, SearchIntent } from 'src/common/types/prisma-enums';

export class UpdateCustomerProblemDto {
  title?: string;
  description?: string | null;
  source?: ProblemSource;
  intention?: SearchIntent | null;
  categoryId?: string | null;
  clusterIds?: string[];
}
