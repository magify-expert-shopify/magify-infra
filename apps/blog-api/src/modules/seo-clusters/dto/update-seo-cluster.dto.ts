export class UpdateSeoClusterDto {
  name?: string;
  parentClusterId?: string | null;
  slug?: string;
  pillarKeywordGroupId?: string | null;
  secondaryKeywordGroupIds?: string[] | null;
  childClusterIds?: string[] | null;
  icon?: string;
  isFavorite?: boolean;
  isSprintCluster?: boolean;
  description?: string;
  primaryKeyword?: string;
  notes?: string;
}
