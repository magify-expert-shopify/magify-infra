export class CreateSeoClusterDto {
  name!: string;
  parentClusterId?: string;
  slug?: string;
  pillarKeywordGroupId?: string | null;
  secondaryKeywordGroupIds?: string[] | null;
  childClusterIds?: string[] | null;
  icon?: string;
  isFavorite?: boolean;
  isSprintCluster?: boolean;
  description?: string;
  primaryKeyword!: string;
  notes?: string;
}
