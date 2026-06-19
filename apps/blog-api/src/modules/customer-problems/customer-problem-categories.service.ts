import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomerProblemCategoryDto } from './dto/create-customer-problem-category.dto';
import { UpdateCustomerProblemCategoryDto } from './dto/update-customer-problem-category.dto';

@Injectable()
export class CustomerProblemCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return (this.prisma as any).customerProblemCategory.findMany({
      where: {
        trashedAt: null,
      },
      orderBy: [{ title: 'asc' }],
    });
  }

  async create(dto: CreateCustomerProblemCategoryDto) {
    const title = dto.title?.trim();

    if (!title) {
      throw new BadRequestException('title is required');
    }

    const clusterIds = await this.normalizeClusterIds(dto.clusterIds);

    return (this.prisma as any).customerProblemCategory.create({
      data: {
        title,
      },
    });
  }

  async update(id: string, dto: UpdateCustomerProblemCategoryDto) {
    await this.findOneOrThrow(id);

    const title = dto.title?.trim();
    const clusterIds =
      dto.clusterIds !== undefined
        ? await this.normalizeClusterIds(dto.clusterIds)
        : undefined;

    return (this.prisma as any).customerProblemCategory.update({
      where: {
        id,
      },
      data: {
        ...(dto.title !== undefined ? { title: title || 'Sans titre' } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOneOrThrow(id);

    return (this.prisma as any).customerProblemCategory.update({
      where: {
        id,
      },
      data: {
        trashedAt: new Date(),
      },
    });
  }

  private async findOneOrThrow(id: string) {
    const category = await (
      this.prisma as any
    ).customerProblemCategory.findFirst({
      where: {
        id,
        trashedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!category) {
      throw new NotFoundException(`CustomerProblemCategory ${id} not found`);
    }

    return category;
  }

  private async normalizeClusterIds(clusterIds?: string[]) {
    if (!clusterIds?.length) {
      return [];
    }

    const normalizedClusterIds = Array.from(
      new Set(
        clusterIds
          .map((clusterId) => clusterId?.trim())
          .filter((clusterId): clusterId is string => Boolean(clusterId)),
      ),
    );

    if (!normalizedClusterIds.length) {
      return [];
    }

    const existingClusters = await (this.prisma as any).seoCluster.findMany({
      where: {
        id: {
          in: normalizedClusterIds,
        },
        trashedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (existingClusters.length !== normalizedClusterIds.length) {
      throw new BadRequestException('Some clusters do not exist');
    }

    return normalizedClusterIds;
  }
}
