import { BadRequestException } from '@nestjs/common';

export function requireProjectId(
  projectId: string | null | undefined,
  resourceLabel = 'resource',
) {
  const normalizedProjectId = projectId?.trim();

  if (!normalizedProjectId) {
    throw new BadRequestException(
      `Query param "projectId" is required to read ${resourceLabel}.`,
    );
  }

  return normalizedProjectId;
}
