import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { OpenAiPlatformService } from '../../openai-platform/openai-platform.service';
import { SettingsPromptConfigsService } from '../../admin/settings/settings-prompt-configs.service';
import { keywordGroupingResponseSchema } from '../../admin/settings/settings.schemas';
import { KeywordService } from '../services/keyword.service';
import { KEYWORD_GROUPING_OPENAI_JSON_SCHEMA } from '../../admin/settings/settings-openai-schemas.constants';
import { parseStructuredOpenAiResponse } from '../../../common/utils/openai-response';
import { EMPTY_KEYWORD_GROUPING_RESULT } from '../keywords-response.constants';
import { KeywordGroupService } from './keyword-group.service';

@Injectable()
export class KeywordGroupingService {
  constructor(
    @Inject(forwardRef(() => KeywordService))
    private readonly keywordService: KeywordService,
    @Inject(forwardRef(() => KeywordGroupService))
    private readonly keywordGroupService: KeywordGroupService,
    private readonly openAiPlatformService: OpenAiPlatformService,
    private readonly promptConfigsService: SettingsPromptConfigsService,
  ) {}

  async handleFormGroupsWithAi() {
    const ungroupedKeywords = await this.keywordService.listKeywords({
      includeGrouped: false,
    });

    if (!ungroupedKeywords.length) {
      return EMPTY_KEYWORD_GROUPING_RESULT;
    }

    if (!this.openAiPlatformService.isConfigured()) {
      throw new Error('OpenAI is not configured.');
    }

    const [groupingPrompt, existingGroups] = await Promise.all([
      this.promptConfigsService.getKeywordGroupingPrompt(),
      this.keywordGroupService.listKeywordGroups(),
    ]);

    const promptInput = this.buildKeywordGroupingPromptInput(
      groupingPrompt.input,
      ungroupedKeywords,
      existingGroups,
    );

    const response = await this.openAiPlatformService.createResponse({
      model: groupingPrompt.model,
      promptType: 'KEYWORD_GROUPING',
      instructions: groupingPrompt.instructions,
      input: promptInput,
      max_output_tokens: groupingPrompt.maxOutputTokens,
      text: {
        format: {
          type: 'json_schema',
          name: 'keyword_grouping_response',
          strict: true,
          schema: KEYWORD_GROUPING_OPENAI_JSON_SCHEMA,
        },
      },
    });

    const suggestedGroups = this.parseKeywordGroupingResponse(response);

    console.log('suggestedGroups', suggestedGroups);

    return this.applyKeywordGroupingSuggestions(
      suggestedGroups,
      existingGroups,
      ungroupedKeywords,
    );
  }

  private buildKeywordGroupingPromptInput(
    input: string,
    keywords: Array<{
      id: string;
      keyword: string;
      volume?: number | null;
      difficulty?: number | null;
      searchIntent?: string | null;
      lengthType?: string | null;
    }>,
    existingGroups: Array<{
      name: string;
      primaryKeyword?: string | null;
      description?: string | null;
      keywords?: Array<{ id: string }>;
    }>,
  ) {
    // const keywordsPayload = keywords.map((keyword) => ({
    //   id: keyword.id,
    //   keyword: keyword.keyword,
    //   volume: keyword.volume ?? null,
    //   difficulty: keyword.difficulty ?? null,
    //   searchIntent: keyword.searchIntent ?? null,
    //   lengthType: keyword.lengthType ?? null,
    // }));
    const keywordsPayload = keywords.map((keyword) => ({
      id: keyword.id,
      keyword: keyword.keyword,
      // searchIntent: keyword.searchIntent ?? null,
    }));
    const existingGroupsPayload = existingGroups.map((group) => ({
      name: group.name,
      primaryKeyword: group.primaryKeyword ?? null,
      description: group.description ?? null,
      keywords: (group.keywords ?? []).map((keyword) => keyword.id),
    }));

    return input
      .replaceAll('{{keywords}}', JSON.stringify(keywordsPayload, null, 2))
      .replaceAll(
        '{{existingKeywordGroups}}',
        JSON.stringify(existingGroupsPayload, null, 2),
      )
      .replaceAll('{{keywordCount}}', String(keywordsPayload.length));
  }

