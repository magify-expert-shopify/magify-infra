import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import {
  KeywordLengthType,
  KeywordSource,
  PageType,
} from 'src/common/types/prisma-enums';
import { SupabaseAuthenticatedUser } from 'src/modules/auth/supabase-auth/supabase-auth.types';
import { PrismaService } from 'src/prisma/prisma.service';
import { KeywordGroupService } from './keyword-group.service';

type KeywordWriteClient = PrismaService | any;

type CreateKeywordInput = {
  keyword: string;
  projectId?: string | null;
  source?: KeywordSource | null;
  isFavorite?: boolean | null;
  volume?: number | null;
  difficulty?: number | null;
  searchIntent?: string | null;
  customerProblemId?: string | null;
  keywordGroupId?: string | null;
};

@Injectable()
export class KeywordService implements OnModuleInit {
  private static readonly MAX_KEYWORD_GROUP_PARENTS = 3;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => KeywordGroupService))
    private readonly keywordGroupService: KeywordGroupService,
  ) {}

  private getSupabaseUserDisplayName(user: SupabaseAuthenticatedUser) {
    const metadata = user.userMetadata ?? {};

    const candidates = [
      metadata['full_name'],
      metadata['name'],
      metadata['username'],
      metadata['display_name'],
      user.email,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return user.email?.trim() ?? user.id;
  }

  private serializeKeywordGroupAssignmentFields(group: {
    keywordGroupAssignment?: {
      supabaseUserId?: string | null;
      assignedAt?: Date | null;
      supabaseUser?: {
        id?: string | null;
        email?: string | null;
        displayName?: string | null;
      } | null;
    } | null;
  }) {
    return {
      assignedSupabaseUserId:
        group.keywordGroupAssignment?.supabaseUser?.id ??
        group.keywordGroupAssignment?.supabaseUserId ??
        null,
      assignedSupabaseUserEmail:
        group.keywordGroupAssignment?.supabaseUser?.email?.trim() ?? null,
      assignedSupabaseUserName:
        group.keywordGroupAssignment?.supabaseUser?.displayName?.trim() ?? null,
      assignedSupabaseAssignedAt:
        group.keywordGroupAssignment?.assignedAt?.toISOString() ?? null,
    };
  }

  private async upsertSupabaseUser(
    user: SupabaseAuthenticatedUser,
    tx?: KeywordWriteClient,
  ) {
    const client = tx ?? this.prisma;

    return (client as any).supabaseUser.upsert({
      where: {
        id: user.id,
      },
      update: {
        email: user.email?.trim() || null,
        displayName: this.getSupabaseUserDisplayName(user),
        phone: user.phone?.trim() || null,
      },
      create: {
        id: user.id,
        email: user.email?.trim() || null,
        displayName: this.getSupabaseUserDisplayName(user),
        phone: user.phone?.trim() || null,
      },
    });
  }

  async onModuleInit() {
    await this.backfillLegacyKeywordGroupParents();
  }

  async listKeywords(
    input?: {
      ids?: string[];
      projectId?: string;
      includeGrouped?: boolean;
      source?: KeywordSource | null;
    },
    tx?: KeywordWriteClient,
  ) {
    const client = tx ?? this.prisma;
    const keywordIds = input?.ids ?? [];
    const projectId = input?.projectId?.trim();
    const includeGrouped = input?.includeGrouped ?? true;
    const source = input?.source ?? null;

    if (keywordIds.length) {
      return this.listKeywordsByIds(keywordIds, client);
    }

    const query = includeGrouped
      ? {
          where: {
            trashedAt: null,
            ...(projectId ? { projectId } : {}),
            ...(source ? { source } : {}),
          },
          include: {
            page: {
              select: {
                id: true,
                title: true,
                url: true,
                pageType: true,
              },
            },
            keywordGroup: {
              select: {
                id: true,
                name: true,
                description: true,
                isFavorite: true,
                seoClusterId: true,
                seoCluster: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
            seoCluster: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
          orderBy: [{ updatedAt: 'desc' }],
        }
      : {
          where: {
            trashedAt: null,
            keywordGroupId: null,
            ...(projectId ? { projectId } : {}),
            ...(source ? { source } : {}),
          },
          include: {
            page: {
              select: {
                id: true,
                title: true,
                url: true,
                pageType: true,
              },
            },
            keywordGroup: {
              select: {
                id: true,
                name: true,
                description: true,
                isFavorite: true,
              },
            },
            seoCluster: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
          orderBy: [{ updatedAt: 'desc' }],
        };

    return (client as any).keyword.findMany(query);
  }

  async listKeywordsByIds(keywordIds: string[], tx?: KeywordWriteClient) {
    const normalizedKeywordIds = Array.from(
      new Set(keywordIds.map((keywordId) => keywordId.trim()).filter(Boolean)),
    );

    if (!normalizedKeywordIds.length) {
      return [];
    }

    const client = tx ?? this.prisma;
    const keywords = (
      await Promise.all(
        normalizedKeywordIds.map((keywordId) =>
          (client as any).keyword.findUnique({
            where: {
              id: keywordId,
            },
            select: {
              id: true,
              trashedAt: true,
              keyword: true,
              isFavorite: true,
              source: true,
              volume: true,
              difficulty: true,
              searchIntent: true,
              searchIntentDescription: true,
              lengthType: true,
              lastScannedAt: true,
              createdAt: true,
              updatedAt: true,
              page: {
                select: {
                  id: true,
                  title: true,
                  url: true,
                  pageType: true,
                },
              },
              keywordGroup: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  isFavorite: true,
                  seoClusterId: true,
                  seoCluster: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                    },
                  },
                },
              },
              seoCluster: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          }),
        ),
      )
    ).filter(
      (keyword): keyword is any => Boolean(keyword) && !keyword.trashedAt,
    );
    const keywordsById = new Map(
      keywords.map((keyword: any) => [keyword.id, keyword] as const),
    );

    return normalizedKeywordIds
      .map((keywordId) => keywordsById.get(keywordId) ?? null)
      .filter((keyword): keyword is any => Boolean(keyword));
  }

  async findExistingKeyword(
    rawKeyword: string,
    projectId?: string | null,
    tx?: KeywordWriteClient,
  ) {
    const normalizedKeyword = rawKeyword.trim().toLowerCase();
    const normalizedProjectId = projectId?.trim() ?? null;

    if (!normalizedKeyword) {
      return null;
    }

    const client = tx ?? this.prisma;
    const existingKeywordRows = normalizedProjectId
      ? await client.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM "keyword"
          WHERE lower(trim(keyword)) = ${normalizedKeyword}
            AND trashedat IS NULL
            AND projectid = ${normalizedProjectId}
          LIMIT 1
        `
      : await client.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM "keyword"
          WHERE lower(trim(keyword)) = ${normalizedKeyword}
            AND trashedat IS NULL
          LIMIT 1
        `;
    const existingKeywordId = existingKeywordRows[0]?.id;

    if (!existingKeywordId) {
      return null;
    }

    return (client as any).keyword.findUnique({
      where: {
        id: existingKeywordId,
      },
      include: {
        page: true,
      },
    });
  }

  async findExistingOrCreateKeyword(
    input: CreateKeywordInput,
    tx?: KeywordWriteClient,
  ) {
    const keyword = input.keyword.trim();
    const projectId = input.projectId?.trim() || null;
    const client = tx ?? this.prisma;
    const existingKeyword = await this.findExistingKeyword(
      keyword,
      projectId,
      client,
    );

    if (existingKeyword) {
      const updatedKeyword = await this.updateKeywordMetadata(
        existingKeyword.id,
        {
          volume: input.volume,
          difficulty: input.difficulty,
          searchIntent: input.searchIntent,
          keywordGroupId: input.keywordGroupId,
        },
        client,
      );

      return {
        keyword: updatedKeyword,
        wasCreated: false,
      };
    }

    const lengthType = this.getKeywordLengthType(keyword);
    const createdKeyword = await (client as any).keyword.create({
      data: {
        keyword,
        source: input.source ?? KeywordSource.OTHER,
        projectId,
        isFavorite: input.isFavorite ?? false,
        volume: input.volume ?? null,
        difficulty: input.difficulty ?? null,
        searchIntent: input.searchIntent ?? null,
        customerProblemId: input.customerProblemId ?? null,
        keywordGroupId: input.keywordGroupId ?? null,
        lengthType,
      },
      include: {
        page: true,
      },
    });
    const keywordWithPage = await this.ensureKeywordPage(
      createdKeyword,
      undefined,
      client,
    );

    return {
      keyword: keywordWithPage,
      wasCreated: true,
    };
  }

  async updateKeywordMetadata(
    keywordId: string,
    input: {
      volume?: number | null;
      difficulty?: number | null;
      searchIntent?: string | null;
      searchIntentDescription?: string | null;
      lastScannedAt?: Date | null;
      keywordGroupId?: string | null;
      pageType?: string | null;
    },
    tx?: KeywordWriteClient,
  ) {
    const client = tx ?? this.prisma;
    const existingKeyword = await (client as any).keyword.findUnique({
      where: {
        id: keywordId,
      },
      include: {
        page: true,
      },
    });

    if (!existingKeyword) {
      throw new NotFoundException(`Keyword ${keywordId} not found`);
    }

    const updatedKeyword = await (client as any).keyword.update({
      where: {
        id: keywordId,
      },
      data: {
        ...(input.volume !== undefined ? { volume: input.volume } : {}),
        ...(input.difficulty !== undefined
          ? { difficulty: input.difficulty }
          : {}),
        ...(input.searchIntent !== undefined
          ? { searchIntent: input.searchIntent }
          : {}),
        ...(input.searchIntentDescription !== undefined
          ? { searchIntentDescription: input.searchIntentDescription }
          : {}),
        ...(input.lastScannedAt !== undefined
          ? { lastScannedAt: input.lastScannedAt }
          : {}),
        ...(input.keywordGroupId !== undefined
          ? { keywordGroupId: input.keywordGroupId }
          : {}),
        lengthType: this.getKeywordLengthType(existingKeyword.keyword),
      },
      include: {
        page: true,
      },
    });

    return this.ensureKeywordPage(updatedKeyword, input.pageType, client);
  }

  async assignTemplate(
    keywordId: string,
    pageType: string,
    tx?: KeywordWriteClient,
  ) {
    const client = tx ?? this.prisma;
    const keyword = await (client as any).keyword.findUnique({
      where: {
        id: keywordId,
      },
      include: {
        page: true,
      },
    });

    if (!keyword) {
      throw new NotFoundException(`Keyword ${keywordId} not found`);
    }

    return this.ensureKeywordPage(keyword, pageType, client);
  }

  async autoAssignTemplates(keywordIds?: string[]) {
    const normalizedKeywordIds =
      keywordIds?.map((keywordId) => keywordId.trim()).filter(Boolean) ?? [];
    const client = this.prisma;

    const keywords = await (client as any).keyword.findMany({
      where: {
        trashedAt: null,
        ...(normalizedKeywordIds.length
          ? {
              id: {
                in: normalizedKeywordIds,
              },
            }
          : {}),
      },
      include: {
        page: true,
      },
    });

    let updatedCount = 0;
    let skippedCount = 0;
    const updatedKeywords: Array<unknown> = [];

    for (const keyword of keywords) {
      if (keyword.template && keyword.template !== PageType.OTHER) {
        skippedCount++;
        continue;
      }

      const inferredPageType = this.inferPageType(
        keyword.keyword,
        keyword.searchIntent,
        keyword.lengthType ?? this.getKeywordLengthType(keyword.keyword),
      );

      if (!inferredPageType) {
        skippedCount++;
        continue;
      }

      // We only update the keyword template here.
      // Existing pages are updated in place, but no new page is created.
      const updatedKeyword = await this.ensureKeywordPage(
        keyword,
        inferredPageType,
        client,
      );

      if (updatedKeyword) {
        updatedKeywords.push(updatedKeyword);
      }

      updatedCount++;
    }

    return {
      updatedCount,
      skippedCount,
      updatedKeywords,
    };
  }

  async assignTemplateToKeywordGroup(groupId: string, pageType: string) {
    const normalizedGroupId = groupId.trim();
    const normalizedPageType = pageType.trim();

    if (!normalizedGroupId) {
      throw new Error('Keyword group id is required');
    }

    if (!normalizedPageType) {
      throw new Error('Page type is required');
    }

    const group = await (this.prisma as any).keywordGroup.findUnique({
      where: {
        id: normalizedGroupId,
      },
      include: {
        keywords: {
          include: {
            page: true,
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException(
        `KeywordGroup ${normalizedGroupId} not found`,
      );
    }

    const updatedKeywords: Array<unknown> = [];

    for (const keyword of group.keywords ?? []) {
      const updatedKeyword = await this.ensureKeywordPage(
        keyword,
        normalizedPageType,
        this.prisma,
      );

      if (updatedKeyword) {
        updatedKeywords.push(updatedKeyword);
      }
    }

    return {
      updatedCount: updatedKeywords.length,
      skippedCount: 0,
      updatedKeywords,
    };
  }

  async setKeywordFavorite(keywordId: string, isFavorite: boolean) {
    const normalizedKeywordId = keywordId.trim();

    if (!normalizedKeywordId) {
      throw new Error('Keyword id is required');
    }

    const keyword = await (this.prisma as any).keyword.findUnique({
      where: {
        id: normalizedKeywordId,
      },
      include: {
        page: true,
      },
    });

    if (!keyword) {
      throw new NotFoundException(`Keyword ${normalizedKeywordId} not found`);
    }

    return (this.prisma as any).keyword.update({
      where: {
        id: normalizedKeywordId,
      },
      data: {
        isFavorite,
      },
      include: {
        page: true,
        keywordGroup: {
          select: {
            id: true,
            name: true,
            description: true,
            isFavorite: true,
          },
        },
        seoCluster: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  async renameKeyword(keywordId: string, nextKeywordValue: string) {
    const normalizedKeywordId = keywordId.trim();
    const keyword = nextKeywordValue.trim();

    if (!normalizedKeywordId) {
      throw new Error('Keyword id is required');
    }

    if (!keyword) {
      throw new Error('Keyword is required');
    }

    const existingKeyword = await (this.prisma as any).keyword.findUnique({
      where: {
        id: normalizedKeywordId,
      },
      include: {
        page: true,
      },
    });

    if (!existingKeyword) {
      throw new NotFoundException(`Keyword ${normalizedKeywordId} not found`);
    }

    const duplicateKeyword = await this.findExistingKeyword(keyword);

    if (duplicateKeyword && duplicateKeyword.id !== normalizedKeywordId) {
      throw new Error('Ce mot-clé existe déjà.');
    }

    const renamedKeyword = await (this.prisma as any).keyword.update({
      where: {
        id: normalizedKeywordId,
      },
      data: {
        keyword,
        lengthType: this.getKeywordLengthType(keyword),
      },
      include: {
        page: true,
      },
    });

    return this.ensureKeywordPage(
      renamedKeyword,
      renamedKeyword.page?.pageType ?? null,
    );
  }

  async deleteKeyword(keywordId: string, tx?: KeywordWriteClient) {
    const normalizedKeywordId = keywordId.trim();

    if (!normalizedKeywordId) {
      throw new Error('Keyword id is required');
    }

    const client = tx ?? this.prisma;
    const keyword = await (client as any).keyword.findUnique({
      where: {
        id: normalizedKeywordId,
      },
      select: {
        id: true,
        pageId: true,
      },
    });

    if (!keyword) {
      throw new Error(`Keyword ${normalizedKeywordId} not found`);
    }

    await (client as any).keyword.update({
      where: {
        id: normalizedKeywordId,
      },
      data: {
        trashedAt: new Date(),
      },
    });

    if (keyword.pageId) {
      const pageKeywordCount = await (client as any).keyword.count({
        where: {
          pageId: keyword.pageId,
          trashedAt: null,
        },
      });

      if (!pageKeywordCount) {
        await (client as any).page.delete({
          where: {
            id: keyword.pageId,
          },
        });
      }
    }

    return {
      success: true,
    };
  }

  async deleteKeywords(keywordIds: string[], tx?: KeywordWriteClient) {
    const normalizedKeywordIds = Array.from(
      new Set(keywordIds.map((keywordId) => keywordId.trim()).filter(Boolean)),
    );

    if (!normalizedKeywordIds.length) {
      return;
    }

    const client = tx ?? this.prisma;
    const keywords = await (client as any).keyword.findMany({
      where: {
        id: {
          in: normalizedKeywordIds,
        },
      },
      select: {
        id: true,
      },
    });

    for (const keyword of keywords) {
      await this.deleteKeyword(keyword.id, client);
    }
  }

  async listSubjects() {
    return (this.prisma as any).subject.findMany({
      orderBy: {
        name: 'asc',
      },
      include: {
        _count: {
          select: {
            keywordGroups: true,
          },
        },
      },
    });
  }

  async createSubject(input: { name: string; description?: string | null }) {
    const name = input.name.trim();

    if (!name) {
      throw new Error('Subject name is required');
    }

    return (this.prisma as any).subject.create({
      data: {
        name,
        description: input.description?.trim() || null,
      },
    });
  }

  async setKeywordGroupFavorite(groupId: string, isFavorite: boolean) {
    const normalizedGroupId = groupId.trim();

    if (!normalizedGroupId) {
      throw new Error('Keyword group id is required');
    }

    const group = await (this.prisma as any).keywordGroup.findUnique({
      where: {
        id: normalizedGroupId,
      },
      select: {
        id: true,
      },
    });

    if (!group) {
      throw new NotFoundException(
        `KeywordGroup ${normalizedGroupId} not found`,
      );
    }

    const updatedGroup = await (this.prisma as any).keywordGroup.update({
      where: {
        id: normalizedGroupId,
      },
      data: {
        isFavorite,
      },
      select: {
        id: true,
        isFavorite: true,
      },
    });

    const updatedKeywords = await (
      this.prisma as any
    ).keyword.updateManyAndReturn({
      where: {
        keywordGroupId: normalizedGroupId,
        trashedAt: null,
      },
      data: {
        isFavorite,
      },
      select: {
        id: true,
        isFavorite: true,
        keywordGroup: {
          select: {
            id: true,
            name: true,
            description: true,
            isFavorite: true,
          },
        },
      },
    });

    return {
      ...updatedGroup,
      updatedKeywords,
    };
  }

  async assignKeywordGroupToCurrentUser(
    groupId: string,
    user: SupabaseAuthenticatedUser,
  ) {
    const normalizedGroupId = groupId.trim();

    if (!normalizedGroupId) {
      throw new BadRequestException('Keyword group id is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const group = await (tx as any).keywordGroup.findUnique({
        where: {
          id: normalizedGroupId,
        },
        select: {
          id: true,
        },
      });

      if (!group) {
        throw new NotFoundException(
          `KeywordGroup ${normalizedGroupId} not found`,
        );
      }

      await this.upsertSupabaseUser(user, tx);
      await (tx as any).keywordGroupAssignment.upsert({
        where: {
          keywordGroupId: normalizedGroupId,
        },
        update: {
          supabaseUserId: user.id,
          assignedAt: new Date(),
        },
        create: {
          keywordGroupId: normalizedGroupId,
          supabaseUserId: user.id,
          assignedAt: new Date(),
        },
      });

      const updatedGroup = await (tx as any).keywordGroup.findUnique({
        where: {
          id: normalizedGroupId,
        },
        include: this.keywordGroupService.getKeywordGroupAssignmentInclude(),
      });

      return updatedGroup
        ? this.keywordGroupService.serializeKeywordGroupRecord(updatedGroup)
        : {
            id: normalizedGroupId,
            assignedSupabaseUserId: user.id,
            assignedSupabaseUserEmail: user.email?.trim() || null,
            assignedSupabaseUserName: this.getSupabaseUserDisplayName(user),
            assignedSupabaseAssignedAt: new Date().toISOString(),
          };
    });
  }

  async clearKeywordGroupAssignment(
    groupId: string,
    _user: SupabaseAuthenticatedUser,
  ) {
    const normalizedGroupId = groupId.trim();

    if (!normalizedGroupId) {
      throw new BadRequestException('Keyword group id is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const group = await (tx as any).keywordGroup.findUnique({
        where: {
          id: normalizedGroupId,
        },
        select: {
          id: true,
        },
      });

      if (!group) {
        throw new NotFoundException(
          `KeywordGroup ${normalizedGroupId} not found`,
        );
      }

      await (tx as any).keywordGroupAssignment.deleteMany({
        where: {
          keywordGroupId: normalizedGroupId,
        },
      });

      return {
        id: normalizedGroupId,
        assignedSupabaseUserId: null,
        assignedSupabaseUserEmail: null,
        assignedSupabaseUserName: null,
        assignedSupabaseAssignedAt: null,
      };
    });
  }

  async listKeywordGroupsForPrompt(projectId: string) {
    const groups = await this.keywordGroupService.listKeywordGroups(projectId);

    return groups.map((group: any) => ({
      name: group.name,
      primaryKeyword: group.primaryKeyword ?? null,
      description: group.description ?? null,
      keywords: (group.keywords ?? []).map(
        (keyword: { keyword: string }) => keyword.keyword,
      ),
    }));
  }

  async listSuggestions(projectId: string) {
    return this.listKeywordGroupSuggestions(
      [
        PageType.BLOG_ARTICLE,
        PageType.TUTORIAL,
        PageType.GUIDE,
        PageType.DEFINITION,
      ],
      projectId,
    );
  }

  async listArticleSuggestions(projectId: string) {
    return this.listKeywordGroupSuggestions([PageType.BLOG_ARTICLE], projectId);
  }

  async listTutorialSuggestions(projectId: string) {
    return this.listKeywordGroupSuggestions([PageType.TUTORIAL], projectId);
  }

  async listGuideSuggestions(projectId: string) {
    return this.listKeywordGroupSuggestions([PageType.GUIDE], projectId);
  }

  async listDefinitionSuggestions(projectId: string) {
    return this.listKeywordGroupSuggestions([PageType.DEFINITION], projectId);
  }

  private async listKeywordGroupSuggestions(
    pageTypes: PageType[],
    projectId: string,
  ) {
    const groups = await this.keywordGroupService.listKeywordGroups(projectId);
    const allowedPageTypes = new Set(pageTypes);

    return groups
      .map((group: any) => {
        const keywords = (group.keywords ?? []).filter(
          (keyword: {
            template?: PageType | null;
            page?: { id: string } | null;
          }) => {
            const keywordTemplate = keyword.template ?? null;

            return (
              keywordTemplate !== null &&
              allowedPageTypes.has(keywordTemplate) &&
              !keyword.page
            );
          },
        );

        return {
          id: group.id,
          name: group.name,
          description: group.description ?? null,
          primaryKeyword: group.primaryKeyword ?? null,
          seoClusterId: group.seoClusterId ?? null,
          seoCluster: group.seoCluster
            ? {
                id: group.seoCluster.id,
                name: group.seoCluster.name,
                slug: group.seoCluster.slug ?? null,
              }
            : null,
          ...this.serializeKeywordGroupAssignmentFields(group),
          keywords: keywords.map((keyword: any) => ({
            id: keyword.id,
            keyword: keyword.keyword,
            template: keyword.template ?? null,
            volume: keyword.volume ?? null,
            difficulty: keyword.difficulty ?? null,
            searchIntent: keyword.searchIntent ?? null,
          })),
        };
      })
      .filter((group: any) => (group.keywords?.length ?? 0) > 0)
      .sort((left: any, right: any) => {
        const rightScore = right.keywords.length;
        const leftScore = left.keywords.length;

        if (rightScore !== leftScore) {
          return rightScore - leftScore;
        }

        return left.name.localeCompare(right.name, 'fr', {
          sensitivity: 'base',
        });
      });
  }

  async upsertCustomerProblemKeyword(
    input: {
      keyword: string;
      customerProblemId: string;
      searchIntent?: string | null;
    },
    tx?: KeywordWriteClient,
  ) {
    const client = tx ?? this.prisma;
    const keyword = input.keyword.trim();
    const existingKeyword = await (client as any).keyword.findUnique({
      where: {
        customerProblemId_keyword: {
          customerProblemId: input.customerProblemId,
          keyword,
        },
      },
      include: {
        page: true,
      },
    });

    if (existingKeyword) {
      return this.updateKeywordMetadata(
        existingKeyword.id,
        {
          searchIntent: input.searchIntent,
        },
        client,
      );
    }

    const createdKeyword = await (client as any).keyword.create({
      data: {
        keyword,
        customerProblemId: input.customerProblemId,
        source: KeywordSource.CUSTOMER_PROBLEM,
        searchIntent: input.searchIntent ?? null,
        lengthType: this.getKeywordLengthType(keyword),
      },
      include: {
        page: true,
      },
    });

    return this.ensureKeywordPage(createdKeyword, undefined, client);
  }

  async updateKeywordGroup(
    groupId: string,
    input: {
      name?: string;
      description?: string | null;
      keywordIds?: string[];
      primaryKeyword?: string | null;
      parentGroupId?: string | null;
      parentGroupIds?: string[] | null;
      seoClusterId?: string | null;
    },
  ) {
    const normalizedGroupId = groupId.trim();
    const keywordIds =
      input.keywordIds !== undefined
        ? this.normalizeIdList(input.keywordIds)
        : undefined;

    return this.prisma.$transaction(async (tx) => {
      const existingGroup = await (tx as any).keywordGroup.findUnique({
        where: {
          id: normalizedGroupId,
        },
        include: {
          seoCluster: true,
          keywords: {
            select: {
              id: true,
              keyword: true,
            },
          },
          keywordGroupKeywordGroupParentGroupIdToKeywordGroup: {
            select: {
              id: true,
              parentGroupId: true,
            },
          },
          childGroups: {
            select: {
              id: true,
            },
          },
          childGroupsMultiple: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!existingGroup) {
        throw new NotFoundException(
          `KeywordGroup ${normalizedGroupId} not found`,
        );
      }

      const resolvedPrimaryKeyword =
        input.primaryKeyword === undefined
          ? undefined
          : input.primaryKeyword?.trim() || null;

      if (
        resolvedPrimaryKeyword &&
        !(existingGroup.keywords ?? []).some(
          (keyword: { keyword: string }) =>
            keyword.keyword.trim().toLowerCase() ===
            resolvedPrimaryKeyword.toLowerCase(),
        )
      ) {
        throw new BadRequestException(
          'Primary keyword must belong to the group keywords.',
        );
      }

      let nextPrimaryKeyword: string | null | undefined;

      if (resolvedPrimaryKeyword !== undefined) {
        nextPrimaryKeyword = resolvedPrimaryKeyword;
      } else if (keywordIds !== undefined) {
        const normalizedCurrentPrimaryKeyword =
          existingGroup.primaryKeyword?.trim().toLowerCase() ?? null;
        const currentPrimaryKeywordStillPresent =
          normalizedCurrentPrimaryKeyword
            ? (existingGroup.keywords ?? []).some(
                (keyword: { id: string; keyword: string }) =>
                  keywordIds.includes(keyword.id) &&
                  keyword.keyword.trim().toLowerCase() ===
                    normalizedCurrentPrimaryKeyword,
              )
            : false;

        if (currentPrimaryKeywordStillPresent) {
          nextPrimaryKeyword = existingGroup.primaryKeyword;
        } else if (keywordIds.length) {
          nextPrimaryKeyword =
            await this.keywordGroupService.resolveGroupPrimaryKeyword(
              input.name?.trim() || existingGroup.name,
              keywordIds,
              tx,
            );
        } else {
          nextPrimaryKeyword = null;
        }
      } else if (input.name !== undefined && !existingGroup.primaryKeyword) {
        nextPrimaryKeyword = input.name.trim() || existingGroup.name;
      }

      await (tx as any).keywordGroup.update({
        where: {
          id: normalizedGroupId,
        },
        data: {
          ...(input.name !== undefined
            ? { name: input.name.trim() || existingGroup.name }
            : {}),
          ...(nextPrimaryKeyword !== undefined
            ? { primaryKeyword: nextPrimaryKeyword }
            : {}),
          ...(input.description !== undefined
            ? { description: input.description?.trim() || null }
            : {}),
          ...(input.parentGroupId !== undefined
            ? {
                parentGroupId: await this.resolveKeywordGroupParentId(
                  input.parentGroupId,
                  normalizedGroupId,
                  tx,
                ),
              }
            : {}),
        },
      });

      let nextSeoClusterId = await this.resolveKeywordGroupSeoClusterId(
        input.seoClusterId,
        existingGroup.projectId ?? null,
        tx,
      );

      if (input.parentGroupIds !== undefined) {
        const resolvedParentGroupIds =
          (await this.resolveKeywordGroupParentIds(
            input.parentGroupIds,
            normalizedGroupId,
            tx,
          )) ?? [];

        await (tx as any).keywordGroup.update({
          where: {
            id: normalizedGroupId,
          },
          data: {
            parentGroupId: resolvedParentGroupIds[0] ?? null,
          },
        });

        if (input.seoClusterId === undefined) {
          const inheritedSeoClusterId =
            await this.resolveInheritedSeoClusterIdFromParentIds(
              resolvedParentGroupIds,
              tx,
            );

          if (inheritedSeoClusterId) {
            nextSeoClusterId = inheritedSeoClusterId;
          }
        }
      } else if (input.parentGroupId !== undefined) {
        const resolvedParentGroupId = await this.resolveKeywordGroupParentId(
          input.parentGroupId,
          normalizedGroupId,
          tx,
        );

        await (tx as any).keywordGroup.update({
          where: {
            id: normalizedGroupId,
          },
          data: {
            parentGroupId: resolvedParentGroupId,
          },
        });

        if (input.seoClusterId === undefined && resolvedParentGroupId) {
          const inheritedSeoClusterId =
            await this.resolveInheritedSeoClusterIdFromParentIds(
              [resolvedParentGroupId],
              tx,
            );

          if (inheritedSeoClusterId) {
            nextSeoClusterId = inheritedSeoClusterId;
          }
        }
      }

      if (nextSeoClusterId !== undefined) {
        await (tx as any).keywordGroup.update({
          where: {
            id: normalizedGroupId,
          },
          data: {
            seoClusterId: nextSeoClusterId,
          },
        });
      }

      if (keywordIds !== undefined) {
        const previousKeywordIds = existingGroup.keywords.map(
          (keyword: { id: string }) => keyword.id,
        );

        if (previousKeywordIds.length) {
          await (tx as any).keyword.updateMany({
            where: {
              id: {
                in: previousKeywordIds,
              },
            },
            data: {
              keywordGroupId: null,
            },
          });
        }

        if (keywordIds.length) {
          await (tx as any).keyword.updateMany({
            where: {
              id: {
                in: keywordIds,
              },
            },
            data: {
              keywordGroupId: normalizedGroupId,
            },
          });
        }
      }

      const updatedGroup = await (tx as any).keywordGroup.findUnique({
        where: {
          id: normalizedGroupId,
        },
        include: this.keywordGroupService.getKeywordGroupInclude(),
      });

      return updatedGroup
        ? this.keywordGroupService.serializeKeywordGroupRecord(updatedGroup)
        : updatedGroup;
    });
  }

  async resolveKeywordGroupSeoClusterId(
    seoClusterId: string | null | undefined,
    projectId?: string | null,
    tx?: KeywordWriteClient,
  ): Promise<string | null | undefined> {
    if (seoClusterId === undefined) {
      return undefined;
    }

    const normalizedSeoClusterId = seoClusterId?.trim() || null;

    if (!normalizedSeoClusterId) {
      return null;
    }

    const client = tx ?? this.prisma;
    const cluster = await (client as any).seoCluster.findFirst({
      where: {
        id: normalizedSeoClusterId,
      },
      select: {
        id: true,
        projectId: true,
      },
    });

    if (!cluster) {
      throw new NotFoundException(
        `SeoCluster ${normalizedSeoClusterId} not found`,
      );
    }

    const normalizedProjectId = projectId?.trim() || null;

    if (
      normalizedProjectId &&
      cluster.projectId &&
      cluster.projectId !== normalizedProjectId
    ) {
      throw new BadRequestException(
        'Le cluster sélectionné appartient à un autre projet.',
      );
    }

    if (!cluster.projectId && normalizedProjectId) {
      await (client as any).seoCluster.update({
        where: {
          id: normalizedSeoClusterId,
        },
        data: {
          projectId: normalizedProjectId,
        },
      });
    }

    return normalizedSeoClusterId;
  }

  async resolveInheritedSeoClusterIdFromParentIds(
    parentGroupIds: string[],
    tx?: KeywordWriteClient,
  ): Promise<string | undefined> {
    if (!parentGroupIds.length) {
      return undefined;
    }

    const client = tx ?? this.prisma;
    const parentGroups = await (client as any).keywordGroup.findMany({
      where: {
        id: {
          in: parentGroupIds,
        },
      },
      select: {
        id: true,
        seoClusterId: true,
      },
    });

    const parentGroupsById = new Map<string, string | null>(
      parentGroups.map(
        (parentGroup: { id: string; seoClusterId?: string | null }) => [
          parentGroup.id,
          parentGroup.seoClusterId ?? null,
        ],
      ),
    );

    for (const parentGroupId of [...parentGroupIds].reverse()) {
      const inheritedSeoClusterId = parentGroupsById.get(parentGroupId);

      if (inheritedSeoClusterId) {
        return inheritedSeoClusterId;
      }
    }

    return undefined;
  }

  async deleteKeywordGroup(groupId: string) {
    const normalizedGroupId = groupId.trim();

    if (!normalizedGroupId) {
      throw new BadRequestException('KeywordGroup id is required');
    }

    const existingGroup = await (this.prisma as any).keywordGroup.findUnique({
      where: {
        id: normalizedGroupId,
      },
    });

    if (!existingGroup) {
      throw new NotFoundException(
        `KeywordGroup ${normalizedGroupId} not found`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await (tx as any).keyword.updateMany({
        where: {
          keywordGroupId: normalizedGroupId,
        },
        data: {
          keywordGroupId: null,
        },
      });

      await (tx as any).keywordGroup.delete({
        where: {
          id: normalizedGroupId,
        },
      });
    });

    return { deleted: true };
  }

  async resolveKeywordGroupParentId(
    parentGroupId: string | null | undefined,
    currentGroupId?: string,
    tx?: KeywordWriteClient,
  ) {
    if (parentGroupId === undefined) {
      return undefined;
    }

    if (parentGroupId === null) {
      return null;
    }

    const normalizedParentGroupId = parentGroupId.trim();

    if (!normalizedParentGroupId) {
      return null;
    }

    if (currentGroupId && normalizedParentGroupId === currentGroupId) {
      throw new BadRequestException('A group cannot be its own parent.');
    }

    const client = tx ?? this.prisma;
    const parentGroup = await (client as any).keywordGroup.findUnique({
      where: {
        id: normalizedParentGroupId,
      },
      select: {
        id: true,
      },
    });

    if (!parentGroup) {
      throw new NotFoundException(
        `KeywordGroup ${normalizedParentGroupId} not found`,
      );
    }

    if (currentGroupId) {
      const descendantIds = await this.collectKeywordGroupDescendantIds(
        currentGroupId,
        client,
      );

      if (descendantIds.has(normalizedParentGroupId)) {
        throw new BadRequestException(
          'A group cannot be nested inside one of its children.',
        );
      }
    }

    return normalizedParentGroupId;
  }

  async resolveKeywordGroupParentIds(
    parentGroupIds: string[] | null | undefined,
    currentGroupId?: string,
    tx?: KeywordWriteClient,
  ) {
    if (parentGroupIds === undefined) {
      return undefined;
    }

    if (parentGroupIds === null) {
      return [];
    }

    const normalizedParentGroupIds = [
      ...new Set(
        parentGroupIds
          .map((id) => id?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    if (!normalizedParentGroupIds.length) {
      return [];
    }

    const resolved = [] as string[];

    for (const parentGroupId of normalizedParentGroupIds) {
      const resolvedParentGroupId = await this.resolveKeywordGroupParentId(
        parentGroupId,
        currentGroupId,
        tx,
      );

      if (resolvedParentGroupId && !resolved.includes(resolvedParentGroupId)) {
        resolved.push(resolvedParentGroupId);
      }
    }

    if (resolved.length > KeywordService.MAX_KEYWORD_GROUP_PARENTS) {
      throw new BadRequestException(
        `A group can have at most ${KeywordService.MAX_KEYWORD_GROUP_PARENTS} parents.`,
      );
    }

    return resolved;
  }

  private async collectKeywordGroupDescendantIds(
    groupId: string,
    tx?: KeywordWriteClient,
  ) {
    const client = tx ?? this.prisma;
    const visited = new Set<string>();
    const stack = [groupId.trim()];

    while (stack.length) {
      const currentGroupId = stack.pop();

      if (!currentGroupId) {
        continue;
      }

      const group = await (client as any).keywordGroup.findUnique({
        where: {
          id: currentGroupId,
        },
        select: {
          childGroups: {
            select: {
              id: true,
            },
          },
          childGroupsMultiple: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!group) {
        continue;
      }

      const childIds = [
        ...(group.childGroups ?? []),
        ...(group.childGroupsMultiple ?? []),
      ].map((child: { id: string }) => child.id);

      for (const childId of childIds) {
        if (!visited.has(childId)) {
          visited.add(childId);
          stack.push(childId);
        }
      }
    }

    return visited;
  }

  private async backfillLegacyKeywordGroupParents() {
    if (!(await this.tableExists('KeywordGroup'))) {
      return;
    }

    const keywordGroups = await (this.prisma as any).keywordGroup.findMany({
      where: {
        parentGroupId: {
          not: null,
        },
      },
      select: {
        id: true,
        parentGroupId: true,
        keywordGroupKeywordGroupParentGroupIdToKeywordGroup: {
          select: {
            id: true,
          },
        },
      },
    });

    for (const keywordGroup of keywordGroups as Array<{
      id: string;
      parentGroupId: string | null;
      keywordGroupKeywordGroupParentGroupIdToKeywordGroup: {
        id: string;
      } | null;
    }>) {
      const legacyParentGroupId = keywordGroup.parentGroupId?.trim();

      if (
        !legacyParentGroupId ||
        keywordGroup.keywordGroupKeywordGroupParentGroupIdToKeywordGroup?.id ===
          legacyParentGroupId
      ) {
        continue;
      }

      await (this.prisma as any).keywordGroup.update({
        where: {
          id: keywordGroup.id,
        },
        data: {
          parentGroupId: legacyParentGroupId,
        },
      });
    }
  }

  private async tableExists(tableName: string) {
    const tables = await this.prisma.$queryRaw<Array<{ name: string }>>`
      SELECT TABLE_NAME AS name
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = current_schema() AND TABLE_NAME = ${tableName}
    `;

    return tables.length > 0;
  }

  async convertKeywordGroupToCluster(groupId: string) {
    const normalizedGroupId = groupId.trim();

    return this.prisma.$transaction(async (tx) => {
      const group = await (tx as any).keywordGroup.findUnique({
        where: {
          id: normalizedGroupId,
        },
        include: {
          seoCluster: true,
          keywords: {
            orderBy: [{ volume: 'desc' }, { keyword: 'asc' }],
          },
        },
      });

      if (!group) {
        throw new NotFoundException(
          `KeywordGroup ${normalizedGroupId} not found`,
        );
      }

      if (group.seoClusterId) {
        if (
          group.seoCluster &&
          !group.seoCluster.projectId &&
          group.projectId
        ) {
          return await (tx as any).seoCluster.update({
            where: {
              id: group.seoClusterId,
            },
            data: {
              projectId: group.projectId,
            },
          });
        }

        return group.seoCluster;
      }

      const primaryKeyword =
        group.primaryKeyword?.trim() ||
        group.keywords[0]?.keyword?.trim() ||
        group.name.trim() ||
        'cluster';
      const cluster = await (tx as any).seoCluster.create({
        data: {
          projectId: group.projectId ?? null,
          name: group.name,
          slug: this.buildSlug(group.name),
          topic: group.name,
          description: group.description?.trim() || null,
          primaryKeyword,
          userProblem: group.description?.trim() || null,
        },
      });

      await (tx as any).keywordGroup.update({
        where: {
          id: normalizedGroupId,
        },
        data: {
          seoClusterId: cluster.id,
        },
      });

      if (group.keywords.length) {
        await (tx as any).keyword.updateMany({
          where: {
            id: {
              in: group.keywords.map((keyword: { id: string }) => keyword.id),
            },
          },
          data: {
            clusterId: cluster.id,
          },
        });
      }

      return cluster;
    });
  }

  getKeywordLengthType(keyword: string) {
    const words = keyword.trim().split(/\s+/).filter(Boolean);

    if (words.length <= 1) {
      return KeywordLengthType.SHORT_TAIL;
    }

    if (words.length <= 3) {
      return KeywordLengthType.MID_TAIL;
    }

    return KeywordLengthType.LONG_TAIL;
  }

  private isSeekingAgencyKeyword(keywordText?: string | null) {
    return this.keywordTextMentionsAny(keywordText, [
      'agence',
      'magify',
      'expert',
      'coaching',
      'freelance',
    ]);
  }

  private isSeekingAppOrToolKeyword(keywordText?: string | null) {
    return this.keywordTextMentionsAny(keywordText, [
      'application',
      'apps',
      'app',
    ]);
  }

  private isSeekingOffer(keywordText?: string | null) {
    return this.keywordTextMentionsAny(keywordText, [
      'créer',
      'création',
      'creation',
      'refonte',
      'audit',
      'consultant',
    ]);
  }

  private isSeekingFaq(keywordText?: string | null) {
    return this.keywordTextMentionsAny(keywordText, ['faq']);
  }

  private keywordTextMentionsAny(
    keywordText: string | null | undefined,
    terms: string[],
  ) {
    const normalizedKeywordText = this.normalizeKeywordText(keywordText);

    return terms.some((term) =>
      normalizedKeywordText.includes(this.normalizeKeywordText(term)),
    );
  }

  private normalizeKeywordText(value: string | null | undefined) {
    return (value?.trim().toLowerCase() ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  inferPageType(
    keywordText?: string | null,
    searchIntent?: string | null,
    lengthType?: string | null,
  ): PageType | null {
    if (!searchIntent) {
      return null;
    }

    if (!lengthType) {
      return null;
    }

    if (searchIntent === 'INFORMATIONAL' && lengthType === 'LONG_TAIL') {
      return PageType.BLOG_ARTICLE;
    }

    if (searchIntent === 'INFORMATIONAL' && lengthType === 'MID_TAIL') {
      return PageType.TUTORIAL;
    }

    if (searchIntent === 'INFORMATIONAL' && lengthType === 'SHORT_TAIL') {
      return PageType.DEFINITION;
    }

    if (searchIntent === 'TRANSACTIONAL' && lengthType === 'LONG_TAIL') {
      return PageType.PRODUCT_PAGE;
    }

    if (searchIntent === 'TRANSACTIONAL' && lengthType === 'MID_TAIL') {
      return PageType.FORM;
    }

    if (searchIntent === 'TRANSACTIONAL' && lengthType === 'SHORT_TAIL') {
      return PageType.CATEGORY_PAGE;
    }

    if (searchIntent === 'COMMERCIAL') {
      if (this.isSeekingFaq(keywordText)) {
        return PageType.FAQ;
      }

      if (this.isSeekingAgencyKeyword(keywordText)) {
        return PageType.HOMEPAGE;
      }

      if (this.isSeekingAppOrToolKeyword(keywordText)) {
        return PageType.GUIDE;
      }

      if (this.isSeekingOffer(keywordText)) {
        return PageType.SERVICE_PAGE;
      }
    }

    if (searchIntent === 'NAVIGATIONAL') {
      if (this.isSeekingAgencyKeyword(keywordText)) {
        return PageType.HOMEPAGE;
      }

      if (this.isSeekingAppOrToolKeyword(keywordText)) {
        return PageType.HOMEPAGE;
      }

      if (this.isSeekingOffer(keywordText)) {
        return PageType.SERVICE_PAGE;
      }

      return PageType.BLOG_ARTICLE;
    }

    return null;
  }

  private async ensureKeywordPage(
    keyword: {
      id: string;
      keyword: string;
      searchIntent?: string | null;
      lengthType?: string | null;
      pageId?: string | null;
      template?: string | null;
      page?: { id: string; pageType?: string | null } | null;
    },
    pageTypeOverride?: string | null,
    tx?: KeywordWriteClient,
  ) {
    const client = tx ?? this.prisma;
    const targetPageType =
      pageTypeOverride ||
      this.inferPageType(
        keyword.keyword,
        keyword.searchIntent,
        keyword.lengthType ?? this.getKeywordLengthType(keyword.keyword),
      );

    if (!targetPageType) {
      return (client as any).keyword.findUnique({
        where: {
          id: keyword.id,
        },
        include: {
          page: true,
        },
      });
    }

    const pageData = {
      title: keyword.keyword,
      pageType: targetPageType,
      seoRole: 'SUPPORT',
      searchIntent: keyword.searchIntent ?? null,
      seoClusterId: null,
    };

    let pageId = keyword.pageId ?? keyword.page?.id ?? null;

    if (pageId) {
      await (client as any).page.update({
        where: {
          id: pageId,
        },
        data: {
          title: pageData.title,
          pageType: pageData.pageType,
          searchIntent: pageData.searchIntent,
        },
      });
    }

    await (client as any).keyword.update({
      where: {
        id: keyword.id,
      },
      data: {
        template: targetPageType,
        ...(pageId ? { pageId } : {}),
      },
    });

    return (client as any).keyword.findUnique({
      where: {
        id: keyword.id,
      },
      include: {
        page: true,
      },
    });
  }

  private buildSlug(value: string) {
    const normalizedValue = value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return normalizedValue || 'keyword';
  }

  normalizeIdList(ids?: string[]) {
    return [...new Set((ids ?? []).map((id) => id?.trim()).filter(Boolean))];
  }
}
