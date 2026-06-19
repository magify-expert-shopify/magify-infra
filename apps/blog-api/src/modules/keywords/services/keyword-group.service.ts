import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PageType } from 'src/common/types/prisma-enums';
import { PrismaService } from '../../../prisma/prisma.service';
import { parseStructuredOpenAiResponse } from '../../../common/utils/openai-response';
import { OpenAiPlatformService } from '../../openai-platform/openai-platform.service';
import { SettingsPromptConfigsService } from '../../admin/settings/settings-prompt-configs.service';
import {
  KEYWORD_GROUP_DEDUPLICATION_OPENAI_JSON_SCHEMA,
  KEYWORD_GROUP_TEMPLATE_OPENAI_JSON_SCHEMA,
} from '../../admin/settings/settings-openai-schemas.constants';
import {
  keywordGroupDeduplicationResponseSchema,
  keywordGroupTemplateResponseSchema,
  STRUCTURED_PAGE_TYPES,
} from '../../admin/settings/settings.schemas';
import { KeywordService } from '../services/keyword.service';
import { EMPTY_KEYWORD_GROUP_TEMPLATE_RESULT } from '../keywords-response.constants';

type KeywordWriteClient = PrismaService | any;

@Injectable()
export class KeywordGroupService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => KeywordService))
    private readonly keywordService: KeywordService,
    private readonly openAiPlatformService: OpenAiPlatformService,
    private readonly promptConfigsService: SettingsPromptConfigsService,
  ) {}

  private getKeywordGroupAssignmentSelect() {
    return {
      assignment: {
        include: {
          supabaseUser: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
      },
    };
  }

  private serializeKeywordGroupAssignmentFields(group: {
    assignment?: {
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
        group.assignment?.supabaseUser?.id ??
        group.assignment?.supabaseUserId ??
        null,
      assignedSupabaseUserEmail:
        group.assignment?.supabaseUser?.email?.trim() ?? null,
      assignedSupabaseUserName:
        group.assignment?.supabaseUser?.displayName?.trim() ?? null,
      assignedSupabaseAssignedAt:
        group.assignment?.assignedAt?.toISOString() ?? null,
    };
  }

  async autoAssignTemplates(groupId: string) {
    const normalizedGroupId = groupId.trim();

    if (!normalizedGroupId) {
      throw new Error('Keyword group id is required');
    }

    if (normalizedGroupId === 'ungrouped') {
      throw new BadRequestException(
        'The ungrouped section cannot receive an auto template.',
      );
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

    if (!group.keywords?.length) {
      return {
        ...EMPTY_KEYWORD_GROUP_TEMPLATE_RESULT,
        pageType: PageType.OTHER,
      };
    }

    if (!this.openAiPlatformService.isConfigured()) {
      throw new Error('OpenAI is not configured.');
    }

    const promptConfig =
      await this.promptConfigsService.getKeywordGroupTemplatePrompt();
    const promptInput = this.buildKeywordGroupTemplatePromptInput(
      promptConfig.input,
      group.name,
      group.description,
    );

    const response = await this.openAiPlatformService.createResponse({
      model: promptConfig.model,
      promptType: 'KEYWORD_GROUP_TEMPLATE',
      instructions: promptConfig.instructions,
      input: promptInput,
      max_output_tokens: promptConfig.maxOutputTokens,
      text: {
        format: {
          type: 'json_schema',
          name: 'keyword_group_template_response',
          strict: true,
          schema: KEYWORD_GROUP_TEMPLATE_OPENAI_JSON_SCHEMA,
        },
      },
    });

    const parsed = this.parseKeywordGroupTemplateResponse(response);

    if (parsed.pageType === PageType.OTHER) {
      return {
        updatedCount: 0,
        skippedCount: group.keywords.length,
        updatedKeywords: [],
        pageType: parsed.pageType,
      };
    }

    const result = await this.keywordService.assignTemplateToKeywordGroup(
      normalizedGroupId,
      parsed.pageType,
    );

    return {
      ...result,
      pageType: parsed.pageType,
    };
  }

  async suggestDuplicateKeywordGroups(
    keywordGroups: Array<{
      id: string;
      name: string;
      description?: string | null;
    }>,
  ) {
    const normalizedGroups = keywordGroups
      .map((group) => ({
        id: group.id.trim(),
        name: group.name.trim(),
        description: group.description?.trim() || null,
      }))
      .filter((group) => group.id && group.name);

    if (!normalizedGroups.length) {
      return {
        merges: [],
      };
    }

    if (!this.openAiPlatformService.isConfigured()) {
      throw new Error('OpenAI is not configured.');
    }

    const promptConfig =
      await this.promptConfigsService.getKeywordGroupDeduplicationPrompt();
    const promptInput = this.buildKeywordGroupDeduplicationPromptInput(
      promptConfig.input,
      normalizedGroups,
    );

    const response = await this.openAiPlatformService.createResponse({
      model: promptConfig.model,
      promptType: 'KEYWORD_GROUP_DEDUPLICATION',
      instructions: promptConfig.instructions,
      input: promptInput,
      max_output_tokens: promptConfig.maxOutputTokens,
      text: {
        format: {
          type: 'json_schema',
          name: 'keyword_group_deduplication_response',
          strict: true,
          schema: KEYWORD_GROUP_DEDUPLICATION_OPENAI_JSON_SCHEMA,
        },
      },
    });

    return this.parseKeywordGroupDeduplicationResponse(
      response,
      normalizedGroups,
    );
  }

  async getCachedDuplicateKeywordGroups(
    keywordGroups: Array<{
      id: string;
      name: string;
      description?: string | null;
    }>,
  ) {
    const normalizedGroups = keywordGroups
      .map((group) => ({
        id: group.id.trim(),
        name: group.name.trim(),
        description: group.description?.trim() || null,
      }))
      .filter((group) => group.id && group.name);

    if (!normalizedGroups.length) {
      return {
        merges: [],
      };
    }

    const promptConfig =
      await this.promptConfigsService.getKeywordGroupDeduplicationPrompt();
    const promptInput = this.buildKeywordGroupDeduplicationPromptInput(
      promptConfig.input,
      normalizedGroups,
    );

    const cachedResponse = await this.openAiPlatformService.getCachedResponse({
      model: promptConfig.model,
      promptType: 'KEYWORD_GROUP_DEDUPLICATION',
      instructions: promptConfig.instructions,
      input: promptInput,
      max_output_tokens: promptConfig.maxOutputTokens,
      text: {
        format: {
          type: 'json_schema',
          name: 'keyword_group_deduplication_response',
          strict: true,
          schema: KEYWORD_GROUP_DEDUPLICATION_OPENAI_JSON_SCHEMA,
        },
      },
    });

    if (!cachedResponse) {
      return {
        merges: [],
      };
    }

    return this.parseKeywordGroupDeduplicationResponse(
      cachedResponse,
      normalizedGroups,
    );
  }

  async mergeKeywordGroups(targetGroupId: string, sourceGroupIds: string[]) {
    const normalizedTargetGroupId = targetGroupId.trim();
    const normalizedSourceGroupIds = Array.from(
      new Set(
        sourceGroupIds
          .map((groupId) => groupId.trim())
          .filter((groupId) => groupId && groupId !== normalizedTargetGroupId),
      ),
    );

    if (!normalizedTargetGroupId) {
      throw new BadRequestException('Target keyword group id is required');
    }

    if (!normalizedSourceGroupIds.length) {
      throw new BadRequestException('Source keyword group ids are required');
    }

    return this.prisma.$transaction(async (tx) => {
      const targetGroup = await (tx as any).keywordGroup.findUnique({
        where: {
          id: normalizedTargetGroupId,
        },
        select: {
          id: true,
          name: true,
          description: true,
          primaryKeyword: true,
          parentGroupId: true,
          seoClusterId: true,
          isFavorite: true,
          keywords: {
            select: {
              id: true,
              keyword: true,
            },
          },
          ...this.getKeywordGroupAssignmentSelect(),
          parentGroups: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!targetGroup) {
        throw new NotFoundException(
          `KeywordGroup ${normalizedTargetGroupId} not found`,
        );
      }

      const sourceGroups = await (tx as any).keywordGroup.findMany({
        where: {
          id: {
            in: normalizedSourceGroupIds,
          },
          trashedAt: null,
        },
        select: {
          id: true,
          name: true,
          description: true,
          primaryKeyword: true,
          parentGroupId: true,
          seoClusterId: true,
          isFavorite: true,
          keywords: {
            select: {
              id: true,
              keyword: true,
            },
          },
          ...this.getKeywordGroupAssignmentSelect(),
          parentGroups: {
            select: {
              id: true,
            },
          },
          childGroups: {
            select: {
              id: true,
              parentGroupId: true,
            },
          },
          childGroupsMultiple: {
            select: {
              id: true,
            },
          },
        },
      });

      const targetKeywordIds = new Set(
        (targetGroup.keywords ?? []).map(
          (keyword: { id: string }) => keyword.id,
        ),
      );
      const sourceKeywordIds: string[] = [];
      const parentGroupIdsToConnect = new Set<string>();
      const legacyChildGroupIds = new Set<string>();
      const multiParentChildGroupIds = new Set<string>();
      let nextDescription = targetGroup.description?.trim() || null;
      let nextPrimaryKeyword = targetGroup.primaryKeyword?.trim() || null;
      let nextParentGroupId = targetGroup.parentGroupId ?? null;
      let nextSeoClusterId = targetGroup.seoClusterId ?? null;
      let nextIsFavorite = Boolean(targetGroup.isFavorite);

      for (const sourceGroup of sourceGroups as Array<{
        id: string;
        name: string;
        description: string | null;
        primaryKeyword: string | null;
        parentGroupId: string | null;
        seoClusterId: string | null;
        isFavorite: boolean;
        keywords: Array<{ id: string; keyword: string }>;
        parentGroups: Array<{ id: string }>;
        childGroups: Array<{ id: string }>;
        childGroupsMultiple: Array<{ id: string }>;
      }>) {
        if (!nextDescription && sourceGroup.description?.trim()) {
          nextDescription = sourceGroup.description.trim();
        }

        if (!nextPrimaryKeyword && sourceGroup.primaryKeyword?.trim()) {
          nextPrimaryKeyword = sourceGroup.primaryKeyword.trim();
        }

        if (!nextSeoClusterId && sourceGroup.seoClusterId) {
          nextSeoClusterId = sourceGroup.seoClusterId;
        }

        if (!nextParentGroupId && sourceGroup.parentGroupId) {
          nextParentGroupId = sourceGroup.parentGroupId;
        }

        if (sourceGroup.isFavorite) {
          nextIsFavorite = true;
        }

        const sourceParentGroupIds = [
          ...new Set(
            (sourceGroup.parentGroups ?? []).map(
              (parentGroup) => parentGroup.id,
            ),
          ),
        ];

        sourceParentGroupIds.forEach((parentGroupId) =>
          parentGroupIdsToConnect.add(parentGroupId),
        );

        sourceGroup.keywords.forEach((keyword) => {
          if (!targetKeywordIds.has(keyword.id)) {
            sourceKeywordIds.push(keyword.id);
          }
        });

        const sourceLegacyChildGroupIds = [
          ...(sourceGroup.childGroups ?? []).map((childGroup) => childGroup.id),
        ];

        sourceLegacyChildGroupIds.forEach((childGroupId) =>
          legacyChildGroupIds.add(childGroupId),
        );

        (sourceGroup.childGroupsMultiple ?? []).forEach((childGroup) =>
          multiParentChildGroupIds.add(childGroup.id),
        );
      }

      if (sourceKeywordIds.length) {
        await (tx as any).keyword.updateMany({
          where: {
            id: {
              in: sourceKeywordIds,
            },
          },
          data: {
            keywordGroupId: normalizedTargetGroupId,
          },
        });
      }

      if (parentGroupIdsToConnect.size) {
        await (tx as any).keywordGroup.update({
          where: {
            id: normalizedTargetGroupId,
          },
          data: {
            parentGroups: {
              connect: Array.from(parentGroupIdsToConnect).map((id) => ({
                id,
              })),
            },
          },
        });
      }

      if (legacyChildGroupIds.size) {
        await Promise.all(
          Array.from(legacyChildGroupIds).map((childGroupId) =>
            (tx as any).keywordGroup.update({
              where: {
                id: childGroupId,
              },
              data: {
                parentGroupId: normalizedTargetGroupId,
                parentGroups: {
                  connect: [{ id: normalizedTargetGroupId }],
                },
              },
            }),
          ),
        );
      }

      if (multiParentChildGroupIds.size) {
        await Promise.all(
          Array.from(multiParentChildGroupIds).map((childGroupId) =>
            (tx as any).keywordGroup.update({
              where: {
                id: childGroupId,
              },
              data: {
                parentGroups: {
                  connect: [{ id: normalizedTargetGroupId }],
                },
              },
            }),
          ),
        );
      }

      await (tx as any).keywordGroup.update({
        where: {
          id: normalizedTargetGroupId,
        },
        data: {
          ...(nextDescription !== undefined
            ? { description: nextDescription }
            : {}),
          ...(nextPrimaryKeyword !== undefined
            ? { primaryKeyword: nextPrimaryKeyword }
            : {}),
          ...(nextSeoClusterId !== undefined
            ? { seoClusterId: nextSeoClusterId }
            : {}),
          ...(nextParentGroupId !== undefined
            ? { parentGroupId: nextParentGroupId }
            : {}),
          isFavorite: nextIsFavorite,
        },
      });

      await (tx as any).keywordGroup.updateMany({
        where: {
          id: {
            in: normalizedSourceGroupIds,
          },
        },
        data: {
          trashedAt: new Date(),
        },
      });

      const updatedTargetGroup = await (tx as any).keywordGroup.findUnique({
        where: {
          id: normalizedTargetGroupId,
        },
        select: {
          id: true,
          name: true,
          description: true,
          primaryKeyword: true,
          seoClusterId: true,
          seoCluster: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          isFavorite: true,
          ...this.getKeywordGroupAssignmentSelect(),
          parentGroups: {
            select: {
              id: true,
              name: true,
              parentGroupId: true,
            },
          },
          keywords: {
            select: {
              id: true,
              keyword: true,
              template: true,
              volume: true,
              difficulty: true,
              searchIntent: true,
              page: {
                select: {
                  id: true,
                  pageType: true,
                  url: true,
                },
              },
            },
            orderBy: [{ volume: 'desc' }, { keyword: 'asc' }],
          },
        },
      });

      return {
        targetGroup: updatedTargetGroup
          ? {
              ...updatedTargetGroup,
              ...this.serializeKeywordGroupAssignmentFields(updatedTargetGroup),
            }
          : updatedTargetGroup,
        mergedGroupIds: normalizedSourceGroupIds,
      };
    });
  }

  private parseKeywordGroupDeduplicationResponse(
    response: unknown,
    normalizedGroups: Array<{
      id: string;
      name: string;
      description: string | null;
    }>,
  ) {
    const parsed = parseStructuredOpenAiResponse(
      response as {
        output_text?: string;
        output?: unknown[];
      },
      keywordGroupDeduplicationResponseSchema,
    );
    const allowedGroupIds = new Set(normalizedGroups.map((group) => group.id));

    return {
      merges: parsed.merges
        .map((merge) => {
          const keepGroupId = merge.keepGroupId.trim();
          const duplicateGroupIds = merge.duplicateGroupIds
            .map((groupId) => groupId.trim())
            .filter(
              (groupId) =>
                Boolean(groupId) &&
                allowedGroupIds.has(groupId) &&
                groupId !== keepGroupId,
            );

          return {
            keepGroupId,
            duplicateGroupIds: Array.from(new Set(duplicateGroupIds)),
            reason: merge.reason.trim(),
          };
        })
        .filter(
          (merge) =>
            Boolean(merge.keepGroupId) && merge.duplicateGroupIds.length > 0,
        ),
    };
  }

  private buildKeywordGroupDeduplicationPromptInput(
    input: string,
    keywordGroups: Array<{
      id: string;
      name: string;
      description: string | null;
    }>,
  ) {
    return input.replaceAll(
      '{{keywordGroups}}',
      JSON.stringify(keywordGroups, null, 2),
    );
  }

  private buildKeywordGroupTemplatePromptInput(
    input: string,
    groupName: string,
    groupDescription?: string | null,
  ) {
    return input
      .replaceAll('{{groupName}}', groupName)
      .replaceAll('{{groupDescription}}', groupDescription?.trim() ?? '')
      .replaceAll(
        '{{pageTypes}}',
        JSON.stringify(STRUCTURED_PAGE_TYPES, null, 2),
      );
  }

  private parseKeywordGroupTemplateResponse(response: unknown) {
    const parsed = parseStructuredOpenAiResponse(
      response as {
        output_text?: string;
        output?: unknown[];
      },
      keywordGroupTemplateResponseSchema,
    );

    return parsed;
  }

  getKeywordGroupAssignmentInclude() {
    return {
      keywordGroupAssignment: {
        include: {
          supabaseUser: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
      },
    };
  }

  getKeywordGroupInclude() {
    return {
      ...this.getKeywordGroupAssignmentInclude(),
      keywordGroupKeywordGroupParentGroupIdToKeywordGroup: {
        select: {
          id: true,
          name: true,
          parentGroupId: true,
        },
      },
      seoCluster: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      keywords: {
        include: {
          page: {
            select: {
              id: true,
              pageType: true,
              url: true,
            },
          },
        },
        orderBy: [{ volume: 'desc' }, { keyword: 'asc' }],
      },
    };
  }

  async listKeywordGroups(projectId?: string | null) {
    const normalizedProjectId = projectId?.trim();
    const groups = await (this.prisma as any).keywordGroup.findMany({
      where: {
        trashedAt: null,
        ...(normalizedProjectId ? { projectId: normalizedProjectId } : {}),
      },
      include: this.getKeywordGroupInclude(),
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return groups.map((group: any) => this.serializeKeywordGroupRecord(group));
  }

  serializeKeywordGroupRecord<T extends Record<string, any>>(group: T) {
    const parentGroup =
      group.keywordGroupKeywordGroupParentGroupIdToKeywordGroup ?? null;

    return {
      ...group,
      parentGroups: parentGroup
        ? [
            {
              id: parentGroup.id,
              name: parentGroup.name ?? null,
              parentGroupId: parentGroup.parentGroupId ?? null,
            },
          ]
        : [],
      ...this.serializeKeywordGroupAssignmentFields(group),
    };
  }

  async createKeywordGroup(input: {
    projectId?: string | null;
    name: string;
    description?: string | null;
    keywordIds?: string[];
    primaryKeyword?: string | null;
    parentGroupId?: string | null;
    parentGroupIds?: string[] | null;
    seoClusterId?: string | null;
  }) {
    const projectId = input.projectId?.trim() || null;
    const name = input.name.trim();
    const keywordIds = this.keywordService.normalizeIdList(input.keywordIds);

    if (!name) {
      throw new Error('Keyword group name is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const resolvedParentGroupId =
        await this.keywordService.resolveKeywordGroupParentId(
          input.parentGroupId,
          undefined,
          tx,
        );
      const resolvedParentGroupIds =
        await this.keywordService.resolveKeywordGroupParentIds(
          input.parentGroupIds ??
            (resolvedParentGroupId ? [resolvedParentGroupId] : undefined),
          undefined,
          tx,
        );
      const parentGroupIdsToConnect = resolvedParentGroupIds ?? [];
      const inheritedSeoClusterId =
        await this.keywordService.resolveInheritedSeoClusterIdFromParentIds(
          parentGroupIdsToConnect,
          tx,
        );
      const resolvedSeoClusterId =
        await this.keywordService.resolveKeywordGroupSeoClusterId(
          input.seoClusterId,
          projectId,
          tx,
        );
      const resolvedPrimaryKeyword =
        (await this.resolveGroupPrimaryKeyword(
          name,
          keywordIds,
          tx,
          input.primaryKeyword,
        )) || name;
      const group = await (tx as any).keywordGroup.create({
        data: {
          ...(projectId ? { projectId } : {}),
          name,
          primaryKeyword: resolvedPrimaryKeyword,
          description: input.description?.trim() || null,
          seoClusterId: resolvedSeoClusterId ?? inheritedSeoClusterId ?? null,
          parentGroupId:
            resolvedParentGroupIds?.[0] ?? resolvedParentGroupId ?? null,
        },
      });

      if (keywordIds.length) {
        await (tx as any).keyword.updateMany({
          where: {
            id: {
              in: keywordIds,
            },
            ...(projectId ? { projectId } : {}),
          },
          data: {
            keywordGroupId: group.id,
          },
        });
      }

      const createdGroup = await (tx as any).keywordGroup.findUnique({
        where: {
          id: group.id,
        },
        include: this.getKeywordGroupInclude(),
      });

      return createdGroup
        ? this.serializeKeywordGroupRecord(createdGroup)
        : createdGroup;
    });
  }

  async resolveGroupPrimaryKeyword(
    groupName: string,
    keywordIds?: string[],
    tx?: KeywordWriteClient,
    preferredPrimaryKeyword?: string | null,
  ) {
    const client = tx ?? this.prisma;

    if (preferredPrimaryKeyword?.trim()) {
      return preferredPrimaryKeyword.trim();
    }

    if (keywordIds?.length) {
      const firstKeyword = await (client as any).keyword.findFirst({
        where: {
          id: {
            in: keywordIds,
          },
        },
        orderBy: [{ volume: 'desc' }, { keyword: 'asc' }],
        select: {
          keyword: true,
        },
      });

      if (firstKeyword?.keyword?.trim()) {
        return firstKeyword.keyword.trim();
      }
    }

    return groupName.trim() || null;
  }
}
