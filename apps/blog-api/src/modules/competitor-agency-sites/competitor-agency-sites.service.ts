import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAgencySiteDto } from './dto/create-agency-site.dto';
import { UpdateAgencySiteDto } from './dto/update-agency-site.dto';
import { deriveNameFromUrl, normalizeUrl } from '../../common/utils/url.util';

@Injectable()
export class CompetitorAgencySitesService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: string) {
    return (this.prisma as any).competitorAgencySite.findMany({
      where: {
        trashedAt: null,
        OR: [{ name: { contains: query } }, { baseUrl: { contains: query } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });
  }

  async findAll() {
    return (this.prisma as any).competitorAgencySite.findMany({
      where: { trashedAt: null },
      include: {
        _count: {
          select: {
            blogs: {
              where: { trashedAt: null },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllIds() {
    const sites = await (this.prisma as any).competitorAgencySite.findMany({
      where: { trashedAt: null },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    return sites.map((site: { id: string }) => site.id);
  }

  async findByBaseUrl(baseUrl: string) {
    return (this.prisma as any).competitorAgencySite.findFirst({
      where: {
        baseUrl,
        trashedAt: null,
      },
    });
  }

  async findOne(id: string) {
    const site = await (this.prisma as any).competitorAgencySite.findFirst({
      where: { id, trashedAt: null },
    });

    if (!site) {
      throw new NotFoundException(`Agency site ${id} not found`);
    }

    return site;
  }

  async create(dto: CreateAgencySiteDto) {
    const normalizedBaseUrl = normalizeUrl(dto.baseUrl);
    const existingSite = await (
      this.prisma as any
    ).competitorAgencySite.findUnique({
      where: {
        baseUrl: normalizedBaseUrl,
      },
    });

    const site = existingSite?.trashedAt
      ? await (this.prisma as any).competitorAgencySite.update({
          where: {
            id: existingSite.id,
          },
          data: {
            name: existingSite.name || deriveNameFromUrl(normalizedBaseUrl),
            trashedAt: null,
          },
        })
      : existingSite
        ? existingSite
        : await (this.prisma as any).competitorAgencySite.create({
            data: {
              baseUrl: normalizedBaseUrl,
              name: deriveNameFromUrl(normalizedBaseUrl),
            },
          });

    return {
      site,
      shouldEnqueueDiscovery: !existingSite || existingSite.trashedAt,
    };
  }

  async update(id: string, dto: UpdateAgencySiteDto) {
    await this.findOne(id);

    return (this.prisma as any).competitorAgencySite.update({
      where: { id },
      data: {
        ...(dto.baseUrl ? { baseUrl: normalizeUrl(dto.baseUrl) } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
      },
    });
  }

  async markAsScanned(id: string) {
    await this.findOne(id);

    return (this.prisma as any).competitorAgencySite.update({
      where: { id },
      data: { lastScannedAt: new Date() },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return (this.prisma as any).competitorAgencySite.update({
      where: { id },
      data: { trashedAt: new Date() },
    });
  }
}
