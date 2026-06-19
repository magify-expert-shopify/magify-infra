import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ShopifyService } from '../shopify/shopify.service';
import { SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES } from './authors.constants';
import { toAuthorSlug } from '../../common/utils/slug.utils';
import { AuthorSource } from 'src/common/types/prisma-enums';
import { ShopifyAuthorMetaobject } from 'src/common/types';
import { CreateMagifyAuthorDto, UpdateMagifyAuthorDto } from './dto';

@Injectable()
export class AuthorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shopifyService: ShopifyService,
  ) {}

  private toNullableTrimmed(value?: string | null) {
    const trimmedValue = value?.trim();
    return trimmedValue ? trimmedValue : null;
  }

  private buildAuthorName(input: {
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    displayName?: string | null;
  }) {
    const displayName = this.toNullableTrimmed(input.displayName);
    if (displayName) {
      return displayName;
    }

    const joinedName = [input.firstName, input.lastName]
      .map((value) => this.toNullableTrimmed(value))
      .filter((value): value is string => !!value)
      .join(' ')
      .trim();

    if (joinedName) {
      return joinedName;
    }

    return this.toNullableTrimmed(input.name) ?? 'Auteur Magify';
  }

  private buildSlug(value: string) {
    return toAuthorSlug(value);
  }

  private toShopifyMetaobjectStringValue(value?: string | null) {
    return value ?? '';
  }

  private getMetaobjectFieldValue(
    metaobject: ShopifyAuthorMetaobject,
    aliases: readonly string[],
  ) {
    for (const alias of aliases) {
      const rawValue =
        metaobject.fields.find((field) => field.key === alias)?.value?.trim() ||
        null;
      const value = this.normalizeMetaobjectFieldValue(rawValue);

      if (value) {
        return value;
      }
    }

    return null;
  }

  private normalizeMetaobjectFieldValue(value: string | null) {
    if (!value) {
      return null;
    }

    if (value.startsWith('{')) {
      try {
        const parsedValue = JSON.parse(value) as {
          url?: unknown;
          text?: unknown;
        };

        if (typeof parsedValue.url === 'string' && parsedValue.url.trim()) {
          return parsedValue.url.trim();
        }

        if (typeof parsedValue.text === 'string' && parsedValue.text.trim()) {
          return parsedValue.text.trim();
        }
      } catch {
        return value;
      }
    }

    return value;
  }

  private getMetaobjectFieldReference(
    metaobject: ShopifyAuthorMetaobject,
    aliases: readonly string[],
  ) {
    for (const alias of aliases) {
      const reference =
        metaobject.fields.find((field) => field.key === alias)?.reference ??
        null;

      if (reference) {
        return reference;
      }
    }

    return null;
  }

  private buildShopifyAuthorInput(
    dto: CreateMagifyAuthorDto | UpdateMagifyAuthorDto,
  ) {
    const name = this.buildAuthorName(dto);
    const explicitSlug = this.toNullableTrimmed(
      (dto as { slug?: string | null }).slug,
    );
    const handle =
      (explicitSlug ? this.buildSlug(explicitSlug) : null) ||
      this.buildSlug(name) ||
      `author-${Date.now()}`;

    return {
      name,
      handle,
      firstName: this.toNullableTrimmed(dto.firstName),
      lastName: this.toNullableTrimmed(dto.lastName),
      displayName: this.toNullableTrimmed(dto.displayName),
      jobTitle: this.toNullableTrimmed(
        (dto as { jobTitle?: string | null }).jobTitle,
      ),
      bio: this.toNullableTrimmed(dto.bio),
      avatarUrl: this.toNullableTrimmed(dto.avatarUrl),
      shopifyAvatarId: this.toNullableTrimmed(
        (dto as { shopifyAvatarId?: string | null }).shopifyAvatarId,
      ),
      email: this.toNullableTrimmed(dto.email),
      phoneNumber: this.toNullableTrimmed(dto.phoneNumber),
      profileUrl: this.toNullableTrimmed(
        (dto as { profileUrl?: string | null }).profileUrl,
      ),
      shopifyPageId: this.toNullableTrimmed(
        (dto as { shopifyPageId?: string | null }).shopifyPageId,
      ),
      linkedinProfileUrl: this.toNullableTrimmed(
        (dto as { linkedinProfileUrl?: string | null }).linkedinProfileUrl,
      ),
      slug: explicitSlug ? this.buildSlug(explicitSlug) : handle,
    };
  }

  private async findMatchingLocalMagifyAuthor(
    metaobject: ShopifyAuthorMetaobject,
  ) {
    const email = this.getMetaobjectFieldValue(
      metaobject,
      SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES.email,
    );
    const displayName =
      this.getMetaobjectFieldValue(
        metaobject,
        SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES.displayName,
      ) || metaobject.handle;
    const firstName = this.getMetaobjectFieldValue(
      metaobject,
      SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES.firstName,
    );
    const lastName = this.getMetaobjectFieldValue(
      metaobject,
      SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES.lastName,
    );

    return (this.prisma as any).author.findFirst({
      where: {
        trashedAt: null,
        source: AuthorSource.MAGIFY,
        OR: [
          ...(email ? [{ email }] : []),
          { displayName },
          { name: displayName },
          ...(firstName || lastName
            ? [
                {
                  firstName: firstName ?? undefined,
                  lastName: lastName ?? undefined,
                },
              ]
            : []),
        ],
      },
    });
  }

  private async syncShopifyMagifyAuthor(metaobject: ShopifyAuthorMetaobject) {
    const displayName =
      this.getMetaobjectFieldValue(
        metaobject,
        SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES.displayName,
      ) || metaobject.handle;
    const firstName = this.getMetaobjectFieldValue(
      metaobject,
      SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES.firstName,
    );
    const lastName = this.getMetaobjectFieldValue(
      metaobject,
      SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES.lastName,
    );
    const bio = this.getMetaobjectFieldValue(
      metaobject,
      SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES.bio,
    );
    const jobTitle = this.getMetaobjectFieldValue(
      metaobject,
      SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES.jobTitle,
    );
    const avatarReference = this.getMetaobjectFieldReference(
      metaobject,
      SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES.shopifyAvatarId,
    );
    const avatarUrl = avatarReference?.image?.url?.trim() || null;
    const shopifyAvatarId = avatarReference?.id?.trim() || null;
    const email = this.getMetaobjectFieldValue(
      metaobject,
      SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES.email,
    );
    const phoneNumber = this.getMetaobjectFieldValue(
      metaobject,
      SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES.phoneNumber,
    );
    const shopifyPageId = this.getMetaobjectFieldValue(
      metaobject,
      SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES.shopifyPageId,
    );
    const linkedinProfileUrl = this.getMetaobjectFieldValue(
      metaobject,
      SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES.linkedinProfileUrl,
    );
    const slug =
      this.getMetaobjectFieldValue(
        metaobject,
        SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES.slug,
      ) || metaobject.handle;

    const existingAuthor =
      (await (this.prisma as any).author.findFirst({
        where: {
          shopifyMetaobjectId: metaobject.id,
        },
      })) ?? (await this.findMatchingLocalMagifyAuthor(metaobject));

    const nextName = this.buildAuthorName({
      name: displayName,
      firstName,
      lastName,
      displayName,
    });

    if (existingAuthor) {
      return (this.prisma as any).author.update({
        where: {
          id: existingAuthor.id,
        },
        data: {
          name: nextName,
          firstName,
          lastName,
          displayName,
          jobTitle,
          bio,
          avatarUrl,
          shopifyAvatarId,
          email,
          phoneNumber,
          shopifyPageId,
          linkedinProfileUrl,
          slug,
          shopifyMetaobjectId: metaobject.id,
          source: AuthorSource.MAGIFY,
          trashedAt: null,
        },
      });
    }

    return (this.prisma as any).author.create({
      data: {
        name: nextName,
        firstName,
        lastName,
        displayName,
        jobTitle,
        bio,
        avatarUrl,
        shopifyAvatarId,
        email,
        phoneNumber,
        shopifyPageId,
        linkedinProfileUrl,
        slug,
        shopifyMetaobjectId: metaobject.id,
        source: AuthorSource.MAGIFY,
      },
    });
  }

  private async syncMagifyAuthorsFromShopify(projectId: string) {
    const metaobjects =
      await this.shopifyService.getAuthorMetaobjectsForSync(projectId);
    const syncedIds = new Set<string>();

    for (const metaobject of metaobjects) {
      const author = await this.syncShopifyMagifyAuthor(metaobject);
      syncedIds.add(author.id);
    }

    await (this.prisma as any).author.updateMany({
      where: {
        source: AuthorSource.MAGIFY,
        shopifyMetaobjectId: {
          not: null,
        },
        id: {
          notIn: Array.from(syncedIds),
        },
      },
      data: {
        trashedAt: new Date(),
      },
    });
  }

  async findOrCreate(input: {
    name: string;
    profileUrl?: string | null;
    avatarUrl?: string | null;
    source?: AuthorSource;
  }) {
    const trimmedName = input.name.trim();
    const normalizedProfileUrl = input.profileUrl?.trim() || null;
    const normalizedAvatarUrl = input.avatarUrl?.trim() || null;
    const source = input.source ?? AuthorSource.COMPETITOR;

    const existingAuthor = await (this.prisma as any).author.findFirst({
      where: {
        name: trimmedName,
        profileUrl: normalizedProfileUrl,
      },
    });

    if (existingAuthor) {
      const shouldUpdate =
        !!existingAuthor.trashedAt ||
        (!existingAuthor.avatarUrl && !!normalizedAvatarUrl);

      if (shouldUpdate) {
        return (this.prisma as any).author.update({
          where: { id: existingAuthor.id },
          data: {
            trashedAt: null,
            avatarUrl: existingAuthor.avatarUrl ?? normalizedAvatarUrl,
            source: existingAuthor.source ?? source,
          },
        });
      }

      return existingAuthor;
    }

    return (this.prisma as any).author.create({
      data: {
        name: trimmedName,
        profileUrl: normalizedProfileUrl,
        avatarUrl: normalizedAvatarUrl,
        source,
      },
    });
  }

  async search(query: string) {
    return (this.prisma as any).author.findMany({
      where: {
        trashedAt: null,
        OR: [
          { name: { contains: query } },
          { slug: { contains: query } },
          { bio: { contains: query } },
          { profileUrl: { contains: query } },
          { linkedinProfileUrl: { contains: query } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });
  }

  async findAll() {
    return (this.prisma as any).author.findMany({
      where: { trashedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMagifyAuthors(projectId: string) {
    await this.syncMagifyAuthorsFromShopify(projectId);

    return (this.prisma as any).author.findMany({
      where: {
        trashedAt: null,
        source: AuthorSource.MAGIFY,
      },
      orderBy: [{ displayName: 'asc' }, { name: 'asc' }],
    });
  }

  async findCompetitorAuthors() {
    return (this.prisma as any).author.findMany({
      where: {
        trashedAt: null,
        source: AuthorSource.COMPETITOR,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createMagifyAuthor(projectId: string, dto: CreateMagifyAuthorDto) {
    const shopifyAuthor = this.buildShopifyAuthorInput(dto);
    const metaobject = await this.shopifyService.createAuthorMetaobject(
      projectId,
      {
        values: {
          handle: shopifyAuthor.handle,
          displayName: shopifyAuthor.displayName ?? shopifyAuthor.name,
          firstName: shopifyAuthor.firstName,
          lastName: shopifyAuthor.lastName,
          jobTitle: shopifyAuthor.jobTitle,
          bio: shopifyAuthor.bio,
          avatarUrl: shopifyAuthor.avatarUrl,
          shopifyAvatarId: shopifyAuthor.shopifyAvatarId,
          email: shopifyAuthor.email,
          phoneNumber: shopifyAuthor.phoneNumber,
          shopifyPageId: shopifyAuthor.shopifyPageId,
          linkedinProfileUrl: shopifyAuthor.linkedinProfileUrl,
          slug: shopifyAuthor.slug,
        },
      },
    );

    return this.syncShopifyMagifyAuthor(metaobject);
  }

  async updateMagifyAuthor(
    projectId: string,
    id: string,
    dto: UpdateMagifyAuthorDto,
  ) {
    const author = await this.findOne(projectId, id);

    if (author.source !== AuthorSource.MAGIFY) {
      throw new NotFoundException(`Magify author ${id} not found`);
    }
    if (!author.shopifyMetaobjectId) {
      throw new NotFoundException(
        `Shopify metaobject for Magify author ${id} not found`,
      );
    }

    const mergedInput = this.buildShopifyAuthorInput({
      firstName:
        dto.firstName !== undefined ? dto.firstName : (author as any).firstName,
      lastName:
        dto.lastName !== undefined ? dto.lastName : (author as any).lastName,
      displayName:
        dto.displayName !== undefined
          ? dto.displayName
          : (author as any).displayName,
      jobTitle:
        (dto as { jobTitle?: string | null }).jobTitle !== undefined
          ? (dto as { jobTitle?: string | null }).jobTitle
          : (author as any).jobTitle,
      bio: dto.bio !== undefined ? dto.bio : (author as any).bio,
      avatarUrl:
        dto.avatarUrl !== undefined ? dto.avatarUrl : (author as any).avatarUrl,
      shopifyAvatarId:
        (dto as { shopifyAvatarId?: string | null }).shopifyAvatarId !==
        undefined
          ? (dto as { shopifyAvatarId?: string | null }).shopifyAvatarId
          : (author as any).shopifyAvatarId,
      email: dto.email !== undefined ? dto.email : (author as any).email,
      phoneNumber:
        dto.phoneNumber !== undefined
          ? dto.phoneNumber
          : (author as any).phoneNumber,
      profileUrl:
        (dto as { profileUrl?: string | null }).profileUrl !== undefined
          ? (dto as { profileUrl?: string | null }).profileUrl
          : (author as any).profileUrl,
      shopifyPageId:
        (dto as { shopifyPageId?: string | null }).shopifyPageId !== undefined
          ? (dto as { shopifyPageId?: string | null }).shopifyPageId
          : (author as any).shopifyPageId,
      linkedinProfileUrl:
        (dto as { linkedinProfileUrl?: string | null }).linkedinProfileUrl !==
        undefined
          ? (dto as { linkedinProfileUrl?: string | null }).linkedinProfileUrl
          : (author as any).linkedinProfileUrl,
      slug:
        (dto as { slug?: string | null }).slug !== undefined
          ? (dto as { slug?: string | null }).slug
          : (author as any).slug,
    });

    const metaobject = await this.shopifyService.updateAuthorMetaobject(
      projectId,
      {
        id: author.shopifyMetaobjectId,
        values: {
          handle: mergedInput.handle,
          displayName: this.toShopifyMetaobjectStringValue(
            mergedInput.displayName ?? mergedInput.name,
          ),
          firstName: this.toShopifyMetaobjectStringValue(mergedInput.firstName),
          lastName: this.toShopifyMetaobjectStringValue(mergedInput.lastName),
          jobTitle: this.toShopifyMetaobjectStringValue(mergedInput.jobTitle),
          bio: this.toShopifyMetaobjectStringValue(mergedInput.bio),
          shopifyAvatarId: this.toShopifyMetaobjectStringValue(
            mergedInput.shopifyAvatarId,
          ),
          email: this.toShopifyMetaobjectStringValue(mergedInput.email),
          phoneNumber: this.toShopifyMetaobjectStringValue(
            mergedInput.phoneNumber,
          ),
          shopifyPageId: this.toShopifyMetaobjectStringValue(
            mergedInput.shopifyPageId,
          ),
          linkedinProfileUrl: this.toShopifyMetaobjectStringValue(
            mergedInput.linkedinProfileUrl,
          ),
          slug: this.toShopifyMetaobjectStringValue(mergedInput.slug),
        },
      },
    );

    return this.syncShopifyMagifyAuthor(metaobject);
  }

  async removeMagifyAuthor(projectId: string, id: string) {
    const author = await this.findOne(projectId, id);

    if (author.source !== AuthorSource.MAGIFY) {
      throw new NotFoundException(`Magify author ${id} not found`);
    }

    if ((author as any).shopifyMetaobjectId) {
      await this.shopifyService.deleteAuthorMetaobject(
        projectId,
        (author as any).shopifyMetaobjectId,
      );
    }

    return (this.prisma as any).author.update({
      where: { id },
      data: {
        trashedAt: new Date(),
        shopifyMetaobjectId: null,
      },
    });
  }

  async findOne(projectId: string, id: string) {
    const author = await (this.prisma as any).author.findFirst({
      where: { id, trashedAt: null },
    });

    if (!author) {
      throw new NotFoundException(`Author ${id} not found`);
    }

    return author;
  }

  async findArticles(projectId: string, id: string) {
    await this.findOne(projectId, id);

    return (this.prisma as any).blogArticle.findMany({
      where: { authorId: id, trashedAt: null },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findBlogs(projectId: string, id: string) {
    await this.findOne(projectId, id);

    const author = await (this.prisma as any).author.findUnique({
      where: { id },
      include: {
        blogs: {
          where: { trashedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return author?.blogs ?? [];
  }
}
