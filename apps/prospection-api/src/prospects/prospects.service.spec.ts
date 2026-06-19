import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProspectsService } from './prospects.service';

describe('ProspectsService', () => {
  let service: ProspectsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProspectsService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ProspectsService>(ProspectsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
