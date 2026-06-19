import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeUrlWithoutProtocol } from '../../common/utils/normalize.utils';
import type { SupabaseAuthenticatedUser } from '../auth/supabase-auth/supabase-auth.types';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(user: SupabaseAuthenticatedUser) {
    await this.ensureSupabaseUser(user);

    const projects = await (this.prisma as any).project.findMany({
      where: {
        projectMembers: {
          some: {
            supabaseUserId: user.id,
          },
        },
      },
      include: {
        projectMembers: {
          where: {
            supabaseUserId: user.id,
          },
          select: {
            role: true,
          },
        },
        _count: {
          select: {
            projectMembers: true,
            blogArticles: true,
          },
        },
      },
      orderBy: [{ name: 'asc' }],
    });

    return projects.map((project: any) => this.serializeProjectRecord(project));
  }

  async listMembersForUser(user: SupabaseAuthenticatedUser, projectId: string) {
    const normalizedProjectId = projectId?.trim();

    if (!normalizedProjectId) {
      throw new BadRequestException('Le projet est requis.');
    }

    await this.ensureSupabaseUser(user);

    const membership = await (this.prisma as any).projectMember.findUnique({
      where: {
        projectId_supabaseUserId: {
          projectId: normalizedProjectId,
          supabaseUserId: user.id,
        },
      },
      select: {
        role: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('Projet introuvable.');
    }

    const members = await (this.prisma as any).projectMember.findMany({
      where: {
        projectId: normalizedProjectId,
      },
      select: {
        role: true,
        supabaseUser: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
      orderBy: [
        {
          supabaseUser: {
            displayName: 'asc',
          },
        },
        {
          supabaseUser: {
            email: 'asc',
          },
        },
      ],
    });

    return members.map((member: any) => ({
      id: member.supabaseUser.id,
      email: member.supabaseUser.email,
      displayName: member.supabaseUser.displayName,
      role: member.role,
    }));
  }

  async createForUser(
    user: SupabaseAuthenticatedUser,
    input: {
      name: string;
      description?: string | null;
      shopifyStoreDomain?: string | null;
    },
  ) {
    const name = input.name?.trim();

    if (!name) {
      throw new BadRequestException('Le nom du projet est requis.');
    }

    const shopifyStoreDomain = normalizeUrlWithoutProtocol(
      input.shopifyStoreDomain ?? '',
    );

    if (!shopifyStoreDomain) {
      throw new BadRequestException('Le domaine Shopify est requis.');
    }

    await this.ensureSupabaseUser(user);

    const slug = await this.buildUniqueSlug(name);

    const project = await (this.prisma as any).project.create({
      data: {
        id: randomUUID(),
        name,
        slug,
        description: input.description?.trim() || null,
        shopifyStoreDomain: shopifyStoreDomain,
        projectMembers: {
          create: {
            id: randomUUID(),
            supabaseUserId: user.id,
            role: 'admin',
          },
        },
      },
      include: {
        projectMembers: {
          where: {
            supabaseUserId: user.id,
          },
          select: {
            role: true,
          },
        },
        _count: {
          select: {
            projectMembers: true,
            blogArticles: true,
          },
        },
      },
    });

    return this.serializeProjectRecord(project);
  }

  async updateForUser(
    user: SupabaseAuthenticatedUser,
    projectId: string,
    input: {
      name?: string | null;
      description?: string | null;
      shopifyStoreDomain?: string | null;
    },
  ) {
    const normalizedProjectId = projectId?.trim();

    if (!normalizedProjectId) {
      throw new BadRequestException('Le projet est requis.');
    }

    await this.ensureSupabaseUser(user);

    const membership = await (this.prisma as any).projectMember.findUnique({
      where: {
        projectId_supabaseUserId: {
          projectId: normalizedProjectId,
          supabaseUserId: user.id,
        },
      },
      select: {
        role: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('Projet introuvable.');
    }

    const updateData: Record<string, unknown> = {};

    if (typeof input.name === 'string') {
      const name = input.name.trim();

      if (!name) {
        throw new BadRequestException('Le nom du projet est requis.');
      }

      updateData.name = name;
      updateData.slug = await this.buildUniqueSlug(name, normalizedProjectId);
    }

    if (typeof input.description === 'string' || input.description === null) {
      updateData.description = input.description?.trim() || null;
    }

    if (typeof input.shopifyStoreDomain !== 'undefined') {
      const shopifyStoreDomain = normalizeUrlWithoutProtocol(
        input.shopifyStoreDomain ?? '',
      );
      updateData.shopifyStoreDomain = shopifyStoreDomain || null;
    }

    const project = await (this.prisma as any).project.update({
      where: {
        id: normalizedProjectId,
      },
      data: updateData,
      include: {
        projectMembers: {
          where: {
            supabaseUserId: user.id,
          },
          select: {
            role: true,
          },
        },
        _count: {
          select: {
            projectMembers: true,
            blogArticles: true,
          },
        },
      },
    });

    return this.serializeProjectRecord(project);
  }

  async joinForUser(user: SupabaseAuthenticatedUser, input: { slug: string }) {
    const slug = input.slug?.trim().toLowerCase();

    if (!slug) {
      throw new BadRequestException('Le code projet est requis.');
    }

    await this.ensureSupabaseUser(user);

    const project = await (this.prisma as any).project.findFirst({
      where: { slug },
      include: {
        projectMembers: {
          where: {
            supabaseUserId: user.id,
          },
          select: {
            role: true,
          },
        },
        _count: {
          select: {
            projectMembers: true,
            blogArticles: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Aucun projet ne correspond à ce code.');
    }

    await (this.prisma as any).projectMember.upsert({
      where: {
        projectId_supabaseUserId: {
          projectId: project.id,
          supabaseUserId: user.id,
        },
      },
      create: {
        id: randomUUID(),
        projectId: project.id,
        supabaseUserId: user.id,
        role: 'member',
      },
      update: {},
    });

    return this.serializeProjectRecord(project);
  }

  async deleteForUser(user: SupabaseAuthenticatedUser, projectId: string) {
    const normalizedProjectId = projectId?.trim();

    if (!normalizedProjectId) {
      throw new BadRequestException('Le projet est requis.');
    }

    const membership = await (this.prisma as any).projectMember.findUnique({
      where: {
        projectId_supabaseUserId: {
          projectId: normalizedProjectId,
          supabaseUserId: user.id,
        },
      },
      select: {
        role: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('Projet introuvable.');
    }

    if (membership.role !== 'admin') {
      throw new ForbiddenException('Seul l’admin du projet peut le supprimer.');
    }

    await (this.prisma as any).project.delete({
      where: {
        id: normalizedProjectId,
      },
    });

    return { deleted: true };
  }

  private async ensureSupabaseUser(user: SupabaseAuthenticatedUser) {
    return (this.prisma as any).supabaseUser.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email?.trim() || null,
        displayName: this.getDisplayName(user),
        phone: user.phone?.trim() || null,
      },
      update: {
        email: user.email?.trim() || null,
        displayName: this.getDisplayName(user),
        phone: user.phone?.trim() || null,
      },
    });
  }

  private getDisplayName(user: SupabaseAuthenticatedUser) {
    const userMetadata =
      user.userMetadata && typeof user.userMetadata === 'object'
        ? (user.userMetadata as Record<string, unknown>)
        : {};

    const candidates = [
      userMetadata.full_name,
      userMetadata.name,
      userMetadata.username,
      userMetadata.display_name,
      user.email,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return null;
  }

  private async buildUniqueSlug(
    name: string,
    excludeProjectId?: string | null,
  ) {
    const baseSlug = this.slugify(name) || 'project';
    let slug = baseSlug;
    let counter = 2;

    while (
      await (this.prisma as any).project.findFirst({
        where: {
          slug,
          ...(excludeProjectId
            ? {
                NOT: {
                  id: excludeProjectId,
                },
              }
            : {}),
        },
        select: { id: true },
      })
    ) {
      slug = `${baseSlug}-${counter}`;
      counter += 1;
    }

    return slug;
  }

  private slugify(value: string) {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  private serializeProjectRecord(project: any) {
    const currentUserRole = project.projectMembers?.[0]?.role ?? null;

    return {
      ...project,
      shopifyStoreDomain: project.shopifyStoreDomain ?? null,
      currentUserRole,
      canDelete: currentUserRole === 'admin',
      projectMembers: undefined,
    };
  }
}
