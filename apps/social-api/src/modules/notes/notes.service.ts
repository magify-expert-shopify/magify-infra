import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateNoteDto } from './dto/create-note.dto';

@Injectable()
export class NotesService implements OnModuleInit {
  private notesTableReady = false;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureNotesTable();
  }

  create(createNoteDto: CreateNoteDto) {
    return this.prisma.note.create({
      data: {
        title: createNoteDto.title,
        status: createNoteDto.status,
      },
    });
  }

  private async ensureNotesTable() {
    if (this.notesTableReady) {
      return;
    }

    await this.prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        CREATE TYPE "NoteStatus" AS ENUM ('TODO', 'DONE');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Note" (
        "id" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "status" "NoteStatus" NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
      );
    `);

    this.notesTableReady = true;
  }
}