  private parseKeywordGroupingResponse(response: unknown) {
    const parsed = parseStructuredOpenAiResponse(
      response as {
        output_text?: string;
        output?: unknown[];
      },
      keywordGroupingResponseSchema,
    );

    return parsed.groups;
  }

  private async applyKeywordGroupingSuggestions(
    suggestedGroups: Array<{
      name: string;
      description: string | null;
      keywords: string[];
    }>,
    existingGroups: Array<{
      id: string;
      name: string;
      primaryKeyword?: string | null;
      description?: string | null;
      keywords?: Array<{ id: string; keyword: string }>;
    }>,
    ungroupedKeywords: Array<{
      id: string;
      keyword: string;
    }>,
  ) {
    const existingGroupsMap = new Map(
      existingGroups.map((group) => [
        this.normalizeKeywordGroupingValue(group.name),
        group,
      ]),
    );
    const existingPrimaryKeywordMap = new Map(
      existingGroups
        .filter((group) => group.primaryKeyword?.trim())
        .map((group) => [
          this.normalizeKeywordGroupingValue(group.primaryKeyword ?? ''),
          group,
        ]),
    );
    const keywordsById = new Map(
      ungroupedKeywords.map((keyword) => [keyword.id, keyword] as const),
    );
    const keywordsByNormalizedValue = new Map(
      ungroupedKeywords.map(
        (keyword) =>
          [
            this.normalizeKeywordGroupingValue(keyword.keyword),
            keyword,
          ] as const,
      ),
    );
    const assignedKeywordIds = new Set<string>();
    const touchedGroups: unknown[] = [];
    let createdGroupsCount = 0;
    let updatedGroupsCount = 0;

    for (const suggestedGroup of suggestedGroups) {
      const keywordIds = Array.from(
        new Set(
          suggestedGroup.keywords
            .map((keyword) => {
              const normalizedKeyword = keyword.trim();

              return (
                keywordsById.get(normalizedKeyword) ??
                keywordsByNormalizedValue.get(
                  this.normalizeKeywordGroupingValue(normalizedKeyword),
                )
              );
            })
            .filter((keyword): keyword is { id: string; keyword: string } =>
              Boolean(keyword),
            )
            .map((keyword) => keyword.id)
            .filter((keywordId) => !assignedKeywordIds.has(keywordId)),
        ),
      );

      if (!keywordIds.length) {
        continue;
      }

      keywordIds.forEach((keywordId) => assignedKeywordIds.add(keywordId));

      const normalizedName = this.normalizeKeywordGroupingValue(
        suggestedGroup.name,
      );
      const existingGroup =
        existingGroupsMap.get(normalizedName) ??
        existingPrimaryKeywordMap.get(normalizedName) ??
        existingGroups.find((group) =>
          this.normalizeKeywordGroupingValue(group.name).includes(
            normalizedName,
          ),
        ) ??
        existingGroups.find((group) =>
          group.primaryKeyword
            ? this.normalizeKeywordGroupingValue(group.primaryKeyword).includes(
                normalizedName,
              )
            : false,
        );

      if (existingGroup) {
        const currentKeywordIds = Array.from(
          new Set([
            ...(existingGroup.keywords ?? []).map((keyword) => keyword.id),
            ...keywordIds,
          ]),
        );
        const updatedGroup = await this.keywordService.updateKeywordGroup(
          existingGroup.id,
          {
            name: suggestedGroup.name,
            description: suggestedGroup.description,
            keywordIds: currentKeywordIds,
          },
        );

        touchedGroups.push(updatedGroup);
        updatedGroupsCount += 1;
        continue;
      }

      const createdGroup = await this.keywordGroupService.createKeywordGroup({
        name: suggestedGroup.name,
        description: suggestedGroup.description,
        keywordIds,
      });

      touchedGroups.push(createdGroup);
      createdGroupsCount += 1;
    }

    return {
      totalKeywords: ungroupedKeywords.length,
      createdGroups: createdGroupsCount,
      updatedGroups: updatedGroupsCount,
      groups: touchedGroups,
    };
  }

  private normalizeKeywordGroupingValue(value: string) {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
