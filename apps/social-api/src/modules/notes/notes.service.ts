import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateNoteDto } from './dto/create-note.dto';

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  create(createNoteDto: CreateNoteDto) {
    return this.prisma.note.create({
      data: {
        title: createNoteDto.title,
        status: createNoteDto.status,
      },
    });
  }
}
