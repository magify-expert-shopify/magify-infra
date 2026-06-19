import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { KeywordService } from '../keywords/services/keyword.service';
import { OpenAiPlatformService } from '../openai-platform/openai-platform.service';
import { SettingsPromptConfigsService } from '../admin/settings/settings-prompt-configs.service';
import { customerProblemKeywordExtractionResponseSchema } from '../admin/settings/settings.schemas';
import { CUSTOMER_PROBLEM_KEYWORD_EXTRACTION_OPENAI_JSON_SCHEMA } from '../admin/settings/settings-openai-schemas.constants';
import {
  extractOpenAiText,
  parseStructuredOpenAiResponse,
} from '../../common/utils/openai-response';
import { CreateCustomerProblemDto } from './dto/create-customer-problem.dto';
import { UpdateCustomerProblemDto } from './dto/update-customer-problem.dto';
import { SearchIntent } from 'src/common/types/prisma-enums';

@Injectable()
export class CustomerProblemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly keywordService: KeywordService,
    private readonly openAiPlatformService: OpenAiPlatformService,
    private readonly promptConfigsService: SettingsPromptConfigsService,
  ) {}

  async findAll() {
    return (this.prisma as any).customerProblem.findMany({
      where: {
        trashedAt: null,
      },
      include: {
        category: {
          select: {
            id: true,
            title: true,
          },
        },
        clusters: {
          where: {
            trashedAt: null,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            primaryKeyword: true,
          },
        },
        keywords: {
          orderBy: [{ volume: 'desc' }, { keyword: 'asc' }],
          select: {
            id: true,
            keyword: true,
            volume: true,
            difficulty: true,
            searchIntent: true,
            lastScannedAt: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async create(dto: CreateCustomerProblemDto) {
    const title = dto.title?.trim();

    if (!title) {
      throw new BadRequestException('title is required');
    }

    const clusterIds = this.normalizeClusterIds(dto.clusterIds);
    await this.assertClustersExist(clusterIds);
    const categoryId = await this.normalizeCategoryId(dto.categoryId);

    return (this.prisma as any).customerProblem.create({
      data: {
        title,
        description: this.toNullableTrimmed(dto.description),
        source: dto.source,
        intention: this.toNullableTrimmed(dto.intention),
        categoryId,
        clusters: clusterIds.length
          ? {
              connect: clusterIds.map((id) => ({ id })),
            }
          : undefined,
      },
      include: {
        category: {
          select: {
            id: true,
            title: true,
          },
        },
        clusters: {
          where: {
            trashedAt: null,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            primaryKeyword: true,
          },
        },
        keywords: {
          orderBy: [{ volume: 'desc' }, { keyword: 'asc' }],
          select: {
            id: true,
            keyword: true,
            volume: true,
            difficulty: true,
            searchIntent: true,
            lastScannedAt: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const problem = await (this.prisma as any).customerProblem.findFirst({
      where: { id, trashedAt: null },
      include: {
        category: {
          select: {
            id: true,
            title: true,
          },
        },
        clusters: {
          where: {
            trashedAt: null,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            primaryKeyword: true,
          },
        },
        keywords: {
          orderBy: [{ volume: 'desc' }, { keyword: 'asc' }],
          select: {
            id: true,
            keyword: true,
            volume: true,
            difficulty: true,
            searchIntent: true,
            lastScannedAt: true,
          },
        },
      },
    });

    if (!problem) {
      throw new NotFoundException(`CustomerProblem ${id} not found`);
    }

    return problem;
  }

  async update(id: string, dto: UpdateCustomerProblemDto) {
    await this.findOne(id);

    const clusterIds =
      dto.clusterIds !== undefined
        ? this.normalizeClusterIds(dto.clusterIds)
        : undefined;
    const categoryId =
      dto.categoryId !== undefined
        ? await this.normalizeCategoryId(dto.categoryId)
        : undefined;

    if (clusterIds) {
      await this.assertClustersExist(clusterIds);
    }

    const trimmedTitle = dto.title?.trim();

    return (this.prisma as any).customerProblem.update({
      where: { id },
      data: {
        ...(dto.title !== undefined
          ? { title: trimmedTitle || 'Sans titre' }
          : {}),
        ...(dto.description !== undefined
          ? { description: this.toNullableTrimmed(dto.description) }
          : {}),
        ...(dto.source !== undefined ? { source: dto.source } : {}),
        ...(dto.intention !== undefined
          ? { intention: this.toNullableTrimmed(dto.intention) }
          : {}),
        ...(categoryId !== undefined ? { categoryId } : {}),
        ...(clusterIds !== undefined
          ? {
              clusters: {
                set: clusterIds.map((clusterId) => ({ id: clusterId })),
              },
            }
          : {}),
      },
      include: {
        category: {
          select: {
            id: true,
            title: true,
          },
        },
        clusters: {
          where: {
            trashedAt: null,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            primaryKeyword: true,
          },
        },
        keywords: {
          orderBy: [{ volume: 'desc' }, { keyword: 'asc' }],
          select: {
            id: true,
            keyword: true,
            volume: true,
            difficulty: true,
            searchIntent: true,
            lastScannedAt: true,
          },
        },
      },
    });
  }

  async extractKeywords(id: string) {
    const problem = await this.findOne(id);
    const extractedKeywords = await this.extractKeywordsWithAi(problem);

    await this.prisma.$transaction(async (tx) => {
      const normalizedKeywords = extractedKeywords.map((item) => item.keyword);

      await (tx as any).keyword.deleteMany({
        where: {
          customerProblemId: problem.id,
          ...(normalizedKeywords.length
            ? {
                keyword: {
                  notIn: normalizedKeywords,
                },
              }
            : {}),
        },
      });

      for (const item of extractedKeywords) {
        await this.keywordService.upsertCustomerProblemKeyword(
          {
            keyword: item.keyword,
            searchIntent: item.searchIntent,
            customerProblemId: problem.id,
          },
          tx,
        );
      }
    });

    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);

    return (this.prisma as any).customerProblem.update({
      where: { id },
      data: {
        trashedAt: new Date(),
      },
    });
  }

  private toNullableTrimmed(value?: string | null) {
    const trimmedValue = value?.trim();
    return trimmedValue ? trimmedValue : null;
  }

  private normalizeClusterIds(clusterIds?: string[]) {
    return [
      ...new Set((clusterIds ?? []).map((id) => id?.trim()).filter(Boolean)),
    ];
  }

  private async normalizeCategoryId(categoryId?: string | null) {
    const normalizedCategoryId = categoryId?.trim() || null;

    if (!normalizedCategoryId) {
      return null;
    }

    const category = await (
      this.prisma as any
    ).customerProblemCategory.findFirst({
      where: {
        id: normalizedCategoryId,
        trashedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!category) {
      throw new NotFoundException(
        `CustomerProblemCategory ${normalizedCategoryId} not found`,
      );
    }

    return normalizedCategoryId;
  }

  private async assertClustersExist(clusterIds: string[]) {
    if (!clusterIds.length) {
      return;
    }

    const count = await (this.prisma as any).seoCluster.count({
      where: {
        id: {
          in: clusterIds,
        },
        trashedAt: null,
      },
    });

    if (count !== clusterIds.length) {
      throw new NotFoundException('One or more clusters were not found');
    }
  }

  private async extractKeywordsWithAi(problem: {
    title: string;
    description?: string | null;
    source: string;
    intention?: string | null;
  }) {
    const { input, instructions, model, maxOutputTokens } =
      await this.promptConfigsService.getCustomerProblemKeywordExtractionPrompt();

    const response = await this.openAiPlatformService.createResponse({
      model:
        model || process.env.OPENAI_KEYWORD_ANALYSIS_MODEL || 'gpt-4.1-mini',
      promptType: 'CUSTOMER_PROBLEM_KEYWORD_EXTRACTION',
      instructions,
      input: this.buildKeywordExtractionPrompt(input, problem),
      text: {
        format: {
          type: 'json_schema',
          name: 'customer_problem_keyword_extraction_response',
          strict: true,
          schema: CUSTOMER_PROBLEM_KEYWORD_EXTRACTION_OPENAI_JSON_SCHEMA,
        },
      },
      max_output_tokens: maxOutputTokens,
    });

    const parsed = parseStructuredOpenAiResponse(
      response,
      customerProblemKeywordExtractionResponseSchema,
    );

    if (!parsed.keywords.length) {
      throw new BadRequestException(
        "L'extraction de mots-clés n'a retourné aucun résultat exploitable.",
      );
    }

    return parsed.keywords
      .map((item) => {
        const keyword = item.keyword.trim();
        const searchIntent = this.normalizeSearchIntent(item.searchIntent);

        if (!keyword) {
          return null;
        }

        return {
          keyword,
          searchIntent,
        };
      })
      .filter(
        (
          item,
        ): item is {
          keyword: string;
          searchIntent: SearchIntent | null;
        } => !!item,
      );
  }

  private buildKeywordExtractionPrompt(
    promptTemplate: string,
    problem: {
      title: string;
      description?: string | null;
      source: string;
      intention?: string | null;
    },
  ) {
    return promptTemplate
      .replaceAll('{{title}}', problem.title)
      .replaceAll(
        '{{description}}',
        problem.description?.trim() || 'Aucune description fournie.',
      )
      .replaceAll('{{source}}', problem.source)
      .replaceAll(
        '{{intention}}',
        problem.intention?.trim() || 'Non renseignée',
      );
  }

  private normalizeSearchIntent(value: unknown): SearchIntent | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalizedValue = value.trim().toUpperCase();

    switch (normalizedValue) {
      case 'INFORMATIONAL':
      case 'COMMERCIAL':
      case 'TRANSACTIONAL':
      case 'NAVIGATIONAL':
        return normalizedValue;
      default:
        return null;
    }
  }
}
